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
  const specifier = `${releasePackage.name}@${version}`;
  const existing = runNpm(["view", specifier, "version"], {
    encoding: "utf8",
  });

  if (existing.status === 0) {
    console.log(`Skipping ${specifier}; it already exists on npm.`);
    continue;
  }

  const lookupOutput = `${existing.stdout ?? ""}\n${existing.stderr ?? ""}`;
  if (!lookupOutput.includes("E404")) {
    process.stderr.write(lookupOutput);
    throw new Error(`Could not determine whether ${specifier} exists on npm.`);
  }

  const published = runNpm(
    [
      "publish",
      "--workspace",
      releasePackage.name,
      "--access",
      "public",
      "--tag",
      tag,
    ],
    { stdio: "inherit" },
  );

  if (published.status !== 0) {
    throw new Error(`Publishing stopped at ${specifier}. Rerun safely after repair.`);
  }
}
