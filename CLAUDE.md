# BDK - Broneq Dev Kit

Claude Code plugin packaging reusable dev workflows (skills, agents, hooks) that install into any project.

## Goal of this line

`staging/v3` builds BDK v3 anew from `main` (`v2.7.0`). It is a better, faster BDK that solves the four problems of v2:

1. **Speed:** a run takes too long; v3 runs faster with better results.
2. **Correctness:** confidence that the product works. v2 checks lean towards plain code review; v3 checks the product as a whole, against what it is meant to do.
3. **Living documentation:** a product without current documentation of how it works falls apart as it grows.
4. **Configurability:** usable as a plugin by different teams in different ways.

The first attempt (`draft/v3-1`, milestone `v3.0-draft1`) built a TypeScript kernel and failed on speed and on product-level correctness. What it taught is in `docs/v3-draft1/` (start with `run-b1/2026-10-07-bdk-v3-findings.md`). Read it before designing anything; do not repeat its root causes.

## Building skills (v3)

The v3 architecture is in `docs/design/2026-10-07-v3-architecture.md`.

- Logic lives in skills. The `bdk` CLI only helps: it computes or saves a model turn, and it never decides the order of the work or blocks a skill.
- Always build a skill with `/skill-creator`, new or rewritten. v2 skills (`main`) and draft skills (`draft/v3-1`) are input to read, not text to copy.
- A new skill starts as a plain skill with an eval case. Add a CLI helper, hook or workflow only when an eval or a measurement shows a concrete problem, and record that problem.
- One block, one job: an author block writes, a verifier block checks, an orchestrator only composes blocks. Each block runs alone and has its own eval cases.
- The `bdk` CLI is built as vertical slices, one per command group: spec `openspec/specs/bdk-cli/`, rule `.claude/rules/bdk-cli.md`, enforced by ESLint (`plugins/bdk/eslint.architecture.ts`).

## Target layout (v3)

