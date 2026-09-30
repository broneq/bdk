# Design: v3-t31-rules-ids-funnel

## Context

See proposal.md, Why, for the motivation and the user decisions of 2026-09-30 that narrow the plan's scope.

State the design starts from:

- 131 bullets in nine files (`rules/*.md`, `rules/languages/*.md`); the plan's figure of 162 is outdated.
- T40 measured every bullet (`docs/V3-EVAL-RULES-NOOP.md`, rows in `evals/results/rules-noop/`): 59 no-op candidates (44 measured in M2, 15 not seedable), 55 unclear (14 of them with detection 0 in both cells), 13 effective, 4 correcting the model; a judge spot-check with corrections that change 4 classes.
- The contracts already exist and are changed here, not invented: `kernel-cli/rules` (eight commands, owner T31), the rule frontmatter and `learning` type (`kernel-state`, T14), the `rules.*` keys (`kernel-settings`, T12), `log route` (`kernel-cli/log`).
- The kernel today: `kernel/src/rules/` selects whole categories per role (`use-cases/selection.ts`) and resolves them as prompt values; `dispatch build` hashes the texts and names `bdk rules show --ticket`; `ctx` renders `rules` and `language-rules` parts from the prompt values; `change close` emits empty `learning` lists; `rules show <id>` answers `kernel/not-implemented`; the `rules.*` keys sit in `PLANNED_KEYS` (`kernel/src/shared/config/known.ts`).
- `shared/store/glob.ts` is the kernel's glob matcher, already used for `do-not-touch`; the runtime dependencies are `yaml` and `zod` only.
- The drift hook is gone (T24).

## Goals / Non-Goals

**Goals:**

- Every rule an agent receives has an id, and the package records which ids it received.
- A task receives only the rules of its role that apply to its files.
- The shipped pack keeps only what changes model behaviour, by the measured policy.
- No automation writes a rule; the kernel side of the audit (raw data, exact recurrence, adoption) exists for T42's audit skill.

**Non-Goals:**

- Grouping lessons by meaning in the kernel. A fingerprint groups near-identical wording only; meaning is the audit skill's job (T42), where a model runs.
- Proposing rules at `close`, the T5 rerun of a failed attempt, the authors count (user decision 2026-09-30).
- Automatic `learning` capture by `execute` on failed attempts. Failed attempts already leave findings in the attempt record, which the audit view reads; a second automatic writer would duplicate them.
- Cross-project aggregation (Q-4 left it open).

## Decisions

### D-1 A rule is a choice; two kinds

A rule is a choice among valid alternatives (`house`), or a fact that corrects the model (`knowledge`, with `source` and `verified`). System facts and process lessons are not rules (`rule-pack`, What a rule is). The definition lives in three places that say the same thing: `.claude/rules/quality-rules.md` (dev convention), `rules/README.md` (shipped next to the pack) and the user guide page on rules; T42's audit skill uses it as its admission question, replacing the four-question test of `rule-admission.md` (durability, decision, visibility, derivability), whose "decision" question it keeps as the core.

- Alternative: keep T5's `house | knowledge` split without a definition. Lost: T5 says what to measure, not what may be proposed, and the audit needs a question it can ask of a candidate.
- Alternative: admit system facts as `house` rules (the D2a risk note: "project rules must be able to be system-specific"). Lost on the user's definition; D2a's concern is met because a system-specific _choice_ ("in this service, writes go through command handlers") is a `house` rule scoped with `applies`.

### D-2 Pruning policy for the shipped pack

Per T40 bullet, after applying the spot-check corrections of `docs/V3-EVAL-RULES-NOOP.md`:

1. Classify the bullet `house`, `knowledge` or not a rule (D-1). Classification is a judgment: the implementing agent proposes it in the migration report and the user reviews the report before any pack file is written (tasks, group 2).
2. Not a rule: removed.
3. `knowledge`: kept only when M1 is WRONG, MISSED or MIXED for Haiku or Sonnet; otherwise removed.
4. `house`: removed when it is one of the 44 measured no-ops (M1 COVERED for both, M2 no measurable difference, `without` mean detection >= 0.8); otherwise kept. The 15 not-seedable no-op candidates are kept when `house`, because M2 never tested them.
5. The 14 unclear bullets with detection 0 in both cells get fixed seeds first and are re-measured (M2 only, cells `with`, `with-prime`, `without`, 5 runs each); their class is recomputed with T40's rule before step 4 applies.

Removed bullets get no number, so no tombstone exists for them (T5). Kept bullets are numbered per prefix in their original file order.

- Alternative: remove all 59 no-op candidates. Lost (user): 15 of them were never tested by ablation.
- Alternative: remove by file (the file-level gap 0.25 vs noise 0.08 is the strongest signal). Lost: it would drop the 13 effective bullets with their files, and T5 decided per bullet.

### D-3 The pack is per-rule files in the plugin, read live

