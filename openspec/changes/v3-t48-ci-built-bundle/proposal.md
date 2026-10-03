# Proposal

## Why

Scope: #114. Tracks #114.

`dist/bdk.mjs` (about 960 KB, generated) is committed and CI fails on `git diff --exit-code dist/ schema/`. So every PR that touches `kernel/src/` must commit a rebuilt bundle, and two parallel PRs always conflict on a file nobody can merge by hand: the only resolution is to rebuild. The bundle is committed because the plugin installs from git and the hooks call `node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs` (kernel-architecture, Bundle). That requires the bundle in the ref users install from, not on `main` or on feature branches.

## What Changes

- `dist/` is untracked (`.gitignore`, `.gitattributes` line removed). The CI step `git diff --exit-code dist/ schema/` becomes `git diff --exit-code schema/`; `pnpm build` still runs before the E2E and contract tests, so the tested bundle is the built one.
- A new release job builds the bundle and force-pushes the released tag's tree plus `dist/bdk.mjs` to a `release` branch. It runs only when `release-please` created a release.
- The `bdk` entry of `.claude-plugin/marketplace.json` changes from `"source": "./"` to a `github` source with `"ref": "release"`, so users who add the marketplace from `main` install the plugin from the branch that carries the bundle.
- `prepare` builds the bundle after `pnpm install` (after `husky`), so a fresh worktree used with `claude --plugin-dir` has a working kernel with no manual step.
- `kernel/build.mjs` stops describing `dist/` as committed; `kernel/tests/support/run.ts` fails with an instruction when the bundle is missing.
- Documentation that states "committed bundle" is updated: `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, the guide under `docs/guide/`, ADR-0002 (a note that the decision is amended, never rewritten) and `docs/V3-IMPLEMENTATION-PLAN.md` T10.
- **BREAKING** for contributors only: a checkout of `main` or `staging/v3` no longer contains `dist/bdk.mjs`; it cannot be installed as a plugin from git without `pnpm install`. Users are not affected: they install from `release`.

Out of scope: `schema/` and the adapters under `agents/` (`bdk export agents --host claude`) stay committed. `schema/` is read by IDEs and by the `schema/cli` index through public `raw.githubusercontent.com` URLs pinned to a tag or `v3`, and the adapters are plugin content, so both must exist in git, and they change only when the code behind them changes. Moving them is a separate Change if their conflicts prove costly.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-architecture`: requirement `Bundle` (the bundle is built, not committed; the user-facing ref carries it), new requirement `Distribution ref` (release job, `release` branch, marketplace entry), requirement `CI pipeline` (the diff guard covers `schema/` only).
- `kernel-settings`: requirement `Settings JSON Schema` (the CI guard is `git diff --exit-code schema/`).
- `kernel-state`: requirement `State JSON Schema` (same guard).

## Impact

- CI: `.github/workflows/tests.yml` (guard step), `.github/workflows/release-please.yml` (bundle job), `.github/release-please-config.json` untouched.
- Plugin packaging: `.claude-plugin/marketplace.json`; verified against https://code.claude.com/docs/en/plugins/marketplace-reference (Plugin sources: `github` takes `repo`, `ref`, `sha`; `ref` is a branch or tag). Plugin `version` in `plugin.json` is bumped by release-please on every release, which is what makes installed copies update from a moving branch.
- Local: `package.json` `prepare`, `.gitignore`, `.gitattributes`, `kernel/build.mjs`, `kernel/scripts/export-schemas.ts` comments, `kernel/tests/support/run.ts`.
- Docs: `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `docs/guide/`, `docs/adr/0002-kernel-runtime-node-typescript.md`, `docs/V3-IMPLEMENTATION-PLAN.md`.
- Related tasks: T50 (3.0 release, marketplace entry) depends on this pipeline; T24 hooks keep their `kernel-unavailable` refusal when the bundle is missing.

## Open questions

1. **Distribution ref: `release` branch or the release tag.** Recommendation: a `release` branch (a moving ref, one stable marketplace entry, no per-release edit of `marketplace.json`). A tag would need release-please to rewrite the entry in the release PR. The cost of the branch is that a user cannot pin an old release; they can, by `sha`, in their own marketplace entry.
2. **Contributor testing of an unreleased ref.** Recommendation: `claude --plugin-dir <worktree>` after `pnpm install`, as today. No install from a feature branch.
3. **Should `schema/` and the adapters move too.** Recommendation: no, see Out of scope.
