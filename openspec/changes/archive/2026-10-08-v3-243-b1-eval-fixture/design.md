# Design

## Context

What exists:

- Shared fixtures (#189, spec `skill-evals`, "Shared fixtures"): bash scripts under `plugins/bdk/evals/fixtures/` that build a workspace from files and git state, offline, in under 120 s; `plugins/bdk/tests/evals.test.ts` runs every one of them in CI. `ledger-change.sh` (#191) is the ready-to-plan pattern: `tiny-ledger`, `.bdk/settings.yaml`, the BDK schema copied from the plugin, one Change with proposal, spec delta and design, one commit.
- The approval records the blocks read: `/bdk:design` (#198) treats `.bdk/runs/<change>/design/gate.md` with `Gate: approved` and a `Report:` line naming the last passing `verify-N.md` as an approved design. `verify-plan` (#191) writes `.bdk/runs/<change>/plan/verify-N.md` with the D6 body; `bdk run status` (#188) passes the plan when the last one reads `Verdict: PASS`. `/bdk:plan` (#199) is not merged.
- `bdk plan check` (#185): default part limits 5 tasks, 10 files, 8192 bytes; it reports parts, waves and problems (overlap in a wave, a `shared` part not alone).
- B1 (`docs/v3-draft1/run-b1/2026-10-06-b1-full-run-report.md`): 7 parts, 27 tasks, 62 product files, a chain of 6 waves; its product was copied file by file from a BDK commit (`git show 825455dd:evals/harness/...`). The architecture (design "Stages and units of work") wants 2-3 waves for the 15 min execute target.
- No eval run has a credential-free network, a local port, or project configuration (eval README, "Host limits"): a product the fixture holds must be a CLI that `node --test` and the `cli` e2e driver can drive.

## Goals / Non-Goals

**Goals:**

- One Change of B1 size that a run can start at plan (#242), at execute or at plan-to-PR (#208), with every stage before the start already approved.
- A Change grounded in real code, so `plan-draft` and `verify-plan` must read the code, and an implementer can build it from specs and design alone.
- A planned state that is a good v3 plan: the size of B1, but 3 waves instead of 6.
- A free CI check that keeps both states sound as the plugin evolves.

**Non-Goals:**

- Running plan-draft with and without the plugin (#242) or timing execute (#208).
- A product that needs a server, a browser or the network.

## Decisions

### D1. A new product of B1's size, not the B1 product

The fixture's product is `ledger`, a Node command-line ledger, and the Change `add-household-book` grows it into a household book: accounts and transfers, categories with rules, bank statement import, budgets, recurring entries, list and export, reports. Seven capabilities, one per part area, plus a modified main spec.

Alternative: reuse the B1 scope (the repository bootstrap harness of BDK's bench) - lost. B1's parts copied files from a BDK commit; a fixture would have to ship that source, which makes the Change a copy job (B1's own report: "62 files copied from a known source"), not design-to-code work, and it depends on BDK internals a run cannot reach. The ledger family is what the other fixtures use, so cases and graders read alike, and a CLI is what an eval run can drive (Context, host limits).

### D2. Exact size: 7 parts, 27 tasks, 62 files, 3 waves

The plan is cut as `plan-draft` is asked to cut (spec `bdk-plan-blocks`, "Plan shape for short waves"): part 01 holds the shared contracts (the book format v2, dates, the command dispatcher and the test helper); parts 02-06 each own one feature area with disjoint files and depend only on 01; part 07 (reports) depends on 05 (its budget report reads the budget status). Waves: 01, then 02-06 (five parts, the wave size the architecture assumes), then 07. Every part is `worktree`. Sizes stay at or under the default limits (at most 4 tasks and 10 files a part, every part file under 8 KB). The task and file counts match B1 exactly, so a speed result compares with B1's 47 min execute on the same size.

Alternative: B1's own chain of 6 waves - lost: the fixture would measure a plan shape the architecture already rejects; #242 compares plan shapes from the ready-to-plan state anyway.

### D3. The planned state is a step on top of the ready-to-plan one

`household-book-planned.sh` runs `household-book.sh` and adds the parts and the plan report in a second commit. One source for the project, specs and design means the plan cannot drift from them, and `git log` of a planned workspace shows the plan as its own commit, as a real run leaves it.

Alternative: two independent scaffolds - lost: two copies of the same Change that must change together.

### D4. Change markdown as files, code in the script

The Change's proposal, spec deltas, design and parts are markdown files under `plugins/bdk/evals/fixtures/household-book/change/`, mirrored to `openspec/changes/add-household-book/` by `cp -R`; the approval reports are under `household-book/runs/`. The product's code (a few small modules) stays in heredocs in `household-book.sh`, as in every other fixture.

Markdown is ignored by Prettier and by the linters, so the data files are byte-exact; code files under `plugins/` would be linted and formatted as repository code. 60 KB of markdown in heredocs would bury the script.

Alternative: everything in heredocs (the other fixtures' style) - lost at this size; the parts are read and edited as documents.

### D5. Approval records are the files the blocks read

Ready to plan: the reports of two real `verify-design` rounds on these files, `design/verify-1.md` (`Verdict: FAIL`, M1: the help scenario broke once `account` sorted before `add`) and `design/verify-2.md` (`Verdict: PASS`, closing M1 and S1-S8), and `design/gate.md` (`Gate: approved`, `By: user`, `Report: design/verify-2.md`), so `/bdk:design` reports the design as approved and goes no further. The two `Should consider` items of `verify-2.md` stay open, as a gate passes them in a real run; the design is the one `verify-2.md` checked, byte for byte. Planned: `plan/verify-1.md` (`Verdict: PASS`), what `bdk run status` and the resume rules read. Both reports name what was checked; the plan report is the outcome of a real `verify-plan` run on these parts (task "Probe"). No report is made up. `.bdk/runs/` is in the project's `.gitignore`, as `/bdk:setup` writes it, so the records exist in the workspace and stay out of its commits. `/bdk:plan` (#199, in flight) reads the last `plan/verify-N.md` and keeps no plan gate file (its branch, read on 2026-10-08), so the planned state needs nothing more; a gate file added later goes into the planned state then.

### D6. A free check of the planned state in `plugins/bdk/tests/`

`household-book.test.ts` builds both states in temporary directories and asserts, through the `bdk` CLI frame as `tests/plan.test.ts` wires it: `bdk plan check` exits 0 with 7 parts and 3 waves; the parts hold 27 tasks and 62 distinct files; every scenario of the spec deltas is named by exactly one part, and every named one exists; `npm test` of the base project passes; the ready state has no `plan/`. `evals.test.ts` already runs both scripts; this test adds what they must hold.

Alternative: rely on the paid probe alone - lost: a later edit of a part or of the limits would break the fixture silently.

### D7. The probe is a `verify-plan` case on the planned state

`verify-plan-household-book` (tag `block`) starts from the planned state without its plan report and asks to check the plan before implementing. Graders: the report file exists, it reads `Verdict: PASS`, `bdk plan check` ran (regex on the trace), and the skill fired. One arm, `--runs 1`, is the probe the issue asks for: it shows the scaffold builds in the harness, `bdk plan check` accepts the plan inside a run, and an opus verifier passes the plan, which is what "approved" means. Its report becomes the planned state's `plan/verify-1.md`.

Alternative: a probe on the ready-to-plan state with `plan-draft` - lost: it shows a plan written in the run, not the fixture's own planned state, and it is #242's measurement.

## Probe run

2026-10-08, Claude Code 2.1.292, `verify-plan-household-book`, one arm (`--ablation none`), `--runs 1`, clean `HOME` and the git shell prefix of the eval README "Host limits": score 1.00 (5/5 graders), 114 s, $0.77, one `bdk:verifier` agent. `Verdict: PASS`, no `Must address`; six `Should consider` items stay open (the `--day` text to number conversion, a `test/rule-cli.test.js`, the `parseArgs` errors in the part 01 contract, `readAmount` in `budget set`, scenario ownership of part 06 task 1, two parts at 10/10 files), as a passing gate leaves them in a real run. The report is the planned state's `plan/verify-1.md`, byte for byte, and the parts are the ones it checked.

The design records came the same way, from `/bdk:verify-design` in a scratch workspace: round 1 FAIL (M1, the help scenario; S1-S8), round 2 PASS after the fixes (52 s, $0.52).

## Risks / Trade-offs

- [The verifier fails the plan] -> fix the parts, specs or design and probe again; the fixture is not done until a verifier passes it.
- [The default part limits change] -> the free check fails and names the part; the plan is recut then.
- [A B1-sized Change in a fixture is a lot of text to keep consistent] -> the free check covers scenario ownership and sizes; `verify-plan` covers names against code.
- [`/bdk:plan` (#199) or `/bdk:execute` (#203) read a file this fixture lacks] -> they add it to the planned state when they land; the README names the gap.
- [Shared ground: `plugins/bdk/evals/README.md` is edited by parallel tasks] -> the edit is one new section; conflicts are merged keeping both.

## Open Questions

None.