`rules/<category>/BDK-<PREFIX>-<n>.md` and `rules/languages/<name>/BDK-<PREFIX>-<n>.md`, the same frontmatter as project rules (`origin: bdk`). The kernel's rule store reads the bundle directory and `.bdk/rules/` with one parser and one schema; `rules.disabled` switches bundle rules off per id.

- Alternative: keep the nine category files with `[CQ-4]` bullets and parse bullets. Lost: two formats and a bullet parser, and T14 already fixed "id equals the file name".
- Alternative: copy the pack into `.bdk/rules/` at `setup` (Q-6's wording). Lost (user): copies drift from plugin upgrades, and a tombstone added upstream never reaches the project.

### D-4 Rules stop being prompt values

The prompt keys `rules/<category>` and `rules/languages/*` are unregistered; a project adds rules as files and disables BDK rules by id. A file left at `.bdk/prompts/rules/security.md` gets `policy/unknown-config-key` with a `why` pointing at `.bdk/rules/` and `rules.disabled`, which also covers T32's import (v2 `quality` overrides are rewritten as project rules by `rules import` of the converted text).

- Alternative: keep `extends | replace` per category next to rule files. Lost: text appended to a category has no ids, so it can be neither selected by `applies` nor cited, which is the point of T31; two override mechanisms for one thing.

### D-5 Selection

Implemented once in the `rules` slice and used by `dispatch build`, `rules explain` and `ctx`:

- Candidates: bundle and project rules, minus tombstones and `rules.disabled`; a language pack only when its name is in `languages`.
- Role: a rule's `roles` when set; otherwise the role's prefix set held in the kernel (today's category map expressed as prefixes, plus `PL` for `verifier`); project rules without `roles` go to every role that reads rules (`runner` and `scout` read none).
- File set: task `Files:`; part = union of its tasks' `Files:`; artifact or Change target = none, and then `applies` does not narrow (dropping every scoped rule for a design verifier would silently lose the project's rules).
- Match: `shared/store/glob.ts`, repository-relative paths; a rule applies when any file matches any glob.
- Order: global first; then specificity of the best matching glob, measured as the number of path segments without a wildcard, then the number of literal characters; then `since`; then id. Deterministic, so the package and `template-hash` are stable.
- Cap: `rules.max-per-package` (20); dropped rules are counted, not listed, in `rules-truncated`.
- The package stamps `rules` (ids) and `rules-truncated`; `rules show --ticket` prints those ids with their current text. The package is thus the record of what the agent was given (P10).

- Alternative: recompute the selection in `rules show --ticket`. Lost: a rule edited or disabled between `dispatch build` and the agent's read would make the package, its hash and what the agent saw disagree.
- Alternative: a per-rule priority field instead of specificity. Lost: one more field to maintain; specificity follows from `applies`, which the author writes anyway.
- Alternative: T02's `severity: must | should`. Kept T14's `critical | high | medium | low` instead: T14 is the accepted schema, and the four levels match finding severities, so a finding can inherit its rule's severity.

### D-6 Minimal funnel: capture, audit view, adoption

- Capture: `bdk log add learning <summary> [--applies <glob>]` (the flag defaults to the ticket task's `Files:`), plus the findings verifiers and reviewers already write and the findings in attempt records. No new writer.
- Audit view: `bdk rules stats` lists fingerprints recurring in at least `rules.audit.min-changes` (3) distinct Changes, the raw `learning` / `finding` / `blocker` entries and attempt findings of every Change including the archive (`--entries`), and citations by id. The index gains a `findings` table (attempt findings) and `applies` / `evidence` columns; `routed_to` goes (index schema 5, rebuilt automatically).
- Adoption: `bdk rules accept <text> --prefix <P> [--from <ref>]...`, orchestrator-only, no active Change needed, writes the next free number, `origin` and `evidence` from `--from`, then regenerates the projection. It never runs a model and proposes nothing.
- Removed: `rules add`, `log route`, the `routed` status and `routed-to`, the close-time `learning` output, `rules.propose-when.*`, `rules.max-learnings-per-change`. None shipped in a release, so no compatibility shim.

- Alternative: the plan's funnel (thresholds at `close`, T5 rerun, user accepts at close). Lost (user): it acts inside the task, an authors count never fires for a single developer, and the rerun needs a worktree at the failed attempt's base, a dispatch and model time on every proposal.
- Alternative: keep `rules add` as a lesson writer. Lost (user): its name promises a rule; `log add learning` already exists.

### D-7 Projection for the main session

`rules export --claude` writes `.claude/rules/bdk-generated.md` (global project rules, no `paths:`) and `.claude/rules/bdk-generated-scoped.md` (scoped project rules, `paths:` = sorted union of their `applies`). Only project rules are projected. Regenerated by `accept` and `import`; `--check` (reusing `policy/generated-drift`) catches hand edits, and `doctor` reports it.

- Alternative: one file with `paths:` = union (the plan's wording). Lost: a global rule inside a scoped file would load only when a scoped path is touched.
- Alternative: one file per rule. Lost: dozens of host files for a projection nobody edits; the union is already what the acceptance signal checks.
- Alternative: project the BDK pack too. Lost: it would load into every main-session turn, and the orchestrator does not write code (`execute` has no Edit/Write, P9); agents get the pack through packages.
- Alternative: regenerate at `close` (Q-6). Lost: rules change only through `accept`, `import` or a hand edit, so `close` would regenerate nothing, and the user decided nothing happens at `close`.

### D-8 Import

`rules import` turns each top-level bullet of a `.claude/rules/*.md` file into one rule (prefix from the file name, `applies` from `paths:`, global without `paths:`, `kind: house`, `severity: medium`), and a file without bullets into one rule. It never judges content; `doctor` then warns about hand-written files left without an id.

- Alternative: one rule per file. Lost: a v2 rule file holds several independent conventions, and a single id could not be cited precisely.
- Alternative: skip files without `paths:`. Lost: they are the project's global conventions, the most important ones to keep.

### D-9 Citations

A citation is a `refs` item of an entry that parses as a rule id (the ref grammar of `kernel-state` already accepts rule ids). Role contracts tell six roles to cite; `rules stats` counts citations per id and distinct Changes; `rules prune --uncited` uses the last `rules.prune.uncited-changes` (20) Changes and stays silent until that many exist.

### D-10 `rules` becomes a leaf slice

With `rules add` gone, `rules` needs no `log` import: it reads rule files itself and reads the index, packages and attempt records through `shared/store`. The dependency matrix changes its row to `shared` only.

### D-11 Measurement is repeatable

The measurement is a harness run, not a one-off script: the T40 suite gains a patch filter so a subset (the 14 re-seeded bullets now, a new language pack later) can be measured; after the migration the suite reads bullets from the per-rule pack. Every run follows `evals/README.md`: `--probe` first, then the full series only after the user approves its projected cost.

### Resolution of "To resolve in the spec"

| Item                              | Resolution                                                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "COVERED" thresholds              | T40's classes with the spot-check corrections (M1 strict majority of 5 runs per model, judged by Sonnet 5; M2 by the T03 D-7 difference rule), then D-2. |
| Default `rules.propose-when.*`    | Dropped; `rules.audit.min-changes: 3` (distinct Changes) replaces them (D-6).                                                                            |
| Fingerprint normalisation         | T14's normalisation unchanged; grouping by meaning is the audit skill's (T42), fed by `rules stats --entries`.                                           |
| Glob specificity ordering         | D-5.                                                                                                                                                     |
| Role -> rule set mapping          | D-5: today's category map as prefixes, `PL` for `verifier`, `roles` overrides, project rules to every rule-reading role.                                 |
| Measurement one-off or repeatable | Repeatable through the harness (D-11); mandatory for new language packs (`rule-pack`, Pack admission).                                                   |
| `rules import` without `paths:`   | Global rules (D-8).                                                                                                                                      |

## Risks / Trade-offs

- [The house/knowledge classification of 131 bullets is a judgment and decides removals] -> the migration report is reviewed by the user before any pack file is written; every row names its reason.
- [The re-measurement costs model time] -> probe first, full series only after the user approves the projection; limited to the 14 patches' bullets.
- [Recurrence by exact fingerprint rarely fires, so `recurring` may stay empty] -> accepted: `recurring` is a cheap first signal, the audit skill works from `--entries`.
- [`rules.max-per-package` truncates silently for agents] -> `change status` lists truncated tickets and `rules explain` shows which rules fall beyond the cap.
- [Removing the rule prompt keys breaks projects that already override `rules/<category>`] -> v3 is unreleased; the refusal names the replacement, and T32's import converts v2 `quality` overrides.
- [An artifact target (design verifier) has no file set, so every scoped rule reaches it] -> bounded by the cap and by roles; the alternative (none) loses project rules silently.
- [A parallel `rules accept` of the same prefix on two branches creates the same file] -> the permitted add/add conflict of `kernel-state`; `rules check` on CI names both, the later one renumbers.

## Migration Plan

1. Measurement first, on the current layout: fix the 14 seeds, add the suite's patch filter, probe, re-measure after approval.
2. Write `docs/V3-RULES-MIGRATION.md`; the user reviews the classification.
3. Kernel: rule store, selection, commands, contract and schema changes, test-first; `schema/` and `dist/` regenerated.
4. Pack: write per-rule files from the reviewed report, delete the nine category files, point the eval suite at the new layout.
5. Content: role contracts, `rules/README.md`, `.claude/rules/quality-rules.md`, user guide, `ctx` manifest (`rules("plan")` for `create-plan`, `project-rules` for `create-plan` and `design`).

Rollback: the Change lands as one PR into `staging/v3`; reverting it restores the category files and the prompt-value path together, because the kernel and the pack change in the same PR.
