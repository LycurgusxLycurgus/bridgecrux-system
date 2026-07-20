import { readFile, writeFile } from "node:fs/promises";
import {
  assertReleaseVersion,
  internalPackageNames,
  releasePackages,
  runNpm,
} from "./release-packages.mjs";

const version = process.argv[2];
assertReleaseVersion(version);

const manifestPaths = ["package.json", ...releasePackages.map(({ manifest }) => manifest)];

for (const manifestPath of manifestPaths) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.version = version;

  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    for (const dependency of Object.keys(manifest[field] ?? {})) {
      if (internalPackageNames.has(dependency)) {
        manifest[field][dependency] = version;
      }
    }
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

const kitIndexPath = "packages/kit/src/index.ts";
const kitIndex = await readFile(kitIndexPath, "utf8");
const versionDeclaration = /export const BRIDGECRUX_VERSION = "[^"]+";/;
if (!versionDeclaration.test(kitIndex)) {
  throw new Error(`Could not find BRIDGECRUX_VERSION in ${kitIndexPath}`);
}
await writeFile(
  kitIndexPath,
  kitIndex.replace(versionDeclaration, `export const BRIDGECRUX_VERSION = "${version}";`),
);

const lockResult = runNpm(
  ["install", "--package-lock-only", "--ignore-scripts"],
  { stdio: "inherit" },
);

if (lockResult.status !== 0) {
  throw new Error("npm could not synchronize package-lock.json");
}

console.log(`Set every BridgeCrux workspace and internal dependency to ${version}.`);
