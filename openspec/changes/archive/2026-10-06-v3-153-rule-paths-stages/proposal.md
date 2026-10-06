# Proposal

## Why

Scope: #153. Tracks #153.

Which rule reaches which role, skill or pipeline node is decided today by three kernel tables, not by the rule: `ROLE_PREFIXES` maps each role to pack prefixes, the `ctx` manifest gives `/bdk:design` and `/bdk:plan` whole pack categories plus every project rule, and a pipeline node names pack categories in `nodes[].rules`. A project rule without `roles` goes to every role that reads rules, and a target without files ignores `applies` altogether. A project that adds many rules floods every package: in a real project one file selected 340 of 609 project rules for `implementer`. A project author also cannot see from a rule file where it will be used, and cannot say "this rule matters when planning and reviewing E2E tests, not when designing".

The fix is that every rule declares where it applies, explicitly, and the kernel selects by that declaration only.

## What Changes

- **BREAKING** Rule file frontmatter (`kernel-state`, Rule file frontmatter): `applies` becomes `paths`, required and non-empty (`["**"]` means every file); `roles` becomes `stages`, required and non-empty, values `design`, `plan`, `execute`, `review`. These are the pipeline stages of `pipeline/pipeline.yaml` that read rules, under the same name. Both fields are explicit: nothing is global because a field was left out, and `stages` has no wildcard. No migration: v3 is unreleased, and a rule file with `applies` or `roles` fails `bdk rules check` with `policy/rule-format` naming the new fields, as #152 does for `origin: import`.
- One stage table in the kernel names the readers of each stage, so the writer and the checker of a stage read the same rules:

  | `stages`  | session skills (`ctx`)    | pipeline nodes        | agent roles                                       |
  | --------- | ------------------------- | --------------------- | ------------------------------------------------- |
  | `design`  | `/bdk:design`, `/bdk:adr` | nodes `stage: design` | `design-verifier`                                 |
  | `plan`    | `/bdk:plan`               | nodes `stage: plan`   | `verifier`                                        |
  | `execute` | -                         | -                     | `implementer`, `simplifier`                       |
  | `review`  | -                         | -                     | `reviewer`, `integration-reviewer`, `pr-reviewer` |

  `runner`, `scout` and `lead` read no rules, as today.

- Selection (`kernel-cli/rules`, bdk rules show, Selection) reads `stages` through the table. The role prefix sets and the project-rule fallback are removed.
- `bdk ctx skill` (`kernel-cli/ctx`): the part kinds `rules`, `language-rules` and `project-rules` are replaced by one `rules` part that renders the stage's selection.
- **BREAKING** `nodes[].rules` of the pipeline file (`kernel-pipeline`) is removed. The "Rules" section of a node's instruction is the selection for the node's `stage`.
- **Behaviour change** `paths` on a target without files (design, plan, an artifact, the Change, a pipeline node, a session skill): a rule is selected when its globs match at least one file of the work tree, instead of always. Task and part targets keep matching the task's `Files:`.
- The shipped pack: every `BDK-*` rule declares `paths` and `stages`. A category's stages are every stage in which some reader reads it today:

  | category                            | `stages`                              |
  | ----------------------------------- | ------------------------------------- |
  | `architecture` (`ARCH`)             | `design`, `plan`, `execute`, `review` |
  | `security` (`SEC`)                  | `design`, `execute`, `review`         |
  | `engineering-judgment` (`EJ`)       | `design`, `plan`                      |
  | `plan` (`PL`)                       | `plan`                                |
  | `test-quality` (`TQ`)               | `plan`, `execute`, `review`           |
  | `code-quality` (`CQ`)               | `plan`, `execute`, `review`           |
  | `design-patterns` (`DP`)            | `execute`, `review`                   |
  | `languages/*` (`JS`, `TS`, `REACT`) | `plan`, `execute`, `review`           |

  Readers that gain rules by the symmetry: `/bdk:plan` gains `ARCH` and `CQ`; `verifier` gains `CQ` and the language rules; `/bdk:design` gains `SEC`; `/bdk:adr` gains `EJ` and `SEC`; `integration-reviewer` gains `CQ`, `DP` and the language rules; the `plan` node gains `EJ` and the language rules. Language-pack rules get `paths` by their file extensions, and `languages` still switches a pack on.