Decided in [ADR-0002](docs/adr/0002-v3-repo-structure-and-release.md); details in `docs/design/2026-10-07-v3-repo-structure-cicd.md`. The workspace, PR CI and release flow exist (#172); `git-identity` and `bdk-skill-kit` moved in with their history (#175); `bdk` was laid down with #178.

```
.claude-plugin/marketplace.json  - one marketplace; each entry installs plugins/<name> at ref: release
plugins/<name>/                  - one plugin per directory: manifest, skills, agents, hooks, bin/, CLI src/ and tests/, evals/
docs/                            - VitePress site, ADRs, designs, archives
openspec/                        - SDLC specs and changes
```

- Directory name = plugin name = release-please component = tag prefix (`bdk--v3.0.0`).
- Every plugin works alone; plugins never import from each other.
- `plugin.json` `version` is the only version of a plugin; release-please bumps it.
- A new plugin directory is added to `release-please-config.json` (`"plugins/<name>": {"component": "<name>"}`) and `.release-please-manifest.json` in the same PR; `tests/release-components.test.ts` fails otherwise.
- Node only, no Python. `dist/` is never committed; the release job builds the released plugin and writes it to the `release` branch.
- Hooks call `node "${CLAUDE_PLUGIN_ROOT}/dist/<cli>.mjs"`; everything else calls `bin/<cli>`.

## Current state

The repository holds four plugins, plus the pnpm workspace and toolchain, PR CI (`.github/workflows/pr.yml`), the release flow (`release.yml`, `scripts/publish-plugin.ts`), `docs/` and `.claude-plugin/marketplace.json`. `plugins/git-identity/` and `plugins/bdk-skill-kit/` were imported from their archived repositories (tags `<name>--v<version>`); `plugins/bdk/` is the `bdk` plugin: manifest, `bin/bdk` and its CLI (#178), one slice per command group under `src/`: `config` (#179), `findings` (#187), `run` (#188), `git` (#186), `plan` (#185), `rules` (#184), `check` (#183), `hooks` (#182, called by `hooks/hooks.json`: `SessionStart` and the `PreToolUse` guard `hooks.subagent-git`), `openspec` (#181), and the rule pack `plugins/bdk/rules/` (#184), the skills `skills/setup/` (`/bdk:setup`, #181) and `skills/propose/` (`/bdk:propose`, #197), and the review blocks `skills/review-group/`, `skills/review-integration/`, `skills/judge/` with their agents in `agents/` (#193), and the block `skills/e2e-check/` with its agent `agents/e2e-tester.md` (#194), and the tools `skills/commit/` and `skills/adr/` (#206), and the plan blocks `skills/plan-draft/` and `skills/verify-plan/` with the agent `agents/verifier.md` (#191), and the design blocks `skills/explore/`, `skills/design-draft/` and `skills/verify-design/` with the agent `agents/explorer.md` (#190), and the block `skills/spec-conformance/` on `agents/verifier.md` (#196), and the execute blocks `skills/implement-part/` and `skills/conform-part/` with the agents `agents/implementer.md` and `agents/conformer.md` (#192), and the block `skills/resolve-conflict/` on `agents/implementer.md` (#200), and the orchestrators `skills/design/` (`/bdk:design`, #198), `skills/plan/` (`/bdk:plan`, #199), `skills/execute/` (`/bdk:execute`, with the lead skill `skills/execute-waves/` on `agents/lead.md`, #200) and `skills/close/` (`/bdk:close`, #202), and the block `skills/triage/` (#195); `plugins/bdk-craft/` holds craft skills only, each admitted by a with/without eval recorded in its `evals/RESULTS.md` (#207). v2 is gone from this line; its source stays in git history and on `main` (tag `v2.7.0`).

- The `bdk` marketplace entry installs `plugins/bdk` from the `release` branch; until the first `bdk--v*` release is published from `main` (#213), installing it fails, and `v2.7.0` stays installable by its tag.
- v2 tools come back one by one in their own tasks, rebuilt as v3 skills (see "Building skills (v3)").

## Language

- Everything written into this repository is in English: `docs/`, plans, specs, `README.md`, `CONTRIBUTING.md`, skills, agents, rules, code comments, commit messages, GitHub issues and PR descriptions.
- The conversation language does not change this. When the user writes in another language, reply in that language, but write files in English.
- Exception: `docs/v3-draft1/` is an archive and stays as written. Do not translate it.

## SDLC

Every piece of work is a GitHub issue, an OpenSpec Change and a PR into `staging/v3`, in this order.

- **Create.** A new issue always goes onto the board and into the current milestone, unless the user says otherwise: `gh issue create --title "..." --body-file <file> --milestone v3.0 --project "BDK v3"`. For an issue created without them, add both with `gh issue edit N --milestone v3.0 --add-project "BDK v3"`. Name its blockers with "blocked by" links. Set its `Phase` on the board (phase option ids: `gh project field-list 1 --owner broneq --format json -q '.fields[] | select(.name=="Phase") | .options[]'`):
  ```bash
  ITEM=$(gh project item-list 1 --owner broneq --format json -L 500 -q ".items[] | select(.content.number==N) | .id")
  gh project item-edit --project-id PVT_kwHOAYCCG84Bkk4V --id "$ITEM" --field-id PVTSSF_lAHOAYCCG84Bkk4VzhjU_Ws --single-select-option-id <phase-option-id>
  ```
  The issue body holds the task's scope (Goal, Scope, Input, Acceptance signal, To resolve in the spec, Dependencies).
- **Pick.** Pick the next task from the open issues of the `v3.0` milestone whose blockers are all closed.
- **Start.** Assign yourself (`gh issue edit N --add-assignee @me`) and set its `Status` on the board (https://github.com/users/broneq/projects/1) to In Progress:
  ```bash
  ITEM=$(gh project item-list 1 --owner broneq --format json -L 500 -q ".items[] | select(.content.number==N) | .id")
  gh project item-edit --project-id PVT_kwHOAYCCG84Bkk4V --id "$ITEM" --field-id PVTSSF_lAHOAYCCG84Bkk4VzhjU_Qg --single-select-option-id 47fc9ee4
  ```
- **Branch.** Create the branch from the issue, before the first push, so the PR shows under the issue's Development section: `gh issue develop N --base staging/v3 --name v3/<N>-<slug> --checkout` (`--worktree <path>` instead of `--checkout` for a separate worktree). Closing keywords fire only on the default branch, so `Resolves #N` in a PR into `staging/v3` creates no such link, and no API adds it to an existing PR: then link it by hand in the PR's Development section.
- **Change.** The work runs as an OpenSpec Change `v3-<N>-<slug>` (lowercase: OpenSpec rejects capitals): `/opsx:propose` (or `/opsx:new` + `/opsx:continue` to review artifacts one at a time) naming the issue, then `/opsx:apply`, `/opsx:verify`, `/opsx:archive`. Sync the main specs (`/opsx:sync`) before the gates. Project context and artifact rules: `openspec/config.yaml`.
- **Gates.** Before the PR: every check CI runs (`.github/workflows/`), and `openspec validate --specs --strict`.
- **PR.** One Conventional Commit per Change (`feat(skills)!: ...`, with `BREAKING CHANGE:` when a command or schema value goes) and a PR into `staging/v3` whose body names the issue (`Resolves #N`), the archived Change and the gate results.
- **After the merge.** Close the issue: `gh issue close N -c "Done in #PR"`. The board moves a closed issue to Done by itself. An issue the Change resolved only in part stays open with a comment saying what is left. Delete the merged branch and its worktree.
- Requires the OpenSpec CLI: `npm i -g @fission-ai/openspec@1.13.2`. Its global profile must be `custom` with `ff` and `verify` enabled before running `openspec update`, otherwise the update deletes `/opsx:ff` and `/opsx:verify` from `.claude/`.

## Development Commands

```bash
pnpm install
pnpm check        # what the `check` job of PR CI runs
pnpm build        # before --plugin-dir: dist/ is never committed

# Run a plugin from this repository in a separate test project
# (launch Claude Code from the target project directory):
claude --plugin-dir ~/projects/bdk/plugins/<name>
```

Never try a BDK skill inside this repository; run it in a separate test project started with `claude --plugin-dir`.

## Plugin Reference Verification

When implementing or modifying anything that depends on Claude Code plugin loader behaviour - directory layout, manifest fields, hook events, frontmatter, `${CLAUDE_PLUGIN_ROOT}`, skill discovery, MCP/LSP server config, etc. - fetch https://code.claude.com/docs/en/plugins-reference first and verify the convention against the current spec. Don't trust prior assumptions; the spec evolves. Cite the relevant section before recommending non-standard behaviour.
