# Contributing to BDK

BDK v3 is being rebuilt on `staging/v3`. This guide describes how the repository works; the way of working (issues, branches, pull requests) is the `## SDLC` section of `CLAUDE.md`. Why the repository is laid out and released this way is [ADR-0002](docs/adr/0002-v3-repo-structure-and-release.md).

## Plugins

Each plugin lives in `plugins/<name>/`: manifest, skills, agents, hooks, `bin/`, CLI source and tests, evals. The directory name is the plugin name, the release-please component and the tag prefix (`bdk--v3.0.0`). Every plugin works alone; plugins never import from each other.

A new plugin directory is added in the same PR to `release-please-config.json` (`"plugins/<name>": {"component": "<name>"}`), `.release-please-manifest.json` and `.claude-plugin/marketplace.json` (a `git-subdir` entry on `plugins/<name>` at `ref: release`). `tests/release-components.test.ts` fails on a directory missing from the release config, and `tests/marketplace.test.ts` on an entry whose path or manifest name does not match. `plugin.json` `version` is the only version of a plugin; release-please bumps it.

A plugin's CLI is called as `bin/<cli>`, a shell launcher that resolves its own path and runs `node ../dist/<cli>.mjs`. Hooks call `node "${CLAUDE_PLUGIN_ROOT}/dist/<cli>.mjs"` instead, with the placeholder quoted: `bin/` is not on a hook's `PATH`, and `claude plugin validate --strict` rejects an unquoted `${CLAUDE_PLUGIN_ROOT}`.

How a skill is built (a plain skill with eval cases first; a CLI helper, hook or workflow only for a measured, recorded problem) is [ADR-0003](docs/adr/0003-v3-architecture-skills-first.md) and `CLAUDE.md` ("Building skills (v3)").

A plugin's `.claude-plugin/plugin.json` keeps the layout release-please writes: it is byte-equal to its parsed content as `JSON.stringify(parsed, null, 2)` plus one newline, and `.prettierignore` skips it, so a release PR changes only its `version` line. No plugin holds a `version.txt`: release type `simple` would bump it as a second version. `tests/release-components.test.ts` checks both.

