## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T41 (Delivery item 2). Tracks #61.

The kernel already owns the commands a project and a Change start with (`config set`, `doctor`, `import`, `rules import`, `change new|status|list|resume|park|takeover`), but the user still reaches them through the v2 `setup` skill, which writes settings by hand, plans `.bdk/plans/` and `.bdk/design/` directories v3 no longer has, and knows nothing of Changes. No `/bdk:change` exists at all, so the design's entry flow (`/bdk:setup`, then `/bdk:change new "<intent>"`; design "UX Touchpoints") cannot be walked. This Change delivers the two skills that begin the workflow, so every later T41 Change (design, plan, execute, close and run) is built and tested on a real Change opened the way a user opens one.

## What Changes

- **New stage skill `setup`** (replaces the v2 `skills/setup`, T02 disposition "redesign"): a thin skill that brings a project to a working v3 layout and ends when `bdk doctor` and `bdk config check` pass.
  - v2 layout found by `bdk doctor`: the skill migrates the project itself, reading `.bdk/settings.json` as detection hints and deleting the v2 files after the user confirms. **BREAKING (spec)**: the unimplemented `bdk import` command is removed from the kernel contract (decision 4); Q1's hard cut stands, since the kernel still never reads v2 state.
  - Settings: detect the stack from project files with the runner table kept as skill knowledge (T02 OD-9 (a)), confirm only the full commands with the user, and write every key through `bdk config set`, so the kernel validates each entry, keeps the modeline and adds the two `.gitignore` paths. The table moves into a reference file to keep the skill under 200 lines (S1).
  - Lavish: check `npx -y lavish-axi --help`; on failure offer the install or set `features.lavish false` (T02 R-11).
  - Hand-written `.claude/rules/`: `bdk rules import --dry-run`, then import on confirmation; the `BDK-*` pack is read from the plugin and never imported (T31). The skill offers to remove the imported source files, since the projection now carries their rules.
  - No question about anything the kernel measures or derives (tiers and scoped forms follow from the runner; profile, sizes and branch state are the kernel's).
- **New stage skill `change`** (T02 section 13.3, user decision 2026-09-25): the entry into a Change and the place to see where it stands.
  - `/bdk:change <intent>` opens a Change. The skill first asks whether to create a new branch or stay on the current one (decision 1), reads enough of the code to judge the starting profile against the `tiny` checklist of T20 design D-11 (all true: no new or changed behaviour visible to a user or an API, no change to a data model, schema or configuration, no `spec-impact`, at most 2 files in 1 module; any doubt is `small`), passes `--profile tiny --reason <why>` only when every item holds, and `--kind bug` when the intent reports a defect (R-8).
  - `/bdk:change` without arguments renders `bdk change status`; `resume <id> [--option <n>]`, `park` and `takeover` map to their kernel commands; `list` lists Changes.
  - It ends with the next command the kernel names (`next` of `change new`, the gate status of `change status`), so the user always sees the command to type.
  - `change new --inferred` stays a kernel call made by the skills that open a Change on the user's behalf (`cr`, `debugging`; T42), not a mode of this skill.
- **Layout**: stage skills live under `skills/stages/` (T02 section 13.1, R-2), added to the `skills` array of `.claude-plugin/plugin.json` (it adds to the default `skills/` scan; plugins reference, Fields). The v2 `skills/setup/` is removed in the same Change, so `/bdk:setup` resolves to exactly one skill.
- **Shared stage-skill contract**, written once and checked by content tests: the two context lines, `allowed-tools` with the node rule, the `/bdk:` namespace, no model names (P11), the refusal handling (exit 2 `instead`, exit 3 `--help`, `BDK STOP`), a closing render that names the next command, and the prompt-writing convention of `.claude/rules/prompt-writing.md`.
- **`ctx skill` manifest entries** for `setup` and `change` (`setup`: the current project commands; `change`: no part; design D5). The `kernel-cli/ctx` spec lists no entries, so it needs no delta.
- **Evals** (T41 scope, T40 harness): one promptfoo suite per skill on a fixture with a happy path and a reaction to a kernel refusal.
- **User documentation**: `docs/guide/getting-started/setup.md`, `reference/skills.md`, `reference/artifacts.md` and README's skill table describe the v3 `setup` and the new `change`.

## Capabilities

### New Capabilities

- `stage-skills`: the contract every stage skill keeps (frontmatter, context lines, kernel calls, refusal handling, closing render, size, invocation) and one requirement per stage skill, starting with `setup` and `change`. Later T41 Changes add `design`, `verify-design`, `plan`, `verify-plan`, `execute`, `close` and `run` to it.

### Modified Capabilities

- `kernel-cli/service`: `bdk import` removed; the `v2-layout` finding of `doctor` names `/bdk:setup` as its repair.
- `kernel-cli`, `kernel-cli/config`, `kernel-cli/hooks`, `kernel-cli/rules`, `kernel-settings`, `kernel-state`, `kernel-architecture`, `plugin-tooling`: every mention of `import` as a writer or repair now names `/bdk:setup` or is dropped.
- `skill-content-checks`: the user-only gate list gains `setup` and `change`; the 200-line limit and the `setup` portability exemption already apply by skill name.
- `skill-evals`: a stage-skill suite with happy path and refusal cases.
- `docs-site`: `getting-started/setup.md`, rewritten for v3, leaves the v2 banner.

## Impact

- New: `skills/stages/setup/` (SKILL.md, references/stacks.md, references/v2-migration.md), `skills/stages/change/SKILL.md`, `openspec/specs/stage-skills/spec.md`, the `stages` eval suite under `evals/suites/stages/`.
- Removed: `skills/setup/` (v2).
- Changed: `.claude-plugin/plugin.json`, `kernel/src/ctx/use-cases/manifest.ts`, `skill-check.config.ts` and its baseline (only shrinks), contract tests under `kernel/tests/contract/`, README, `docs/guide/`.
- No kernel command changes are planned; a gap found while writing the skills (for example a missing `--json` field the skill needs) is added here as a delta of its `kernel-cli/<group>` spec.
- Out of scope: `design`, `verify-design` (`v3-t41-design`), `plan`, `verify-plan` (`v3-t41-plan`), `execute` and the tree rule (`v3-t41-execute`), `close`, `run` (`v3-t41-close-run`), the `doctor` tools skill and the opening of an inferred Change from `cr` / `debugging` (T42).

## Decisions taken with the user (2026-10-01)

1. **Branch at `change new`.** The kernel binds a Change to the current branch. Before `change new` the skill always asks whether to create a new branch (`feat/<slug>`, `fix/<slug>` for `--kind bug`) or to stay on the current one, on every branch including the default one.
2. **`export agents` in `setup`.** Not run on Claude Code, the only 3.0 host: the adapters ship with the plugin (`agents/`), and an export into the project would register each one twice. The step belongs to the host notes of a non-Claude host (T50).
3. **Invocation.** `setup` and `change` are both user-only (`disable-model-invocation: true`). `cr` and `debugging` open an inferred Change through the kernel (`change new --inferred`), not through the skill.
4. **No `bdk import`.** The v2 to v3 migration is an instruction to the model inside `setup`, not a kernel command: it runs once per project, and a command with its own key mapping, output schema and tests costs more than it gives. The `import` stub leaves `schema/cli/commands.json` and the specs; `doctor` and `hooks session-start` name `/bdk:setup` as the repair; T32 keeps the Python cut and the cleanup.
5. **Evals.** Both promptfoo suites are built; this Change runs only `--probe`. The full measured series is T43's.
