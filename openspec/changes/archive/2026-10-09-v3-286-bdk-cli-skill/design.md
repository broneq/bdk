# Design

## Context

- The CLI has nine groups declared in `plugins/bdk/src/*/index.ts` and listed in `src/main.ts`; `docs/reference/bdk/cli.md` is generated from the same declarations (`scripts/docs-reference/model.ts`, `bdkGroups()`).
- #285 (D4 of its design) moved the CLI pointers out of the session start context to this skill; the context says which `/bdk:*` command carries which work.
- `plugins/bdk-skill-kit` rule `cli-front` (R-13) fixes the shape of a skill that fronts a CLI: model-invocable, at most 30 lines, points at `<cli> --help`, copies no usage (at most 3 flags, 2 usage rows).
- Skills call `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`; the plugin `bin/` is also on `PATH` while the plugin is enabled, but skills use the full path.

## Decisions

### D1. Reference and router in one thin skill, model-invocable

The skill answers "which command tells me X" (reference) and "this is work, not a question: use `/bdk:<stage>`" (router). Both fit the `cli-front` limit because both are short sentences; usage is left to `bdk --help`. Model-invocable only in effect: it has a description and no `argument-hint`; a user may type `/bdk:cli` but nothing needs an argument.

Alternatives: reference only (leaves the model to run `bdk config set` or `bdk findings decide` by hand, which belong to stages); router only (the session start context already routes, #285 D2). Both lost: the failure to prevent is a wrong or missing CLI call in either direction.

### D2. Written, not generated; the drift is a test

The skill is a written mapping from questions to commands, because the mapping is judgment ("why did the run stop" is `bdk run status`), not data any declaration holds. What is derivable already is generated: usage lives in `bdk --help` and `docs/reference/bdk/cli.md`. A generated copy in the skill would break the `cli-front` limit and add a second generated artifact. The test `scripts/cli-skill.test.ts` reads `bdkGroups()` and the skill text, and fails for a missing or a stale `bdk <group> <verb>`. It lives in `scripts/` next to the Reference tests because it reads the plugin sources the same way and a plugin test must not import from `scripts/`.

Alternatives: generate `references/commands.md` (second copy of the Reference, stale-check needed anyway); check only group names (misses a new verb).

### D3. Questions the skill answers

Settings and why (`config show/check`), the state of an autopilot run (`run status`), the findings of a review round (`findings list/report`), plan part limits (`plan check`), project check results (`check run`), the rules for a stage (`rules for`), review scope and groups (`git scope/groups`). The state of a Change is `openspec status --change <name>`, not a `bdk` command; the skill says so. Commands that write (`config set`, `findings add/level/decide`, `check run`, `openspec install`) are named with the skill that owns them; `bdk hooks` is called by the host only.

### D4. No new CLI command

No eval showed a missing command; the questions above are all answered by existing ones (`CLAUDE.md`, "Building skills (v3)").

### D5. Evals

Four `block` cases on existing fixtures, `cli-config`, `cli-run-state`, `cli-findings`, `cli-route`. The without arm has no `bdk` binary, so it can only read files; a correct answer there is possible for config (YAML files) and impossible for the run and findings cases without reading raw JSON, which is the contrast the skill should show. Measured (3 runs per arm, Claude Code 2.1.292): `cli-config` 1.00 vs 0.50, `cli-run-state` 0.83 vs 0.50 (one judge FAIL of three on a correct-looking reply), `cli-route` 1.00 vs 0.78, `cli-findings` 1.00 vs 1.00. Two honest findings: `cli-findings` has no contrast because the log is a small JSONL file the model reads raw, so the case only guards against a write; and `cli-route` never fires the skill, the session start context (#285) already routes, so the skill's router half adds nothing measurable beyond that context. The router paragraph stays (four lines, and it names the writing commands that belong to stage skills); if a later measurement shows no effect it can be dropped.

## What we did NOT decide

- Whether the session start context should name `/bdk:cli` (a description already loads in every session; measure first).