Every plugin uses the root toolchain: no lint, format, test or commit config, no lockfile and no `.github/` under `plugins/<name>/` (`tests/plugin-toolchain.test.ts`). The root ESLint, Prettier, `pnpm typecheck` and one Vitest suite (`vitest.config.ts`) cover it; a plugin adds a `vitest.setup.ts` for a step that runs once before the suite (the kit builds its bundles) and a per-glob coverage threshold in the root config (the kit's 90/90/90/85). A test hook gets the same timeout as a test; a hook that needs more passes its own limit. A plugin's own agent guidance goes in `plugins/<name>/.claude/CLAUDE.md`, never at the plugin root, which strict validation rejects.

### Importing a plugin repository

A plugin that lived in its own repository joins with its history and its version line (`git-identity` and `bdk-skill-kit` came this way, #175):

1. Rewrite a clone with `git filter-repo --to-subdirectory-filter plugins/<name>`, in the same run rewriting `#N` in messages to `broneq/<old>#N`, rewording subjects that are not Conventional Commits, and renaming tags with `--tag-rename v:<name>--v`.
2. Seed `.release-please-manifest.json` with the last released version (equal to `version` in its `plugin.json`) and keep the old pre-1.0 bump rules in `release-please-config.json`, so release-please continues from that tag and its changelog lists only later commits.
3. Merge with `--allow-unrelated-histories` and merge the PR with a merge commit, not a squash; push the tags after the branch.
4. Replace the old repository's README with a pointer to `plugins/<name>/` here, then `gh repo archive` it.

## The `bdk` CLI

The working rule for CLI code is `.claude/rules/bdk-cli.md`; the decisions behind it are [ADR-0009](docs/adr/0009-cli-vertical-slices.md) (slices) and [ADR-0010](docs/adr/0010-cli-output-contract.md) (output contract).

- **A new command** needs a recorded problem that an eval or a measurement showed ([ADR-0003](docs/adr/0003-v3-architecture-skills-first.md)). A new verb goes into its group's slice; a new group is a new slice under `plugins/bdk/src/` plus its row in `src/slices.ts`, with the reason in `why`.
- **Help and the Reference come from the declaration.** A command's help is generated from its declaration in the slice, so `pnpm docs:reference` regenerates the CLI Reference after any change to a command.
- **A `boundaries/*` lint failure is fixed by fixing the import.** Inline `eslint-disable` comments have no effect under `plugins/bdk/src/`.
- **Tests.** Every command's `--json` output is parsed with its zod schema in the slice's tests. One end-to-end test of the built launcher, `plugins/bdk/tests/cli.test.ts`, builds into a temporary directory, because `pnpm check` runs the tests before `pnpm build`.
- **OpenSpec pin.** A bump of `@fission-ai/openspec` changes `plugins/bdk/package.json`, the version in `/bdk:setup` and the Guide's `install.md` together, and merges only with `plugins/bdk/tests/openspec-schema.test.ts` passing (ADR-0003, "More Information").
- **Pack rules.** A new rule under `plugins/bdk/rules/` names its measurement in `measured`, pointing at a report row; `plugins/bdk/tests/rule-pack.test.ts` fails otherwise ([ADR-0012](docs/adr/0012-rule-pack-admission-by-measurement.md)).

Plugin text conventions, each held by a test:

| Convention | Why | Test |
|---|---|---|
| No file a skill, agent or the CLI writes is named `REPORT*.md`, `SUMMARY*.md`, `FINDINGS*.md` or `ANALYSIS*.md` | the host refuses a subagent's write to such a file, and every BDK block may run as a subagent | `plugins/bdk/tests/refused-names.test.ts` |
| Every paragraph that starts a `bdk:<agent>` names `run_in_background` | a host that gets no value may start the agent in the background, and a lead that waits for a background worker polls for minutes; only a `bdk:lead` started with `execution.lead: background` runs in the background | `plugins/bdk/tests/agent-run-mode.test.ts` |
| Every agent file is a `models` role | a team can set the model and effort of every agent | `plugins/bdk/tests/agent-models.test.ts` |
| Every settings key has a description | the settings Reference is generated from them | `plugins/bdk/src/config/tests/describe.test.ts` |
| `/bdk:cli` names every command the CLI declares | the skill routes the main session to the read commands | `scripts/cli-skill.test.ts` |

## Commands in skills and agents

A skill or agent runs every `bdk` and `lavish-axi` call as the whole Bash command, the quoted plugin path and every argument written out: no `cd`, `;`, `&&`, pipe, `echo` or shell variable, and no backtick, `$` or backslash in free text such as `--summary`. Files are read with Read, Grep and Glob, not through Bash. Write the rule into each block's own text; never widen a grant or add a hook to fit a command. A verifier whose command is denied returns the denial, not a verdict. Why: [ADR-0024](docs/adr/0024-commands-alone-under-narrow-grants.md). The eval cases of the review, triage and plan blocks hold the grader `no-denied-call`, and the eval grants stay as narrow as a real session's (`plugins/bdk/evals/README.md`).

## Checks

Node >= 22.18 and pnpm (the version in `package.json` `packageManager`; `corepack enable` provides it).

```bash
pnpm install
pnpm check        # lint, format check, typecheck, tests, build - the `check` job of PR CI
pnpm format       # rewrite files the format check rejects
pnpm exec claude plugin validate .claude-plugin/marketplace.json --strict
pnpm exec claude plugin validate plugins/<name> --strict   # the `plugins` job, per plugin
pnpm --filter @bdk/docs docs:dev                          # docs site with live reload
```

Commits follow Conventional Commits; the `commitlint` job checks every commit of a PR, and release-please builds versions and changelogs from them. PRs merge with merge commits, so each commit reaches `main` as written; commitlint checks the commits, not the PR title.

PR CI runs on Linux and aims at 5 minutes or less. Every job is a required check:

| Job | Workflow | What it runs |
|---|---|---|
| `check` | `pr.yml` | `pnpm lint`, `format:check`, `typecheck`, `test` (which includes `skill-check` over every plugin's skills and agents, `tests/skill-check.test.ts`), `build` |
| `plugins` | `pr.yml` | `claude plugin validate --strict` on the marketplace and on every plugin directory, nothing else |
| `commitlint` | `pr.yml` | every commit of the PR |
| `docs` | `pr.yml` | the VitePress build and the diagram fit check, only when `docs/`, `pnpm-lock.yaml` or `pr.yml` changed; it reports success otherwise |
| `openspec` | `pr.yml` | `openspec validate --specs --strict` |
| `docs-impact` | `docs-impact.yml` | a change to plugin skills, agents, hooks, sources or main specs changes a Guide or Concepts page too, or the PR body says `Docs-impact: none - <reason>` |

Besides each plugin's own tests, `pnpm test` runs the repository tests in `tests/`; among them `tests/conflict-markers.test.ts` fails when a committed file holds a git conflict marker, which a merge can commit past every other check.

`pnpm-lock.yaml` is the one generated file a PR may change, so a dependency change goes in a PR of its own.

## Trying a change

Build first, then run a plugin from this repository in a separate test project, never in this repository:

```bash
pnpm build
claude --plugin-dir ~/projects/bdk/plugins/<name>
```

## Releases

Releases run from `main` only (`.github/workflows/release.yml`). release-please in manifest mode, release type `simple`, opens one release PR per plugin; an `extra-files` updater writes the version into `.claude-plugin/plugin.json`, and tags are `<plugin>--v<version>`. Release PRs and tags are created with a GitHub App token, so they trigger PR CI.

When a release is created, one `publish` job (`scripts/publish-plugin.ts`) handles every released plugin in turn, never as a matrix, and the workflow's `concurrency: release` never cancels a running release. For each plugin it checks out the tag, builds it, copies the plugin without its development files (`src/`, `tests/`, `evals/`, `node_modules/`, `tsconfig*.json`) into a snapshot, checks that `plugin.json` names the tag's plugin and version, runs `claude plugin validate --strict` on it, compares `bin/<cli> --version` with the tag, and replaces only `plugins/<name>/` on the `release` branch in one fast-forward commit. A failed plugin leaves the branch unchanged. A ruleset on `release` lets only that App push and refuses deletion and non-fast-forward pushes.

## Docs site

`docs/` is a VitePress site: the Guide, Concepts, the Reference (generated by `pnpm docs:reference`, never edited by hand) and the ADRs. The `docs` job builds it on PRs that touch it; `.github/workflows/docs.yml` deploys it to GitHub Pages from `main` only.

- One site for the release on `main`; no pages per version.
- Why the Reference is committed, an exception to ADR-0002, is [ADR-0026](docs/adr/0026-reference-generated-and-committed.md). `scripts/docs-reference.test.ts` fails `pnpm check` on a page that differs from the sources and names the command; after parallel PRs conflict on it, regenerate, never merge the text by hand.
- ADRs and designs enter the sidebar by file name. A Guide, Concepts or Reference page is added to the declared order in `docs/.vitepress/sidebar.ts`; `sidebar.test.ts` fails on a page missing from it.
- `docs/v3-draft1/` stays out of the site: a relative link into it becomes a GitHub link, and a link to a file that does not exist there fails the build.
- The styling is the Broniszewski design system: an unchanged copy of its tokens in `docs/.vitepress/theme/design-system/`, updated as its README says. Fonts are self-hosted; the site loads nothing from another host.

### Updating the docs

A change to what a BDK user sees (a skill, agent, hook, `bdk` command, settings key, or the flow between them) updates the docs in the same PR:

- the Guide and Concepts pages that describe it, prose, tables and diagrams; a change that adds, removes or reorders a step, exit, command, settings key, file or agent of a flow redraws every diagram that draws that flow;
- the Reference, regenerated with `pnpm docs:reference`;
- every orchestrator and every block a user types that starts its own agent has a section with its diagram in `docs/concepts/orchestrators.md`, and its skill is listed in that page's Sources.

Write names in the forms the name check reads: a skill as `/bdk:<name>`, an agent as `bdk:<agent>` or a link to its Reference entry, a command as `bdk <group> <verb>`, a settings key by its full dotted path, a rule of the pack by its id (`BDK-CQ-1`). `scripts/docs-names.test.ts` fails `pnpm check` on a Guide or Concepts page, prose or diagram, that names one that does not exist, with the page, the line and the name.

The `docs-impact` job (`.github/workflows/docs-impact.yml`, rule in `scripts/docs-impact/rule.ts`) fails a PR that changes `plugins/*/skills/`, `agents/`, `hooks/` or `src/` and no page under `docs/guide/` or `docs/concepts/`, unless the PR body holds a line `Docs-impact: none - <reason>`. A change under `docs/reference/` does not count. The job runs again when the body is edited.

### Mermaid diagrams

The site sets one Mermaid layout for every diagram (`docs/.vitepress/theme/mermaid-diagram.ts`), so the rules below hold on every page:

- Automatic wrapping is off for flowcharts and sequence diagrams: a label breaks only where its author writes `<br/>`. A label line (split at `<br/>`, an HTML entity counted as one character) holds at most 40 characters.
- No block sets its own configuration: an `init` or `initialize` directive, a `config:` frontmatter, or wrapping turned on in a sequence diagram fails `pnpm check`. So does a block that does not parse (`docs/.vitepress/mermaid-parse.test.ts` names the page and the block's line).
- At 1280 px every diagram renders at 0.8 of its natural width or more (labels at 11.2 px or larger) and its frame does not scroll sideways; at 390 px no diagram is a left-to-right chain. A drawn label shows the lines its source has, and a block label stays inside its block.
- The `docs` job checks the fit on the built site in Chromium (`docs:diagram-fit`, `docs/.vitepress/diagram-fit.ts`): it fails a diagram below 0.8, one whose frame scrolls, one whose label lines differ from its source, and one it cannot measure, and names the page, the block's line and the widest width that fits. Run it locally after `pnpm --filter @bdk/docs docs:build`.

A diagram that does not fit is redrawn (top to bottom instead of a long chain, fewer nodes per row, shorter labels), never configured to fit.

## Evals

Skills are measured with `claude plugin eval`, locally only, because every run is paid. How to run the suite and write a case: [`plugins/bdk/evals/README.md`](plugins/bdk/evals/README.md). PR CI loads every case of every plugin's `evals/` for free, at a cost ceiling of zero, and runs each case's scaffold (`tests/eval-suites.test.ts`); a plugin that adds its first case lists the tools its eval README grants in that test.

- **Admission of a `bdk` block.** A block stays only when its `block` cases, run with and without the plugin, score the with-arm above the without-arm (ADR-0003). The PR that adds or changes the block records the `WITH`, `W/OUT` and `Δ` of the measured run, and the eval README keeps the result next to the case.
- **Admission of a plain-skill plugin's skill** (`bdk-craft`, `bdk-explain`): the threshold and the record in the plugin's `evals/RESULTS.md` are [ADR-0025](docs/adr/0025-plain-skills-ship-on-eval-evidence.md); `tests/admitted-skills.test.ts` checks the record against `skills/`.
- **Stage and orchestrator cases.** Every case carries exactly one of the tags `block`, `orchestrator` or `sample`. A block case grades the result (`file_exists`, `regex` or `llm`) and the steps (`tool_used` or `tool_order`); an orchestrator case runs one arm and grades the order of its blocks with `tool_order` and the files it writes with `file_exists` (a `writes-nothing` case grades a trace `regex` instead). `plugins/bdk/tests/evals.test.ts` checks the tags and graders.
- **No network in a run.** A run has its own `HOME` and no GitHub credential. A case that needs GitHub uses the offline `gh` stand-in `plugins/bdk/evals/fixtures/bin/gh`, which answers issues, pull requests, reviews and the repository from files under `.git/bdk-eval/` of the workspace, and a case that pushes gets a bare remote inside the workspace (`.git/bdk-eval/remote.git`). A new `gh` call a skill makes is added to the stand-in and its tests first.
- **Paid runs.** An issue that pays for runs has a `Budget` section, and the PR that reports a paid measurement records the total cost and machine time of every paid run, probe, failed and repeated runs included, or names each run whose cost is unknown. The rest of the rules are the eval README's "Before a paid run".

## ADRs

A decision that is hard to reverse, surprising without context and the result of a real trade-off is recorded as an ADR in `docs/adr/`, numbered on from the highest existing one (`NNNN-<slug>.md`), with MADR-style sections (Context and Problem Statement, Decision Drivers, Considered Options, Decision Outcome). Its frontmatter:

```yaml
---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by: # repository paths of the tests, lint configs or CI workflows that check it, or `none`
  - tests/release-components.test.ts
---
```

`tests/adr-format.test.ts` (run by `pnpm check`) fails an ADR without `status`, `date`, `decision-makers` or `enforced-by`, an `enforced-by` path that does not exist, and two ADRs with the same number.
