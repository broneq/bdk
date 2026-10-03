## Context

See proposal.md (Why). The review process was decided with the user over four Lavish rounds on 2026-10-02/03 (`.lavish/t42-review-process.html`); the IDs below (A1, B1, R1-R3, C1, T, K, M, H, J, D1, E, S) are the ones of that page. Requirements: `specs/kernel-cli/review`, `specs/kernel-cli/dispatch`, `specs/kernel-cli/log`, `specs/kernel-cli/rules`, `specs/kernel-cli/evidence`, `specs/kernel-cli`, `specs/kernel-architecture`, `specs/kernel-pipeline`, `specs/kernel-state`, `specs/kernel-settings`, `specs/role-contracts`.

State the design builds on:

- `review` is a verdict node (`kind: review`, `budget: review-fix`) requiring `execute`, `simplify`, `tests-scoped`, `lint` and `spec-delta`; `gate:review` opens `close`. A verdict node passes on the latest `report` entry naming it, with a done report, no live `blocker` naming it and check `fresh`.
- `attempt open review-fix <change>` opens a round ticket on the Change and lists `steps` (simplify, tests-scoped, lint); budget 2, then the escalation ticket, then park; oscillation applies (`kernel-loops`).
- A ticket has one active package (`package` in the attempt record) that every ticket-keyed command (`dispatch show`, `rules show`, `log add`, `log ingest`, `evidence record`) resolves the role through; the orchestrator builds the next package only after the previous agent returned. One role package per ticket.
- Rule selection matches `applies` against the target's file set; the Change target has none, so every rule of the role's prefix set applies.
- `bdk measure` returns files, lines and modules for a range; v2 kept the review range and watermark in `scripts/bdk_run_state.py` (`resolve-range`, `review-done`), which T32 deletes.
- The `reviewer` adapter is Sonnet. The rules-noop M2 series measured a Sonnet reviewer's detection at 0.76 with rules (security 0.93, architecture 0.56), cost median $0.029 per run.
- Evidence kinds are any kebab-case name; the post-task step kinds live on the `post-task-step` base, one instance per plan part.

## Goals / Non-Goals

**Goals:**

- A review round of N parallel reviewers is one ticket, one budget step and one verdict, each reviewer with its own package, rules, entries and report.
- Everything a review skill needs that git or the ledger can answer (range, anchor, groups, coverage, verdict) comes from the kernel, testable without a model.
- Coverage thresholds are enforced by the kernel, never by an agent's claim.

**Non-Goals:**

- No skill behaviour: `cr`, `pr-review`, triage procedure, the fix loop and `/bdk:run` starting `cr` are `v3-t42-review-skills`.
- No human report, change map format, decisions per finding or tracker: `v3-t42-review-report`.
- No stateless PR review support in the kernel: `pr-review` on a branch without a Change does not use these commands (D1).
- No coverage of lines outside the Change's diff, no branch coverage.

## Decisions

### D1. Groups are sub-references of one ticket (A1)

`<ticket>@<group>` on every `--ticket`, `dispatch build --group`, one package and report per group, entries and manifests stamped with `group`.

- _One ticket per group_ lost: each would count against `review-fix` (budget 2), so a round of six groups would exhaust the loop before any fix; oscillation and the round model assume one ticket per round.
- _Several role packages under the active `package`_ lost: the active package is a single slot by design (T23-D42), and parallel agents would race on it.
- _A `review` loop separate from `review-fix`_ lost: two counters for one round, and the fix still needs the existing ticket's steps.

A group build never stamps `package`, so the fix implementer and the post-fix steps of the same ticket keep working through the active package unchanged. Entries keep `ticket` as the plain id, so `attempt close` fingerprints the whole round with no change.

### D2. The merged report is the verdict, under the reserved group `merge` (B1)

The orchestrator ingests the merged review with `log ingest --ticket <t>@merge` (no package, `role: orchestrator`) and records it with `log add report --ticket <t>@merge`, which stamps `head`. The `review` verdict accepts only such a report.

- _A `.bdk/cr/` file written by the skill_ lost: it needs `Write` in the skill, which blocks `/bdk:run` from starting `cr` (HOST-FACTS `skill-tool-disallowed`), and the kernel cannot see it.
- _Latest report of any group_ lost: the last reviewer to finish would decide the verdict.
- _A `merge` package built for the orchestrator_ lost: a package is an agent's input, and the orchestrator is not dispatched.

### D3. `bdk review plan` owns range and groups (R1, flags)

A new read-only `review` slice. Anchor: `--base` merge base, `--full` Change base, else the `head` of the latest `merge` report, else the Change base. Groups: plan parts intersected with the diff, `unplanned`, module split above `review.group.max-files`, module groups without a plan, then `integration`.

- _Keep the watermark in a machine file_ lost: not committed, so it differs per machine and disappears with T32's script; the `merge` report is already committed state.
- _Let the skill compute groups from `bdk measure`_ lost: grouping by plan part needs the plan parts and `Files:`, which skills read only through the kernel, and a deterministic function is testable.
- _Fixed file-count chunks_ lost: the user's rule is the logical group first, ~30 files as a soft cap.

The Change base is the parent of the commit that added `change.md`: no new field in `change.md`, which is written once and must not change, and it is derivable on any clone. `--inline` from the T42 scope needs no kernel support: the skill runs the same packages in-session.

