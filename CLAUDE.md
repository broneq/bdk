# BDK - Broneq Dev Kit

Claude Code plugin packaging reusable dev workflows (skills, agents, hooks) that install into any project.

## Goal of this line

`staging/v3` builds BDK v3 anew from `main` (`v2.7.0`). It is a better, faster BDK that solves the four problems of v2:

1. **Speed:** a run takes too long; v3 runs faster with better results.
2. **Correctness:** confidence that the product works. v2 checks lean towards plain code review; v3 checks the product as a whole, against what it is meant to do.
3. **Living documentation:** a product without current documentation of how it works falls apart as it grows.
4. **Configurability:** usable as a plugin by different teams in different ways.

The first attempt (`draft/v3-1`, milestone `v3.0-draft1`) built a TypeScript kernel and failed on speed and on product-level correctness. What it taught is in `docs/v3-draft1/` (start with `run-b1/2026-10-07-bdk-v3-findings.md`). Read it before designing anything; do not repeat its root causes.

## Current state (v2, being replaced)

The code on `staging/v3` is still v2. Its layout:

```
skills/                  - thin workflow definitions (language-agnostic)
agents/                  - subagent definitions used internally by skills
hooks/                   - hooks.json + shell scripts
rules/                   - convention docs distributed WITH the plugin to end-users
STARTUP_INSTRUCTIONS.md  - injected into user sessions at SessionStart via hook
tests/evals/             - skill behavior evals (LLM output grading, iterations)
tests/unit/              - pytest unit/integration tests for scripts
docs/                    - design material and the draft 1 archive
```

> `rules/` = BDK distributable output - ships to user projects. Not `.claude/rules/` (dev-time conventions for BDK itself).

- Skills must be **language-agnostic** - no hardcoded `pytest`, `go test`, `npm test`, etc.
- Skills reference each other with full namespace: `/bdk:create-plan`, `/bdk:debug`

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
# Install BDK locally into a test project
# Launch Claude Code from the target project directory with:
claude --plugin-dir ~/projects/bdk

# Invoke a skill in the test project
/bdk:commit
/bdk:debug
```

Never try a BDK skill inside this repository; run it in a separate test project started with `claude --plugin-dir`.

## Modifying the Shared Foundation

`STARTUP_INSTRUCTIONS.md` injected into every user session. Changes affect all skills.
- Keep concise - occupies context every session start
- Verify skills relying on modified section still work
- Test in isolated project after changes

## Plugin Reference Verification

When implementing or modifying anything that depends on Claude Code plugin loader behaviour - directory layout, manifest fields, hook events, frontmatter, `${CLAUDE_PLUGIN_ROOT}`, skill discovery, MCP/LSP server config, etc. - fetch https://code.claude.com/docs/en/plugins-reference first and verify the convention against the current spec. Don't trust prior assumptions; the spec evolves. Cite the relevant section before recommending non-standard behaviour.
