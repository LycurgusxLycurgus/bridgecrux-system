import { readFile } from "node:fs/promises";
import {
  assertReleaseVersion,
  internalPackageNames,
  releasePackages,
  repositoryUrl,
} from "./release-packages.mjs";

const expectedVersion = process.argv[2];
assertReleaseVersion(expectedVersion);

const rootManifest = JSON.parse(await readFile("package.json", "utf8"));
const errors = [];

if (rootManifest.version !== expectedVersion) {
  errors.push(
    `package.json is ${rootManifest.version}; expected ${expectedVersion}`,
  );
}

for (const releasePackage of releasePackages) {
  const manifest = JSON.parse(
    await readFile(releasePackage.manifest, "utf8"),
  );

  if (manifest.name !== releasePackage.name) {
    errors.push(
      `${releasePackage.manifest} is named ${manifest.name}; expected ${releasePackage.name}`,
    );
  }
  if (manifest.version !== expectedVersion) {
    errors.push(
      `${releasePackage.name} is ${manifest.version}; expected ${expectedVersion}`,
    );
  }
  if (manifest.repository?.url !== repositoryUrl) {
    errors.push(
      `${releasePackage.name} repository.url must be ${repositoryUrl}`,
    );
  }

  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
      if (internalPackageNames.has(dependency) && range !== expectedVersion) {
        errors.push(
          `${releasePackage.name} ${field}.${dependency} is ${range}; expected ${expectedVersion}`,
        );
      }
    }
  }
}

if (errors.length > 0) {
  throw new Error(`Release verification failed:\n- ${errors.join("\n- ")}`);
}

console.log(
  `Verified ${releasePackages.length} BridgeCrux packages at ${expectedVersion}.`,
);
