import { spawnSync } from "node:child_process";
import {
  assertReleaseVersion,
  runNpm,
} from "./release-packages.mjs";

const version = process.argv[2];
assertReleaseVersion(version);

runNpmChecked(["ci"], "clean dependency installation");
runNpmChecked(["run", "release:version", "--", version], "version synchronization");
runNpmChecked(["run", "release:verify", "--", version], "release metadata verification");
runNpmChecked(["run", "build"], "complete build and conformance gate");
runNpmChecked(["run", "pack:test"], "packed clean-consumer installation");

const diffCheck = spawnSync("git", ["diff", "--check"], { stdio: "inherit" });
if (diffCheck.status !== 0) {
  throw new Error("git diff --check failed");
}

console.log(`BridgeCrux ${version} is prepared for diff review, commit, and trusted publishing.`);

function runNpmChecked(args, label) {
  const result = runNpm(args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Release preparation stopped during ${label}.`);
  }
}
