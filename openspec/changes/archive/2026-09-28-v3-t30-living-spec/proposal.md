# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T30. Tracks #57.

The living spec is the second half of D2: a Change describes the behaviour it adds in spec deltas, and at `close` the kernel folds them into `.bdk/specs/` so the next Change starts from the truth. Today the contract exists only on paper: `spec delta check`, `spec merge`, `spec diff` and `change close` answer `kernel/not-implemented`, the `spec-delta` kind only checks that its files exist, a plan part's `spec-impact` is not validated beyond file presence, and a Change can never be archived. T41's `close` stage skill needs all of it. Input carried over by citation: design "Spec handling (D2, D2a, D2b, C1-C3)", decisions D2, D2a, D2b, report C1-C3, V1-7 (merge through `node:fs`, hash-detected manual edits), risk "Spec merge conflicts" (refuse, show both, model consulted only then, close blocked), risk "Behaviour-only spec leaves patterns to rules" (unchanged: rules stay T31's), T02 decision Q-1 (no OpenSpec runtime dependency), T23-D12 / D53 (archive prune, `archive.keep-evidence` owned by T30).

The user took four decisions on 2026-09-28 (conversation before this proposal): one Change for all of T30; merge conflicts detected per Requirement against archived Changes closed after this Change was created, resolved by a `decision` entry; a single scenario is removed by listing it under the requirement in `## REMOVED Requirements`; `--squash` and `policy.checkpoint.squash-at-close` leave the v3.0 contract.

## What Changes

- New `spec` slice with three commands implemented to the existing contract:
  - `bdk spec delta check [<capability>]` validates every delta of the active Change (or one): the exact `#### Scenario:` prefix, a `**WHEN**` and a `**THEN**` bullet in every scenario, the configurable normative word (`spec.normative-word`, default `SHALL`) in every requirement statement, at least one scenario per added or modified requirement, known section names, no duplicate requirement, MODIFIED and REMOVED naming requirements that exist, and no silent scenario loss (a scenario of the current requirement missing from its MODIFIED block and not listed under REMOVED is `scenario-lost`, an ERROR).
  - `bdk spec merge [--dry-run]` deterministically applies the Change's deltas to `.bdk/specs/<capability>/spec.md` through `shared/store` (`node:fs`, outside every tool hook, V1-7): by Requirement name, ADDED appended in delta order, MODIFIED replaces the whole block, REMOVED drops a requirement or only the scenarios listed under it, an optional `## Purpose` section replaces the purpose. Each written file carries `bdk-merge-hash` and `bdk-change` in its frontmatter. Idempotent: a second run writes the same bytes. Refuses a file whose body no longer matches its hash (`policy/merge-hash-mismatch`), an invalid delta (`policy/spec-invalid`) and a conflict (`policy/spec-conflict`); `--dry-run` lists the conflicts with both texts instead of refusing.
  - `bdk spec diff [<capability>]` previews the merge per requirement.
- Conflict rule (user choice): a requirement is in conflict when an archived Change closed after this Change was created touched the same requirement of the same capability with a different text, and this Change's ledger holds no `decision` entry whose `refs` name that Change and the capability's delta. `ours` and `theirs` are the two delta blocks.
- **BREAKING (contract only):** spec delta files are nested by capability path: `spec-delta/auth/login.md` for `auth/login`, the same path as `.bdk/specs/auth/login/spec.md`, instead of a flat slug. The layout table, the plan part check and the `spec-delta` kind follow.
- The `spec-delta` kind's validator runs `spec delta check` (T30 adds "delta semantics" as `kernel-pipeline` foresaw); the `plan-part` validator requires that every capability in `spec-impact` has a delta that passes the same check. `spec-impact` becomes optional in a plan part: absent means `none` for the `tiny` and `small` profiles and fails the part check for `large`.
- `bdk change close [--dry-run]` implemented: requires `gate:review` done (`policy/gate-not-ready`), no open ticket, no trailer mismatch, no git operation in progress; runs the merge (refusals as above); writes the `close` transition; prunes `dispatch/` and `reports/` unless `archive.keep-evidence`; moves the Change to `.bdk/changes/archive/<id>/`; drops the branch marker; commits `.bdk/specs/` and both Change paths with a pathspec commit `chore(bdk): close <id>`; prints the PR summary from the ledger and the gates passed by policy. `--dry-run` writes nothing. Learning routing and `.claude/rules/bdk-generated.md` stay T31's: until then the `learning` lists are empty.
- **BREAKING (contract only):** `change close --squash`, its `squashed` output field and the planned key `policy.checkpoint.squash-at-close` are removed (user choice); a squash merge of the PR does the same without rewriting commits that trailers and attempt records name. `change close` gains the rules `policy/spec-invalid`, `policy/git-in-progress` and `policy/git-hook-failed`; `archivedTo` is `.bdk/changes/archive/<id>/` (the id already starts with the date).
- `bdk doctor` reports a `merge-hash` finding (level `fail`, one per file) for every `.bdk/specs/**/spec.md` whose body does not match its `bdk-merge-hash` or that has none; it never refuses, so `policy/merge-hash-mismatch` leaves its record.
- Settings: the `spec` module (`spec.normative-word`, consumer `spec`) and the `archive` module (`archive.keep-evidence`, consumer `change`) are registered.
- Store: a `move` primitive for the archive, and the living spec's read and write helpers stay inside the `spec` slice on top of `shared/store`.
- Contract test: `openspec validate --specs --strict` accepts the `.bdk/specs/` that the E2E merge produces (CI installs `@fission-ai/openspec@1.13.2`; locally the test runs when `openspec` is on `PATH`).

## Capabilities

### New Capabilities

None. The delta and living spec formats are state documents (`kernel-state`); the commands and the merge algorithm are `kernel-cli/spec`.

### Modified Capabilities

- `kernel-cli/spec`: the three commands specified in full (delta grammar checks, merge algorithm, conflict rule, idempotence, hash, diff) with the acceptance scenarios.
- `kernel-cli/change`: `change close` specified in full; `--squash` removed; new rules.
- `kernel-cli/service`: `doctor`'s `merge-hash` finding; the refusal rule leaves the record.
- `kernel-cli`: rule table rows of `policy/spec-invalid`, `policy/spec-conflict`, `policy/merge-hash-mismatch`, `policy/git-in-progress`, `policy/git-hook-failed` name their real emitters.
- `kernel-state`: Change directory layout (nested delta path, archive location), new requirements Spec delta and Living spec file, Plan part (`spec-impact` optional), Write map (`.bdk/specs/` and the archive move).
- `kernel-loops`: Plan part checks (`spec-impact` delta must pass the delta check; absent in `large` fails).
- `kernel-pipeline`: Artifact kinds (`spec-delta` validator runs the delta check over nested files).
- `kernel-settings`: `spec.normative-word` and `archive.keep-evidence` registered, `policy.checkpoint.squash-at-close` removed, scenarios that used it as the planned-key example move to a T31 key.
- `kernel-architecture`: `graph` imports `spec`; T30 registration scenario.

## Impact

- Kernel: new `kernel/src/spec/` slice (parser, delta checks, merge, hash, diff, conflict detection, config module); `graph` view and kinds call the delta check; `change` gains `close` and the `archive` module; `service` doctor finding; `shared/store` `move` and nested `spec-delta` layout pattern; `shared/config/known.ts` loses the squash key; command index, output schemas (`spec-*`, `change-close`, `doctor`), `dist/bdk.mjs` rebuilt.
- CI: `.github/workflows/tests.yml` installs the OpenSpec CLI for the contract test.
- Tests: unit tests per slice layer, E2E per exit code and rule, the six acceptance scenarios end to end, the OpenSpec contract test.
- Out of scope: the `PreToolUse` guard on `.bdk/specs/` (T24); learning routing, `rules export` and `.claude/rules/bdk-generated.md` (T31); the `close` stage skill (T41); migrating BDK's own `openspec/specs/` into `.bdk/specs/` (decided in T50, as the plan's note on the seam says; T30 proves format compatibility only).
