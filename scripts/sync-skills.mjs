import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "skills");
const destination = join(root, "packages", "skills", "bundled-skills");
const skillNames = ["anticipate-crux-routes", "use-bridgecrux-primitives", "write-crux-prompts"];

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

const files = [];
for (const skillName of skillNames) {
  const from = join(source, skillName);
  const to = join(destination, skillName);
  await cp(from, to, { recursive: true, force: true });
  await collect(to);
}

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(path);
      continue;
    }
    const bytes = await readFile(path);
    files.push({
      path: relative(destination, path).replaceAll("\\", "/"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
}

await writeFile(
  join(destination, "manifest.json"),
  `${JSON.stringify({ version: 1, skills: skillNames, files }, null, 2)}\n`,
  "utf8",
);
