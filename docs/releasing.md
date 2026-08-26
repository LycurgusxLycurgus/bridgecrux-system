# BridgeCrux Publishing Handoff

This is the source of truth for the Codex instance or human acting as the
BridgeCrux release operator. Framework-development agents should improve and
validate the framework, but must not publish, change npm access, or create a
release unless the user explicitly assigns them the release-operator role.

## Current Release State

As of 2026-08-26:

- npm organization and scope: `bridge-crux` / `@bridge-crux`
- dedicated npm release team: `bridge-crux:bridgecrux`
- npm account currently in both release-capable teams: `bridgecrux`
- GitHub owner and repository: `LycurgusxLycurgus/bridgecrux-system`
- default branch: `main`
- repository visibility: public, so trusted publication can produce npm
  provenance
- all six public packages: published at synchronized version `0.2.0` under
  `latest` by GitHub Actions run
  [`29863303463`](https://github.com/LycurgusxLycurgus/bridgecrux-system/actions/runs/29863303463)
- dedicated `bridgecrux` team access: verified read/write on all six packages;
  `bridgecrux` is the sole member of `bridge-crux:bridgecrux`
- default `developers` team access: also read/write on all six packages
- package publishing policy: all six packages require publish MFA and disallow
  automation-token bypass; GitHub trusted publishing remains the release path
- npm provenance: verified SLSA provenance on all six `0.2.0` packages
- clean consumer installation: confirmed for `0.2.0` in a disposable temporary
  directory, including exact kit and skills packages, project-local
  `.codex/skills`, one managed instruction block, exact CLI version,
  `bridgecrux doctor`, and provenance verification; the directory was removed
- source release: annotated tag and GitHub Release
  [`v0.2.0`](https://github.com/LycurgusxLycurgus/bridgecrux-system/releases/tag/v0.2.0)
- public-transition audit: repository source, reachable history, and Actions
  artifacts were checked before changing visibility; no credential-shaped values
  or published artifacts were found
- next prepared candidate: `0.3.0`, a breaking schema-3 release. It is not
  published until the release operator completes every gate in this document.

The npm organization owns the package names. The dedicated npm team controls
human access. GitHub Actions publishes through short-lived npm OIDC credentials;
there is no `NPM_TOKEN` repository secret.

Before changing the release mechanism, re-check npm's current
[trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).
The contract is external and may evolve independently of this repository.

## One-Time Trusted Publisher Setup Reference

The repository owner reports this setup complete for the current six packages.
Use this section only to audit the configuration, recover it, or add a package.

First commit and push `.github/workflows/publish.yml` to `main`. npm requires the
configured workflow file to exist in the GitHub repository.

On npmjs.com, repeat the following for each package:

- `@bridge-crux/core`
- `@bridge-crux/content`
- `@bridge-crux/convex`
- `@bridge-crux/adapters`
- `@bridge-crux/kit`
- `@bridge-crux/skills`

Open **Package settings → Trusted Publisher → GitHub Actions** and enter exactly:

| Field | Value |
| --- | --- |
| Organization or user | `LycurgusxLycurgus` |
| Repository | `bridgecrux-system` |
| Workflow filename | `publish.yml` |
| Environment name | leave blank |
| Allowed actions | `npm publish` only |

Enter only `publish.yml`, not `.github/workflows/publish.yml`. Field values are
case-sensitive. Each npm package has its own setting, so saving one package does
not configure the other five.

Leave **Publishing access** on its current token-compatible setting until one
real version has successfully published through the workflow. npm does not test
the connection when the form is saved. After the first successful OIDC release,
select **Require two-factor authentication and disallow tokens** on all six
packages and revoke any obsolete npm automation tokens.

## Preparing A Release In The Repository

Start from a clean, current `main` checkout. Read `docs/stability.md`, the changes
since the previous release, and the current npm versions. Choose one semantic
version for all six packages; BridgeCrux does not release workspaces at
independent versions. For 0.3.0, read `CHANGELOG.md` and the schema-3 migration
section in `docs/installation.md` before preparing the release.

```bash
git switch main
git pull --ff-only
git status --short
npm run release:prepare -- 0.3.0
git diff
```

`release:prepare` performs a clean dependency install, synchronizes the root and
six workspace manifests plus internal dependencies and `BRIDGECRUX_VERSION`,
verifies release metadata, runs the complete build and conformance gate, reruns
the packed clean-consumer installation, and finishes with `git diff --check`.
It does not commit, tag, push, change repository visibility, or publish.

Review every changed file. The release commit should contain only the intended
framework changes, release metadata, and operator documentation. Then commit and
push the release state to `main` using the repository's normal reviewed GitHub
flow.

## Publishing Through GitHub Actions

The repository must be public before dispatching the workflow when provenance is
part of the completion contract. Confirm visibility with:

```bash
gh repo view LycurgusxLycurgus/bridgecrux-system --json visibility
```

1. Open the GitHub repository.
2. Select **Actions → publish npm packages → Run workflow**.
3. Select branch `main`.
4. Enter the exact committed version.
5. Use npm tag `latest` for a normal stable release or `next` for a prerelease.
6. Run the workflow and inspect every step before treating the release as done.

The workflow uses Node 24 on a GitHub-hosted runner, requests `id-token: write`,
installs from the lockfile without a release cache, verifies package identity and
version synchronization, runs the complete build/conformance gate, and publishes
in dependency order:

```text
core → content → convex → adapters → kit → skills
```

The publish script checks npm before each package. If a run fails after publishing
only part of the set, repair the cause and rerun the same version: already-existing
packages are skipped and the remaining packages continue. Never increment the
version merely to conceal a partial release.

## Post-Publish Verification

Run the exact-version verifier from an npm-authenticated operator checkout:

```bash
npm run release:verify-published -- 0.3.0 latest
```

This command verifies all six registry versions and the requested distribution
tag, checks `bridge-crux:bridgecrux` read/write access, creates a temporary clean
consumer, installs exact kit and skills packages plus Convex, installs all three
project-local skills, runs the exact CLI version and doctor checks, validates one
bounded managed instruction block, verifies SLSA provenance for all six packages
with `npm audit signatures`, and removes the temporary consumer.

For manual diagnosis, verify registry versions and dedicated team access with:

```bash
npm view @bridge-crux/core version
npm view @bridge-crux/content version
npm view @bridge-crux/convex version
npm view @bridge-crux/adapters version
npm view @bridge-crux/kit version
npm view @bridge-crux/skills version
npm access list packages bridge-crux:bridgecrux --json
```

If the automated verifier fails in the consumer step, reproduce manually in a
fresh directory outside this repository:

```bash
npm init -y
npm install @bridge-crux/kit@0.3.0 @bridge-crux/skills@0.3.0 convex
npx @bridge-crux/skills@0.3.0 install --project .
npx @bridge-crux/skills@0.3.0 doctor --project .
npx bridgecrux --version
npx bridgecrux doctor --project .
npm audit signatures --json --include-attestations
```

Confirm all three skills and one bounded BridgeCrux instruction block were
installed. For an OIDC release from this public GitHub repository, all six exact
versions must have verified SLSA provenance before tagging.

Only after all six versions, the consumer path, and provenance are correct should
the release operator create or push the matching Git tag and GitHub Release if the
project is using them. Record any release-specific limitation before handing the
repository back to framework development.

Create the annotated tag at the exact commit published by the successful
workflow, then create the GitHub Release:

```bash
git tag -a v0.3.0 <release-commit> -m "BridgeCrux 0.3.0"
git push origin v0.3.0
gh release create v0.3.0 --repo LycurgusxLycurgus/bridgecrux-system --title "BridgeCrux 0.3.0" --generate-notes --verify-tag
```

## Access Tightening And Recovery

The npm-generated `developers` team currently duplicates the dedicated team's
read/write access. This is not a release blocker. If package publishing should be
restricted to `bridge-crux:bridgecrux`, revoke `bridge-crux:developers` from each
package only after confirming the dedicated team still has read/write access.
New organization packages may grant the default team access again and must be
reviewed individually.

OIDC troubleshooting order:

1. Confirm the run is on `main` and a GitHub-hosted runner.
2. Confirm npm's owner, repository, and `publish.yml` values match exactly.
3. Confirm the package `repository.url` still points to
   `LycurgusxLycurgus/bridgecrux-system`.
4. Confirm the workflow retains `permissions: id-token: write`.
5. Confirm Node is at least 22.14 and npm CLI is at least 11.5.1.
6. Do not add an `NPM_TOKEN` to work around a failed trusted-publisher claim;
   repair the mismatch and rerun the same version.

## Release Completion Contract

A release is complete only when all of these are true:

- the release commit is on `main` and the worktree is clean;
- the complete repository build passed for the exact committed version;
- all six packages expose that version under the intended npm tag;
- the `bridge-crux:bridgecrux` team retains read/write access;
- a fresh consumer can install the kit and skills and run the doctor command;
- an OIDC release shows npm provenance;
- after public OIDC provenance has been proven, traditional publish tokens are disallowed;
- the operator reports the commit, version, npm tag, workflow result, consumer
  result, provenance result, and any remaining limitation.
