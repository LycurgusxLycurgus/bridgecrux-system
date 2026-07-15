# Releasing BridgeCrux

## Release Identity

- npm organization and scope: `bridge-crux` / `@bridge-crux`
- release team: `bridge-crux:bridgecrux`
- current npm owner and team member: `bridgecrux`
- source repository: `https://github.com/LycurgusxLycurgus/bridgecrux-system`
- synchronized initial version: `0.1.0`

The npm organization owns package names. The npm team controls who may publish them. The GitHub account and repository may use different names without affecting the npm scope.

## First Publication

Run from a clean `main` checkout after the release commit is pushed:

```bash
npm whoami
npm ci
npm run build
```

The authenticated user must be an owner or member of `bridge-crux` with permission to create packages. All six workspaces must remain on the same version.

Review npm's exact package payloads:

```bash
npm publish --dry-run --workspace @bridge-crux/core
npm publish --dry-run --workspace @bridge-crux/content
npm publish --dry-run --workspace @bridge-crux/convex
npm publish --dry-run --workspace @bridge-crux/adapters
npm publish --dry-run --workspace @bridge-crux/kit
npm publish --dry-run --workspace @bridge-crux/skills
```

Publish in dependency order:

```bash
npm publish --workspace @bridge-crux/core
npm publish --workspace @bridge-crux/content
npm publish --workspace @bridge-crux/convex
npm publish --workspace @bridge-crux/adapters
npm publish --workspace @bridge-crux/kit
npm publish --workspace @bridge-crux/skills
```

Each package declares `publishConfig.access: public`. Publication is irreversible for a given name and version; never publish from an uncommitted or unvalidated worktree.

## Team Access

After the packages exist, give the dedicated team read/write access:

```bash
npm access grant read-write bridge-crux:bridgecrux @bridge-crux/core
npm access grant read-write bridge-crux:bridgecrux @bridge-crux/content
npm access grant read-write bridge-crux:bridgecrux @bridge-crux/convex
npm access grant read-write bridge-crux:bridgecrux @bridge-crux/adapters
npm access grant read-write bridge-crux:bridgecrux @bridge-crux/kit
npm access grant read-write bridge-crux:bridgecrux @bridge-crux/skills
```

The npm-generated `developers` team receives access to new organization packages by default. Review that team after granting the dedicated team and reduce its package access if releases should be restricted to `bridgecrux`.

## Consumer Verification

In a fresh external directory:

```bash
npm init -y
npm install @bridge-crux/kit convex
npx @bridge-crux/skills install --target <agent-skill-root> --project .
npx bridgecrux doctor --project .
```

Verify that the project receives the three skills and one managed BridgeCrux block in its selected instruction files.

## Later Releases

After the first packages exist, configure npm Trusted Publishing for each package against the GitHub repository and a reviewed release workflow. Continue publishing all public packages at one synchronized version until the stability policy explicitly permits independent versioning.