- `bdk rules accept`: `--applies` becomes `--path`, `--role` becomes `--stage`; both repeatable and required.
- `bdk rules explain`, `rules prune` (`no-match`), `rules show --role` and `hooks session-start` (`rules.warn-above`) follow the new fields. `rules show --role` stays the agent-facing form; agents keep asking by role.
- `/bdk:rules` proposes `paths` and `stages` for each candidate; the guide and the rule authoring convention of this repository describe the two fields and the stage table.

Out of scope: `.claude/rules/`, `rules import` and `rules export`, removed by #152; a cap on selected rules (design D-5 of the T31 change keeps "no cap").

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-state`: Rule file frontmatter (`paths`, `stages`).
- `kernel-cli/rules`: Selection in bdk rules show, bdk rules explain, bdk rules prune, bdk rules accept (flags), bdk rules check (missing fields).
- `kernel-cli/ctx`: bdk ctx skill part kinds.
- `kernel-pipeline`: the pipeline file loses `nodes[].rules`; the Instruction's "Rules" section comes from the node's `stage`; the plan rules scenario.
- `kernel-cli/dispatch`: bdk dispatch build scenarios that select rules by `applies` and `roles`.
- `kernel-cli/hooks`: bdk hooks session-start, the `rules.warn-above` count per role.
- `rule-pack`: Pack layout and the lockfile rule scenario (`paths`, `stages`).
- `kernel-settings`: `languages` text and the `language-rules` row of Removed v2 keys.
- `tools-skills`: the rules skill proposes `paths` and `stages`.
- `kernel-architecture`: the `rules` slice row (`paths` and `stages` selection).

## Impact

- Code: `kernel/src/shared/store/state/rule.ts`, `kernel/src/rules/use-cases/selection.ts`, `context.ts`, `load.ts`, `accept.ts`, `prune.ts`, `explain.ts`, `kernel/src/rules/commands/rules.ts`, `kernel/src/ctx/use-cases/manifest.ts` and `parts.ts`, `kernel/src/graph/use-cases/instruction.ts` and `pipeline.ts`, `pipeline/pipeline.yaml`.
- Data: every file under `rules/` (about 90 `BDK-*` rules) gains `paths` and `stages`; test fixtures with rule files.
- Schemas: rule file JSON Schema, the pipeline file schema, and the output schemas that carry `applies` or a part list: `rules-show.json`, `rules-explain.json`, `ctx.json`.
- Skills and docs: `skills/tools/rules/SKILL.md`, `docs/guide/concepts/quality-and-language-rules.md`, `docs/guide/workflows/rules-hygiene.md`, `rules/README.md` (the pack convention, which gains the two fields).
- Order: #152 landed first (PR #154). The spec deltas of this change start from the `kernel-cli/rules` and `kernel-state` text after it.

## Resolution of "To resolve in the spec"

| Item                                                 | Resolution                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does `languages` still gate the language packs?      | Resolved (user decision 2026-10-06): keep it. `languages` switches a pack on ("this project uses React"), `paths` narrows its rules to files. File extensions cannot tell React from Preact or Solid in a `.tsx` file, nor React in a plain `.js` file.                                                                 |
| A wildcard for the stages field                      | Resolved (user decision in the brainstorm): none, the explicit list is the readable form. `paths` uses the glob `**`. The field is named `stages`, the vocabulary of the pipeline file (user decision 2026-10-06).                                                                                                      |
| Rename `applies` everywhere or only in the rule file | Resolved (user decision 2026-10-06): rule file and `rules` commands only. The `applies` of a `learning` ledger entry names the files a lesson is about, a different object, and renaming it is a ledger schema migration with no reader gain.                                                                           |
| Source of "tracked files" and its cost               | Resolved (user decision 2026-10-06): the work tree files `git ls-files` already gives `rules prune` (tracked plus untracked, ignored files such as `node_modules/` excluded), read once per command that selects for a target without files and matched in memory; a budget in `pnpm test:perf`. Detailed in design.md. |
| `rules show --role` versus a stage flag              | Resolved: keep `--role`. Agents know their role; the kernel translates it to a stage.                                                                                                                                                                                                                                   |
| Migration of existing project rules                  | Resolved: none, as in T31 (D-6: nothing shipped in a release, so no compatibility shim) and #152. `bdk rebuild` is Change-scoped and never reads `.bdk/rules/`; an old rule file fails `bdk rules check` with `policy/rule-format` naming `paths` and `stages`, and the user edits it.                                  |
