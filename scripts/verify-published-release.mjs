import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertReleaseVersion,
  releasePackages,
  runNpm,
} from "./release-packages.mjs";

const [version, tag = "latest"] = process.argv.slice(2);
assertReleaseVersion(version);
if (!/^[a-z][a-z0-9._-]*$/i.test(tag) || /^v?\d/.test(tag)) {
  throw new Error(`Invalid npm distribution tag: ${tag}`);
}

for (const releasePackage of releasePackages) {
  const publishedVersion = npmText(["view", `${releasePackage.name}@${version}`, "version"]);
  const taggedVersion = npmText(["view", releasePackage.name, `dist-tags.${tag}`]);
  if (publishedVersion !== version || taggedVersion !== version) {
    throw new Error(`${releasePackage.name} expected ${version} under ${tag}; received version=${publishedVersion} tag=${taggedVersion}`);
  }
}

const teamAccess = JSON.parse(npmText(["access", "list", "packages", "bridge-crux:bridgecrux", "--json"]));
for (const releasePackage of releasePackages) {
  if (teamAccess[releasePackage.name] !== "read-write") {
    throw new Error(`bridge-crux:bridgecrux lacks read-write access to ${releasePackage.name}`);
  }
}

const consumer = await mkdtemp(join(tmpdir(), `bridgecrux-${version}-consumer-`));
try {
  await writeFile(
    join(consumer, "package.json"),
    `${JSON.stringify({ name: "bridgecrux-published-verification", private: true, type: "module" }, null, 2)}\n`,
    "utf8",
  );
  runNpmChecked(
    ["install", "--no-fund", "--no-audit", `@bridge-crux/kit@${version}`, `@bridge-crux/skills@${version}`, "convex@1.42.2"],
    consumer,
    "fresh registry installation",
  );

  const skillsCli = join(consumer, "node_modules", "@bridge-crux", "skills", "dist", "cli.js");
  runNodeChecked([skillsCli, "install", "--target", "./.codex/skills", "--project", "."], consumer, "project-local skill installation");

  const kitCli = join(consumer, "node_modules", "@bridge-crux", "kit", "dist", "cli.js");
  const cliVersion = nodeText([kitCli, "--version"], consumer);
  if (cliVersion !== version) {
    throw new Error(`bridgecrux CLI expected ${version}; received ${cliVersion}`);
  }
  runNodeChecked([kitCli, "doctor", "--project", "."], consumer, "consumer doctor");

  for (const name of ["anticipate-crux-routes", "use-bridgecrux-primitives", "write-crux-prompts"]) {
    const installed = join(consumer, ".codex", "skills", name, "SKILL.md");
    if (!(await stat(installed)).isFile()) throw new Error(`Missing installed skill: ${name}`);
  }
  const agents = await readFile(join(consumer, "AGENTS.md"), "utf8");
  if (count(agents, "<!-- bridgecrux:managed:start -->") !== 1 || count(agents, "<!-- bridgecrux:managed:end -->") !== 1) {
    throw new Error("Expected exactly one bounded BridgeCrux instruction block");
  }

  const audit = JSON.parse(npmText(["audit", "signatures", "--json", "--include-attestations"], consumer));
  const provenance = new Set(
    (audit.verified ?? [])
      .filter((entry) => entry.attestations?.provenance?.predicateType === "https://slsa.dev/provenance/v1")
      .map((entry) => `${entry.name}@${entry.version}`),
  );
  for (const releasePackage of releasePackages) {
    const expected = `${releasePackage.name}@${version}`;
    if (!provenance.has(expected)) throw new Error(`Missing verified provenance for ${expected}`);
  }
} finally {
  await rm(consumer, { recursive: true, force: true });
}

console.log(`Verified BridgeCrux ${version} under ${tag}: registry, team access, provenance, and fresh consumer all passed.`);

function npmText(args, cwd = process.cwd()) {
  const result = runNpm(args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`npm ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function runNpmChecked(args, cwd, label) {
  const result = runNpm(args, { cwd, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${label} failed`);
}

function nodeText(args, cwd) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`node ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function runNodeChecked(args, cwd, label) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) throw new Error(`${label} failed`);
}

function count(value, token) {
  return value.split(token).length - 1;
}