### D4. Full gate as two change-level nodes (R2)

Kinds `tests-full` and `lint-full` on a new `change-check` base, one node each, target the Change, required by `review`, done from fresh evidence.

- _One `full-gate` kind_ lost: lint and tests fail for different reasons and the runner records them separately, as for the post-task steps.
- _Reusing `tests-scoped` with the Change as target_ lost: `tests-scoped` instances are per part and their freshness is per part tree hash.
- _`typecheck-full`_ not added: projects configure type checks as `tools.lint` entries of tier `typecheck`, which `lint-full` runs.

The Change tree hash is the existing one: every part's executable `Files:` plus build config. A file outside every `Files:` does not stale the gate; the integration reviewer reports such files (R1), so the gap is visible.

### D5. Coverage verdict computed by the kernel

`bdk evidence coverage` parses lcov or Cobertura, intersects with the lines added against the Change base, and decides `pass` or `fail` against `coverage.min`. `tests-full` needs a passing fresh coverage manifest for every entry with `min`.

- _Runner records the number with `evidence record --verdict`_ lost: an agent could claim a pass, and a citation proves only that a number exists, not that it meets `min`.
- _Whole-project coverage_ lost: the user wants a threshold the Change itself can meet; legacy code would block every Change.
- _More formats (JaCoCo, Clover, Istanbul JSON)_ deferred: lcov and Cobertura are emitted by the common tools of every listed language (vitest, jest, c8, coverage.py, go test via gocover-cobertura, cargo-llvm-cov, JaCoCo's Cobertura export); a new format is a parser and a `format` value.
- Files the report does not list go to `unmeasured` instead of counting as 0 %: a report covering only `src/` would otherwise fail every Change that touches a config script.

### D6. Triage level is a field, set by its own command (T)

`level` on `finding`, `blocker` and `observation`, written in place by `bdk log triage`, `not-a-problem` also resolving.

- _A new entry type `triage` referring to the finding_ lost: every reader would join two entries; the verdict check and the report need the level on the entry.
- _Reuse `severity`_ lost: severity is the writer's judgement of the defect; level is the orchestrator's judgement of what the project does with it, and the user asked for both to exist.
- _Set by `log add --level`_ lost: the reviewer would set its own level, which is exactly what triage corrects.

The verdict requires every entry of the round to be triaged, so a skill that skips triage cannot pass review.

### D7. `review.risks` as model instructions merged by id (K)

Five defaults in the kernel's settings registry, merged by id, `enabled: false` to turn one off; embedded in the integration reviewer's package.

- _Path globs_ lost: the user asked for instructions, since risk is semantic (who may call an endpoint) more than positional.
- _A rule pack category_ lost: rules are about how code is written; a risk is something to call out, not a violation.

### D8. A tenth role, `integration-reviewer`, on `reader` (R3)

- _`reviewer` with a model override in the package_ lost: `model` in a package is the escalation mechanism guarded by `guard/escalation-model`; reusing it would blur that guard.
- _`reviewer` moved to `reader`_ lost: part reviewers stay on Sonnet until measurement M (`v3-t42-review-skills`) says otherwise; the rules-noop numbers show Sonnet strong on local defects and weak on architecture, which is the integration reviewer's job.

Its prefix set is `ARCH`, `SEC`, `TQ`: the cross-cutting rules; `CQ` and `DP` are local and belong to part reviewers.

### D9. Grouped runner runs the full checks

A runner package built with `--group` on a `review-fix` ticket gets `tests-full`, coverage and `lint-full` checks; an ungrouped runner on the same ticket keeps the post-fix `tests-scoped` and `lint` steps. One role, two check sets chosen by the presence of a group, so no new role and no flag.

- _A `--checks full` flag_ lost: one more argument whose only valid combination is already implied by `--group`.

## Risks / Trade-offs

- [The `merge` report is the only delta anchor; an aborted round leaves none] → the next run reviews from the previous anchor or the Change base, which is wider but correct.
- [Suffix path matching could map a report path to two changed files with the same tail] → the longest repository-relative match wins; a tie is listed under `unmeasured`, never guessed. Unit tests cover the tie.
- [Group packages for 30 files near the 12 KB limit] → files are listed one per line (about 40 bytes each); rule texts are not embedded, only ids; `policy/package-too-large` still guards and the scenario test builds a 30-file group.
- [Stale `tests-full` after every fix makes each review round re-run the full suite] → intended: the gate is the end-of-plan full run (`.claude/rules/verification-scoping.md`), and a fix round is rare (budget 2).
- [`level` is a second mutable field on an entry] → one writer, append-only reason line in the body, covered by the two-branch merge test like `log resolve`.
- [`review.risks` defaults in English only] → instructions are for a model; projects override per id.

## Migration Plan

No user-visible migration: v2 `cr` keeps working until `v3-t42-review-skills` replaces it. The new pipeline nodes make `review` require `tests-full` and `lint-full`, so a Change in the review stage while this ships needs a gate runner before its verdict; no such Change exists outside the evals, whose seeds stop before review. The state schema version stays: every new field is optional, and `review` verdicts written before this Change cannot exist in v3 (no skill writes one yet).

## Open Questions

- Default `review.group.max-files` of 30 is the user's working number; measurement M in `v3-t42-review-skills` may move it without changing these specs.
