## Context

The bundle, the schemas and the adapters are generated, committed and guarded by CI (ADR-0002; kernel-architecture, Bundle and CI pipeline). The cost is generated files that every kernel PR rewrites, so parallel PRs conflict on them. The marketplace entry is `"source": "./"`, so users install the default branch.

Facts checked in the repository:

- `pnpm build` (`kernel/build.mjs`) writes `dist/bdk.mjs`, then runs `kernel/scripts/export-schemas.ts`; the output is deterministic (a rebuild leaves `git status` clean).
- The schema exporter writes 83 files: `settings.json`, `pipeline.json`, `state/` (14), `cli/output/` (all 65) and `cli/common/{version,refusal}.json`. Hand-written and tracked: `cli/commands.json`, `cli/commands.schema.json`, `cli/common/list-page.json`.
- `commands.json` refers to the output schemas by relative path (`"output": "output/change-new.json"`).
- The adapters (`lead`, `reader`, `reviewer`, `runner`, `scout`, `worker`) come from `bdk export agents --host claude`, which writes into the plugin's `agents/`, next to 13 hand-written v2 agents that T42 removes. `build.mjs` does not run it today.
- Consumers: the host reads `dist/bdk.mjs` (hooks) and `agents/` (subagents); IDEs fetch `schema/settings.json` by the modeline URL `raw.githubusercontent.com/broneq/bdk/v<version>/...`; the kernel's offline copy is generated from its registry at run time; everything else under `schema/` is read by contract tests.
- Host rules (plugins reference, Fields): `agents` in `plugin.json` takes `.md` files, not directories, and replaces the default `agents/` scan; subfolders of `agents/` become part of the agent name. Marketplace `github` sources take `repo`, `ref` (branch or tag), `sha`.

## Goals / Non-Goals

**Goals:**

- No generated file that a kernel PR rewrites is tracked on feature branches, `staging/v3` or `main`.
- A user installing from the marketplace gets a ref that holds the bundle and the adapters, as before.
- A fresh worktree works with `claude --plugin-dir` after `pnpm install`; a test never reads a stale generated file.

**Non-Goals:**

- Moving generated files into `dist/` (decision 6).
- Changing release-please, versioning or commit conventions.
- Changing what the kernel does at run time, except the tag in the modeline URL.

## Decisions

1. **Everything generated is built and untracked; the `release` branch carries it.** A one-commit-per-release branch, force-pushed by the release workflow. Alternatives: (a) a bot commit of the generated files to `main` after every merge: removes conflicts, adds a noise commit per merge, needs a branch protection bypass and a `[skip ci]` guard against loops; (b) a release tag that includes the files: needs the marketplace entry rewritten per release, inside the release PR, before the bundle exists; (c) release assets with an `archive` plugin source and a `sha256`: another publishing path and a digest per release; (d) keep schemas and adapters tracked (the first version of this proposal): they conflict on the same changes (every settings key edits `settings.json`), and the guard that keeps them equal to their source is the conflict-causing chore. The branch wins on one stable entry and one job.
2. **The release commit adds whole generated directories** (`git add -f dist/ schema/ agents/`), not a list of files. A list would be a second place that must be kept in step with the generators; the directories hold only tracked files, which the tag already has, plus the generated ones. Trade-off: the 82 test-only schemas ship in the release ref too (small JSON, no effect on the plugin).
3. **The settings modeline points at a `dist-v<version>` tag on the release commit.** release-please's tag `v<version>` sits on `main`, which no longer has the schema, so the old URL would 404. A tag per release keeps the schema pinned to the kernel that wrote it. Alternative: the moving `release` branch, simpler but the schema could be newer than a user's kernel; rejected. The tag is created by the same job that creates the commit.
4. **Marketplace entry becomes a `github` source with `ref: release`.** Users still add the marketplace from `main`; only the plugin content comes from `release`. `release` also holds `.claude-plugin/marketplace.json`, harmless. Rejected: asking users to add the marketplace at `broneq/bdk#release`, because every existing install would have to re-register.
5. **Updates rely on the `version` bump.** An installed copy of a moving branch refreshes when the plugin version changes; release-please bumps `plugin.json` on each release and the job runs only then. A manual re-publish without a release is not offered, except `workflow_dispatch` for a tag whose publish failed.
6. **Generated files stay where they are; `dist/` holds only the bundle.** Moving adapters is blocked by the host (decision rationale in Context: `agents` takes files, replaces the default scan). Moving schemas would split `commands.json` from the output schemas it names by relative path and change paths in the modeline, the exporter, about a dozen test files, the specs and the docs. Ignoring in place changes none of those paths.
7. **One generator command and one guard.** `pnpm build` = bundler, schema exporter, `export agents --host claude`. A contract test runs the exporters into a temporary directory, lists what they write and asserts each path is covered by `.gitignore` and untracked (outside the distribution ref). It replaces `git diff --exit-code` and `export agents --check`; the `--check` command stays for people and scripts.
8. **`prepare` and the test scripts build.** `"prepare": "husky && node kernel/build.mjs"`; `test:e2e` and `test:contract` run `pnpm build` first (a sub-second esbuild run plus the exporters). Rejected: "build only when missing", which hides a stale file after a pull. CI jobs that install for other reasons (audit, lint-repo) pay the small build cost; the skill-check job needs it, because it reads `agents/`.
9. **Ignore list by path, shrinking later.** `.gitignore` names `/dist/`, the generated schema paths and six adapter files. After T42 removes the v2 agents the six names collapse to `/agents/`. Rejected: ignoring `/agents/` now, which would untrack the v2 agents.

## Risks / Trade-offs

- `main` and `staging/v3` are no longer installable from git. Mitigation: `claude --plugin-dir` against a built worktree, documented in `CONTRIBUTING.md`; users install from `release`.
- The publish job is a new, rarely run path. Mitigation: `workflow_dispatch`; a contract test that the marketplace entry validates and names `ref: release`; the first real release is the acceptance run, and the job is dry-run once before the entry changes.
- Force-push to `release` needs `contents: write` on that job and no protection on `release`. Mitigation: permission scoped to the job; the branch holds no source of record.
- The modeline of settings files written before this change names a `v<version>` tag that has no schema. Mitigation: `doctor --fix` rewrites the modeline (kernel-settings); v3 is unreleased, so no user file exists yet.
- A forgotten `git add -f` of a generated file on a PR. Mitigation: the contract test on tracked generated paths.
- Hand edits to a generated adapter are silently overwritten by the next build instead of failing CI. Accepted: the file carries a "Generated" marker, and the adapter content has one source.
- A cached older marketplace entry on a user's machine points to `main` until it refreshes. Mitigation: the release notes of the first release after this change say so.

## Migration Plan

1. Land on `staging/v3`: `.gitignore`, `build.mjs`, scripts, contract test and `git rm --cached` of all generated files, in one commit so rebases see one deletion. Open PRs rebase over it; their conflicts on generated files resolve by taking the deletion.
2. Add the publish job and run it once with `workflow_dispatch` on the latest tag to create `release` and `dist-v<version>`.
3. Only then change the marketplace entry (step 2 must precede it, so the entry never points at a missing ref), and the modeline tag in the kernel.
4. Rollback: restore the tracked files and the old entry; `release` can stay.

## Open Questions

None beyond the three recommendations in `proposal.md`.
