import { spawnSync } from "node:child_process";

export const releasePackages = [
  { name: "@bridge-crux/core", manifest: "packages/core/package.json" },
  { name: "@bridge-crux/content", manifest: "packages/content/package.json" },
  { name: "@bridge-crux/convex", manifest: "packages/convex/package.json" },
  { name: "@bridge-crux/adapters", manifest: "packages/adapters/package.json" },
  { name: "@bridge-crux/kit", manifest: "packages/kit/package.json" },
  { name: "@bridge-crux/skills", manifest: "packages/skills/package.json" },
];

export const internalPackageNames = new Set(
  releasePackages.map(({ name }) => name),
);

export const repositoryUrl =
  "git+https://github.com/LycurgusxLycurgus/bridgecrux-system.git";

export function assertReleaseVersion(version) {
  const semver =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  if (!semver.test(version)) {
    throw new Error(`Expected an exact semantic version, received: ${version}`);
  }
}

export function runNpm(args, options = {}) {
  const npmCli = process.env.npm_execpath;
  if (process.platform === "win32" && !npmCli) {
    throw new Error("On Windows, run release tooling through its npm run command.");
  }

  return npmCli
    ? spawnSync(process.execPath, [npmCli, ...args], options)
    : spawnSync("npm", args, options);
}
