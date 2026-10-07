# Design

## Context

`staging/v3` holds `docs/`, `openspec/`, repo metadata and `.claude-plugin/marketplace.json`; `pr.yml` has one job, `openspec` (#177). ADR-0002 and its design (`docs/design/2026-10-07-v3-repo-structure-cicd.md`) fix the layout, the jobs, the release flow and the `release` branch; this design only decides how to build them. Tooling facts measured on this machine: pnpm 12.6 blocks dependency build scripts unless `allowBuilds` names the package, and holds back packages younger than its minimum release age unless they are excluded; `@anthropic-ai/claude-code@2.1.292` installs with pnpm in ~5 s (102 MB platform binary) and `claude plugin validate <dir> --strict` takes < 1 s.

## Goals / Non-Goals

**Goals:**
- The publish step is code with tests, not shell inside YAML, because it is the single writer of what every user installs.
- One command, `pnpm check`, runs locally what the `check` job runs.
- Nothing in the skeleton assumes a plugin exists: all jobs pass on a repository with an empty `plugins/`.

**Non-Goals:**
- A shared esbuild helper for plugin builds. The first plugin with a CLI (#178) writes its own `build` script; a shared helper waits for a second one.
- husky, lint-staged and knip from `draft/v3-1`. CI is the gate; local hooks slow down 5-10 parallel agent sessions and duplicate it.
- Coverage thresholds. There is little code yet; a threshold set now measures nothing.

## Decisions

### D1. Claude Code is a pinned root dev dependency

`@anthropic-ai/claude-code` is in the root `devDependencies` at an exact version, allowed to run its postinstall in `pnpm-workspace.yaml`. The `plugins` job, the publish job, the publish tests and contributors all call `claude` from `node_modules/.bin`, at the version in `pnpm-lock.yaml`.

Alternative: `npm install --global @anthropic-ai/claude-code` in each job (design section "PR CI"). Lost: the version would float or be pinned in a third place, and the local `claude` of a contributor could differ from CI. The design already allows caching the package by version; the pnpm store cache does that.

### D2. The publish step is `scripts/publish-plugin.ts`, run by Node directly

`release.yml` calls `node scripts/publish-plugin.ts <tag>...`. Node >= 22.18 strips TypeScript types without a flag, so no loader or build step is needed; the file uses only erasable syntax (`erasableSyntaxOnly` in `tsconfig.json`). For each tag `<name>--v<version>`, in order:

1. `git worktree add --detach` at the tag; `pnpm install --frozen-lockfile` there when the worktree has a root `package.json`; `pnpm run build` in `plugins/<name>/` when its `package.json` has a `build` script.
2. Check `name` and `version` of `plugins/<name>/.claude-plugin/plugin.json` against the tag.
3. Copy `plugins/<name>/` into a snapshot, leaving out `src/`, `tests/`, `evals/`, `node_modules/`, `version.txt` and `tsconfig*.json`.
4. `claude plugin validate <snapshot> --strict`; run each executable in `<snapshot>/bin/` with `--version` and compare the trimmed output with the version.
5. Fetch `release`; check out its head in a second worktree, or start an orphan branch when it does not exist; replace `plugins/<name>/` with the snapshot; commit `chore(release): <name> v<version>` when anything changed; `git push <remote> HEAD:refs/heads/release` without force.

The tests build a temporary repository with two fixture plugins, tags and a bare remote, run the script as a child process exactly as the workflow does, and assert on the remote's `release` branch.

Alternatives: shell steps in `release.yml` - lost, they cannot be tested before the first real release, and a mistake there breaks every user's install; one checkout of `github.sha` for all tags - lost, release-please tags the release PR's merge commit, which is not always the commit of the run (a failed earlier run leaves its tag to a later one), and a worktree per tag costs only one `pnpm install` from the warm store.

### D3. Snapshot by deny list, not allow list

The snapshot keeps everything in `plugins/<name>/` except development-only paths (D2 step 3). A missing runtime file breaks installs silently, while a leaked development file is harmless, so the safer error is on the deny side. `package.json` stays: a plugin with `.js` ES modules needs its `"type": "module"`, and Claude Code installs dependencies only with a lockfile, which a workspace plugin does not have. `CHANGELOG.md` stays as release notes for users.

Alternative: the allow list of the design section "Releases" (manifest, skills, agents, hooks, `bin/`, `dist/`) - lost, it drops other plugin loader paths (`commands/`, `output-styles/`, `.mcp.json`, `settings.json`) unless every new one is added by hand. The design's intent, "no `src/`, `tests/`, `evals/`, `version.txt`", is kept.

### D4. The release branch bootstraps itself

When `git ls-remote <remote> refs/heads/release` is empty, the script starts the branch with `git switch --orphan`, so the first published plugin creates it. The ruleset restricts creation as well, and the App bypasses it. Alternative: a manual first commit before the ruleset - lost, it is a one-off step someone must remember, and it would be pushed by a person, against the rule that only the App writes `release`.

### D5. release-please runs on `main` only; the package list starts empty

`release.yml` triggers on `push` to `main`. `staging/v3` reaches `main` by its final merge, so the first v3 tags come from released `main` history (see proposal, "Resolved"). The config sets the shared options once at the top level (`release-type: simple`, `include-component-in-tag`, `tag-separator: "--"`, `extra-files` with the json updater on `.claude-plugin/plugin.json` `$.version`) and lists no package; each plugin task adds `"plugins/<name>": {"component": "<name>"}` and its manifest entry. A workspace test compares the package list with the plugin directories (spec `repo-sdlc`, "Every plugin directory is a release component"), so a plugin cannot be added without becoming releasable. Release PRs are separate per plugin (`separate-pull-requests: true`), matching "separate version per plugin".

Alternative: a placeholder package now - lost, it would be a plugin that does not exist. Release type `node` - lost, plugin packages are `private` and carry no version (design section "Layout"); #173 settles whether `simple` stays.

### D6. Workflow jobs

- `release-please` and `publish` each create an App token with `actions/create-github-app-token` from `vars.RELEASE_APP_ID` and `secrets.RELEASE_APP_PRIVATE_KEY`. Tags and release PRs made by the App trigger the normal PR CI, which `GITHUB_TOKEN` would not. `publish` commits as `<app-slug>[bot]`.
- `release-please` forwards all its step outputs as one JSON output; `publish` reads `paths_released` and each `<path>--tag_name` from it and passes the tags to the script. Workflow-level `concurrency: {group: release, cancel-in-progress: false}`; one `publish` job loops over the plugins (design, Risk Register "Bottleneck").
- `docs` always starts and decides with `git diff --name-only` against the PR base whether to build. A job skipped by a workflow-level path filter never reports, which blocks a required check; a third-party paths-filter action adds a dependency for five lines of shell. So `docs` is required as well and reports success when it skips.
- `plugins` validates every plugin directory, not only the changed ones (design section "PR CI"): each validation takes under a second, and validating all removes the diff logic and catches a break caused outside the plugin (e.g. a Claude Code bump in the lockfile).
- `commitlint` checks the commits from the PR base to its head. Pull requests merge with merge commits, so the commits themselves reach `main` and release-please reads them; the PR title does not.
- Every job uses `actions/checkout`, `pnpm/action-setup` (version from `packageManager`) and `actions/setup-node` with the pnpm cache and `node-version-file: .nvmrc`.

### D7. Toolchain configuration

- One root `vitest.config.ts` collects `tests/**/*.test.ts`, `scripts/**/*.test.ts` and `plugins/*/{src,tests}/**/*.test.ts`. Plugins need no test config of their own. Alternative: vitest projects per plugin - lost, nothing differs between plugins yet.
- `tsconfig.json` at the root typechecks root code (`scripts/`, `tests/`, configs, `docs/.vitepress/`); `pnpm typecheck` runs it and then `typecheck` of every workspace package that defines one. A plugin with TypeScript adds its own `tsconfig.json` extending the root one.
- eslint: `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked` on `**/*.ts`, `eslint-config-prettier` last, `--max-warnings 0`.
- prettier formats code and config (`ts`, `js`, `mjs`, `json`, `yaml`, `vue`, `css`), not Markdown. Markdown here is written by agents and by `openspec archive`; prettier's Markdown rewrite would reformat tool output after every archive and touch the `docs/v3-draft1/` archive. Alternative: prettier on Markdown with ignores - lost for that reason.
- Node: `engines.node >= 22.18`, CI on the version in `.nvmrc` (24).
- pnpm: `packageManager: pnpm@12.6.0`; `allowBuilds` allows only `@anthropic-ai/claude-code` and `esbuild` (needed by #178 and VitePress). The default minimum release age stays on; a dependency bump newer than it is excluded by name in `pnpm-workspace.yaml`, in the PR that bumps it.

### D8. Minimal docs site

`docs/` becomes the workspace package `@bdk/docs` with VitePress, a home page linking to the ADRs and designs, and `srcExclude` for `v3-draft1/**` (an archive: its links are not kept up to date, and VitePress fails on dead links). Its scripts are `docs:build` and `docs:dev`, not `build`, so `pnpm build` in `check` does not build the site. Theme, navigation and the Pages deploy are left to a follow-up issue.

## Risks / Trade-offs

- [Claude Code adds ~100 MB to every install] → pnpm store cache in CI; measured ~5 s cold. If it grows, the design's fallback (cache by version) is what the store already does.
- [The acceptance signal "test plugin gets a release PR, tag and files on `release`" cannot run before `staging/v3` merges into `main`] → the publish script is tested end to end against local repositories now; the release-please half is #173's dry run; the full flow runs on the first real release, and #172 stays open until then.
- [The App's private key is a long-lived secret with write access to the repository] → the App gets only Contents, Pull requests and Issues write on `broneq/bdk`; the key lives only in the Actions secret; rotating it is generating a new key and replacing the secret.
- [A publish fails after some plugins were pushed] → each plugin is its own commit and push, so earlier plugins stay published; re-running the failed job publishes the rest, and a plugin whose snapshot is unchanged makes no commit.
- [Concurrent runs: a third run cancels the pending second one] → release-please is idempotent: the next run picks up merged release PRs that still carry `autorelease: pending`, creates their tags and publishes them.

## Migration Plan

GitHub-side setup, once, by a repository administrator (it cannot be done from a pull request):

1. Create a GitHub App owned by `broneq`, e.g. `bdk-release`: no webhook; repository permissions Contents: Read and write, Pull requests: Read and write, Issues: Read and write, Metadata: Read. Install it on `broneq/bdk` only. Generate a private key.
2. `gh variable set RELEASE_APP_ID --body <app-id>` and `gh secret set RELEASE_APP_PRIVATE_KEY < key.pem`; delete the local key file.
3. Ruleset `release-branch` on `refs/heads/release`: rules `creation`, `update`, `deletion`, `non_fast_forward`; bypass actor: the App (`actor_type: Integration`, `bypass_mode: always`); no other bypass actors.
4. Ruleset `required-checks` on `refs/heads/main` and `refs/heads/staging/v3`: required status checks `check`, `plugins`, `commitlint`, `docs`, `openspec` from GitHub Actions.
5. Verify: a push to `release` by the administrator is rejected.

Rollback: delete `release.yml` or disable the workflow; the `release` branch keeps the last published files, and marketplace entries can pin a tag instead of `ref: release`.

## Open Questions

- Whether release type `simple` writes `version.txt` and whether to keep it: #173. The snapshot already leaves `version.txt` out, so either answer works.
