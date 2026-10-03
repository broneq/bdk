## Context

The bundle is committed so that a plugin installed from git runs with no build step (ADR-0002, kernel-architecture `Bundle`). CI enforces it with `git diff --exit-code dist/ schema/`. The cost is a generated 960 KB file that every kernel PR rewrites, so parallel PRs conflict on it. The marketplace entry today is `"source": "./"`, so users install the default branch.

Facts checked: `kernel/build.mjs` writes `dist/bdk.mjs` and then `schema/`; `prepare` is `husky`; the `kernel` CI job already runs `pnpm build` before E2E, so tests run the built bundle; the schema modeline and `$id` URLs point at `raw.githubusercontent.com/broneq/bdk/v<version>` and `/v3`, so `schema/` must be in git at the tag; `agents/` holds generated adapters that the plugin loads from its own tree; the kernel reads its version from `.claude-plugin/plugin.json` at run time. Marketplace sources (https://code.claude.com/docs/en/plugins/marketplace-reference, Plugin sources): `github` takes `repo`, `ref` (branch or tag), `sha`.

## Goals / Non-Goals

**Goals:**

- No generated file that every kernel PR rewrites is tracked on feature branches, `staging/v3` or `main`.
- A user installing from the marketplace gets a ref that contains the bundle, as before.
- A fresh worktree works with `claude --plugin-dir` after `pnpm install`.

**Non-Goals:**

- Moving `schema/` or `agents/` adapters off git (see decision 5).
- Changing release-please, versioning or the commit conventions.
- Changing what the kernel does at run time.

## Decisions

1. **Untrack `dist/`; publish it on a `release` branch.** A one-commit-per-release branch force-pushed by the release workflow. Alternatives: (a) a bot commit of `dist/` to `main` after every merge: removes conflicts, adds a noise commit per merge, needs a branch protection bypass and a `[skip ci]` guard against loops; (b) a release tag that includes `dist/`: needs the marketplace entry rewritten per release (release-please `extra-files` could do it, but inside the release PR, before the bundle exists, so the entry and the tag content would be built in two places); (c) release assets (an `archive` plugin source with `sha256`): another publishing path and a digest to maintain per release. The branch wins on one stable entry and one job.
2. **Marketplace entry becomes a `github` source with `ref: release`.** Users still add the marketplace from `main` (`broneq/bdk`); only the plugin content comes from `release`. `release` also contains `.claude-plugin/marketplace.json`, which is harmless. Rejected: asking users to add the marketplace at `broneq/bdk#release`, because every existing install would have to re-register.
3. **Updates rely on the `version` bump.** Installed copies of a moving branch refresh when the plugin version changes; release-please bumps `plugin.json` on each release and the job runs only then. A manual re-publish without a release is therefore not offered.
4. **`prepare` builds the bundle.** `"prepare": "husky && node kernel/build.mjs"`. The build is a sub-second esbuild run plus the schema exporter, so CI jobs that run `pnpm install` for other reasons (audit, lint-repo, skill-check) pay a small cost; accepted over a conditional "build when missing" script, which would hide a stale bundle after a pull. Hooks and `--plugin-dir` read `dist/bdk.mjs` of the worktree, and each worktree runs its own install.
5. **`schema/` and the `agents/` adapters stay committed.** `schema/` is fetched from GitHub by IDEs through tag-pinned URLs, and the adapters are plugin content that must exist in the `release` tree; both are small, change only with the code behind them, and keep their drift guards (`git diff --exit-code schema/`, `export agents --check`). Moving them would need a second publishing path for no measured conflict cost. Revisit as a separate Change if they start to conflict.
6. **Missing-bundle failure stays where it is.** The hooks already refuse with `guard/kernel-unavailable` and the SessionStart message when `dist/bdk.mjs` is absent (kernel-cli/hooks). Only the test harness gains an explicit message, because a contributor meets that case first.

## Risks / Trade-offs

- `main` and `staging/v3` are no longer installable from git. Mitigation: `claude --plugin-dir` against a built worktree, documented in `CONTRIBUTING.md`; users install from `release`.
- The publish job is a new, rarely run path that can rot. Mitigation: a `workflow_dispatch` input that publishes a given tag, and a contract test that the marketplace entry validates and names `ref: release`; the first real release is the acceptance run.
- Force-push to `release` needs `contents: write` on that job and no branch protection on `release`. Mitigation: the permission is scoped to the job; the branch holds no source of record.
- A user pinned to `main` by an older marketplace entry cached locally sees the old entry until the marketplace refreshes. Mitigation: the release notes of the first release after this change say so.
- A forgotten `.gitignore` bypass (`git add -f dist/`) on a PR is not caught by a test. Mitigation: a contract test that `git ls-files dist` is empty on every branch except `release` (the test skips when HEAD is the distribution ref).

## Migration Plan

1. Land the change on `staging/v3`: `.gitignore`, guard step, `prepare`, docs, `git rm --cached dist/bdk.mjs` in the same commit that adds the ignore rule.
2. Open PRs rebase over it; their `dist/bdk.mjs` conflict is resolved by taking the deletion.
3. Add the publish job and the marketplace entry change together, so the entry never points at a missing `release`. Run the job once with `workflow_dispatch` on the latest tag to create `release` before the entry change merges to `main`.
4. Rollback: restore the `dist/` commit and the old entry; `release` can stay.

## Open Questions

None beyond the three recommendations in `proposal.md`.
