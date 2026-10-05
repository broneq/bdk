# Spec Delta

## Purpose

Ties every item of the v3 design's test list (success criteria, acceptance and TSH scenarios, user edge cases, NFRs, risks) to the evidence that answers it, so that an item cannot lose its test or ship without one unnoticed.

## ADDED Requirements

### Requirement: Catalogue of acceptance items

The catalogue below SHALL be the list of items that v3 answers with evidence. Each item has a stable ID that is never reused, a statement of the behaviour as the code holds it, and one or more evidence kinds:

- `test`: a test in the `unit`, `e2e` or `contract` vitest project, run by CI.
- `perf`: a test in the `perf` vitest project, run locally with `pnpm test:perf` and never in CI, because CI runners are too noisy for timing assertions.
- `report <path>`: a committed measurement report under `docs/`.
- `accepted`: no evidence, by decision; the row states the reason.
- `open <issue>`: the behaviour is not in the code yet; the row names the follow-up issue.

Where the design text and the code disagree, the row states the code and names the design wording it replaces (S8, R-7). A new item is added with the next free number of its section; a dropped item stays as a row with `accepted` and the reason.

| ID              | Item                                                                                                                                                                                                         | Evidence                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `S1`            | Size limits: plan part <= 8 KB and <= 8 tasks, `SKILL.md` <= 200 lines, a state query response <= 100 lines by default                                                                                       | `test`                                        |
| `S2`            | Every loop has a budget in policy; exhaustion is `parked` or escalated; `not-run` is counted on its own budget                                                                                               | `test`                                        |
| `S3`            | Reason chain: task to part to plan to design to intent, printed by `explain`; a decision carries ID, rationale, source, status and supersession                                                              | `test`                                        |
| `S4`            | The plan verifier ticks rule IDs; reviewer findings cite rule IDs                                                                                                                                            | `test`                                        |
| `S5`            | Any stage resumes in a fresh session or on another machine from git plus rebuild                                                                                                                             | `test`                                        |
| `S6`            | An unknown configuration key is an error naming the key; local overrides show in the resolved snapshot and, as keys, in the Change                                                                           | `test`                                        |
| `S7`            | The `tiny` profile skips design and plan verification; the profile is recorded as an `assumption` entry                                                                                                      | `test`                                        |
| `S8`            | A gate passes only on a `source: user` event the kernel stamped from a typed command; only `setup` and `run` are typed by the user, and `run` starts the other stage skills behind the pre-tool guard (replaces the design's `disable-model-invocation` on every stage skill) | `test`                                        |
| `S-DISPATCH`    | The kernel refuses a dispatch package over 12 KB                                                                                                                                                             | `test`                                        |
| `S-EVALS`       | promptfoo suite with an A/A noise floor and the thin vs long skill A/B                                                                                                                                       | `report docs/V3-EVAL-EXECUTE-AB.md`           |
| `AC-1`          | One Change runs from `change new` through `close` on a fixture repository                                                                                                                                    | `test`                                        |
| `AC-2`          | Resume after a killed session gives the same progress and budgets                                                                                                                                            | `test`                                        |
| `AC-3`          | An exhausted budget ends in a `parked` Change with a question                                                                                                                                                | `test`                                        |
| `AC-4`          | An oscillating finding is detected and shortens the escalation ladder                                                                                                                                        | `test`                                        |
| `AC-5`          | A v2 layout is detected and reported with the `/bdk:setup` instruction                                                                                                                                       | `test`                                        |
| `AC-6`          | A spec delta merges idempotently; two Changes on one capability conflict and a decision resolves it                                                                                                          | `test`                                        |
| `AC-7`          | Configuration layers merge and an unknown key is refused                                                                                                                                                     | `test`                                        |
| `AC-8`          | A dispatch package over the size limit is refused                                                                                                                                                            | `test`                                        |
| `AC-9`          | A `!`-block error renders as a BDK STOP block with exit 0                                                                                                                                                    | `test`                                        |
| `TSH-1`         | A typed stage command writes a `source: user` stage-transition event and the gate node is done                                                                                                               | `test`                                        |
| `TSH-2`         | A `log add` entry claiming user approval leaves the gate not done                                                                                                                                            | `test`                                        |
| `TSH-3`         | A hook payload without the user-typed marker writes no event                                                                                                                                                 | `test`                                        |
| `TSH-4`         | `/bdk:plan` typed before the design gate is ready is blocked with the reason and writes nothing; a loop-back needs a fresh typed command                                                                      | `test`                                        |
| `TSH-5`         | A subagent Bash call of `bdk.mjs commit` is denied                                                                                                                                                           | `test`                                        |
| `TSH-6`         | With the kernel removed, a guard exits 2 for a subagent `git commit` and a main-thread `bdk.mjs hooks` call; a main-thread `git status` passes                                                               | `test`                                        |
| `TSH-7`         | A subagent `git stash` is denied; the same command in the main thread passes                                                                                                                                 | `test`                                        |
| `TSH-8`         | Three `attempt close not-run` leave the loop budget intact and write a `question` entry                                                                                                                      | `test`                                        |
| `TSH-9`         | A verdict for an older input hash is `stale` and does not complete `plan-verify`                                                                                                                             | `test`                                        |
| `TSH-10`        | An evidence manifest older than the tree hash is rejected                                                                                                                                                    | `test`                                        |
| `TSH-11`        | A diff touching a `do-not-touch` path is refused at `attempt close`                                                                                                                                          | `test`                                        |
| `TSH-12`        | A verifier blocker without a listed category becomes an `observation` with `review: true`                                                                                                                    | `test`                                        |
| `TSH-13`        | A fake artifact kind exercises the evidence manifest, `not-run` and the citation validator together                                                                                                          | `test`                                        |
| `EC-1`          | With the kernel absent, a skill fails closed with the install instruction                                                                                                                                    | `test`                                        |
| `EC-2`          | A corrupted state index is rebuilt from git; rebuild is required before work continues                                                                                                                       | `test`                                        |
| `EC-3`          | Two live Changes on two branches progress side by side and their state merges without conflict                                                                                                               | `test`                                        |
| `EC-4`          | A local override that disables model escalation shows in the Change's list of local overrides (D4b)                                                                                                         | `test`                                        |
| `EC-5`          | A removed rule keeps its ID as a tombstone                                                                                                                                                                   | `test`                                        |
| `EC-6`          | A stage command typed while the kernel is missing is blocked with "kernel unavailable" shown                                                                                                                 | `test`                                        |
| `EC-7`          | `log ingest` refuses an invalid entry block naming the line; the orchestrator re-dispatches once, then records a `blocker`                                                                                   | `test`                                        |
| `EC-8`          | `bdk-craft` installed without `bdk` runs its skills                                                                                                                                                          | `test`                                        |
| `NFR-LAT-1`     | `log list` stays under 200 ms of kernel time at 1 000 entries                                                                                                                                                | `test`                                        |
| `NFR-LAT-2`     | The guard prefilter adds under 5 ms at p95                                                                                                                                                                   | `perf`                                        |
| `NFR-LAT-3`     | A kernel-reaching `pre-tool` hook stays under 150 ms at p95                                                                                                                                                  | `perf`                                        |
| `NFR-LAT-4`     | Prompt expansion of a stage command stays under 150 ms at p95                                                                                                                                                | `perf`                                        |
| `NFR-LAT-5`     | A kernel call stays within the per-call budget on a realistic Change (8 plan parts, 1 000 entries)                                                                                                           | `perf`                                        |
| `NFR-SCALE-1`   | A Change of about 200 kernel calls completes within the per-call budget                                                                                                                                      | `perf`                                        |
| `NFR-TEAM`      | 15 concurrent writers get distinct entry IDs without a lock                                                                                                                                                  | `test`                                        |
| `NFR-SEC-1`     | Spec edits outside the kernel are blocked; git in a subagent is denied                                                                                                                                       | `test`                                        |
| `NFR-SEC-2`     | The bundle imports only `node:` modules and the pinned dependencies                                                                                                                                          | `test`                                        |
| `NFR-SEC-3`     | A spec edited after its merge is detected by `doctor` and refused by `close`                                                                                                                                 | `test`                                        |
| `NFR-SEC-4`     | `execute` and `close` run without Edit and Write                                                                                                                                                             | `test`                                        |
| `NFR-RUNTIME`   | `doctor` reports a Node below 22.13                                                                                                                                                                          | `test`                                        |
| `NFR-SIZES`     | A report envelope is at most 15 lines and a summary at most 120 characters                                                                                                                                   | `test`                                        |
| `NFR-CONS`      | State that disagrees with git trailers fails closed                                                                                                                                                          | `test`                                        |
| `R-1`           | Ledger index bottleneck                                                                                                                                                                                      | `test`                                        |
| `R-2`           | The kernel as a single point of failure: fail closed with a repair line, `doctor` names it                                                                                                                  | `test`                                        |
| `R-3`           | `pipeline.yaml` refuses conditions                                                                                                                                                                           | `test`                                        |
| `R-4`           | Process hidden in the graph: `explain` and `status` show why a node waits                                                                                                                                    | `test`                                        |
| `R-5`           | A model driven by CLI output performs as well as one driven by a long skill                                                                                                                                  | `report docs/V3-EVAL-EXECUTE-AB.md`           |
| `R-6`           | `node:sqlite` is loaded lazily and its absence is reported                                                                                                                                                   | `test`                                        |
| `R-7`           | One runtime: `doctor` names no `uv`, `uvx` or MCP server (replaces the design's "two runtimes remain")                                                                                                       | `test`                                        |
| `R-8`           | Oscillation detection false positives                                                                                                                                                                        | `test`                                        |
| `R-9`           | Spec merge conflicts                                                                                                                                                                                         | `test`                                        |
| `R-10`          | Committed evidence is pruned at close                                                                                                                                                                        | `test`                                        |
| `R-11`          | The index freshness check stays within the per-call budget                                                                                                                                                   | `test`                                        |
| `R-12`          | Checkpoint commits leave user-staged files out                                                                                                                                                               | `test`                                        |
| `R-13`          | Host hook semantics are pinned by recorded payloads                                                                                                                                                          | `test`                                        |
| `R-14`          | A gate binds to time, not content                                                                                                                                                                            | `accepted`: rejected for v3 by design (content-bound gates are an extension after v3) |
| `R-15`          | Guard latency and false positives                                                                                                                                                                            | `test`, `perf`                                |
| `R-16`          | `attempt close` refuses an envelope that claims entries which do not exist                                                                                                                                   | `test`                                        |
| `R-17`          | Evidence primitives work without a real consumer                                                                                                                                                             | `test`                                        |
| `R-18`          | The rule measurement precedes rule IDs                                                                                                                                                                       | `report docs/V3-EVAL-RULES-NOOP.md`           |
| `R-19`          | Behaviour-only specs leave architecture patterns to rules                                                                                                                                                    | `accepted`: a revisit trigger, not a testable behaviour |

#### Scenario: an item states current behaviour

- **WHEN** the design text of an item disagrees with the code (S8, R-7)
- **THEN** the catalogue row states the code's behaviour and names the design wording it replaces

#### Scenario: a dropped item keeps its ID

- **WHEN** an item is no longer answered by evidence
- **THEN** its row stays with `accepted` and a reason, and its ID is not given to another item

### Requirement: Evidence named in test titles

Every catalogue item with evidence `test` or `perf` SHALL have at least one test in the matching vitest projects whose title, or the title of an enclosing `describe`, contains the item's ID in square brackets (`[AC-2]`). A test MAY carry several IDs. Tests stay in the slice that owns the behaviour. A contract test in `pnpm test:contract` SHALL read the catalogue table from this spec and the test titles from the test files, and SHALL fail when:

- an item with `test` has no title naming it in the `unit`, `e2e` or `contract` projects;
- an item with `perf` has no title naming it in the `perf` project;
- an item with `report <path>` names a file that does not exist;
- a test title names a bracketed ID of a catalogue prefix that the catalogue does not hold.

#### Scenario: an item loses its last test

- **WHEN** the only test titled with `[TSH-7]` is deleted
- **THEN** `pnpm test:contract` fails and names `TSH-7`

#### Scenario: a title names an unknown ID

- **WHEN** a test is titled `"[AC-99] ..."` and the catalogue has no `AC-99`
- **THEN** `pnpm test:contract` fails and names the file and `AC-99`

#### Scenario: a perf item answered only in the e2e project

- **WHEN** `NFR-SCALE-1` is named only by a test in the `e2e` project
- **THEN** `pnpm test:contract` fails and names `NFR-SCALE-1` as missing a `perf` test

### Requirement: Accepted and open items

An `accepted` row SHALL state its reason. An `open` row SHALL name a GitHub issue of this repository. An `S` item SHALL never be `open`: every success criterion has evidence in the release.

#### Scenario: accepted without a reason

- **WHEN** a row's evidence is `accepted` with no reason
- **THEN** the catalogue contract test fails and names the row

#### Scenario: an open success criterion

- **WHEN** the row of `S4` has evidence `open #200`
- **THEN** the catalogue contract test fails and names `S4`

### Requirement: Acceptance report

`pnpm acceptance:report` SHALL write `docs/V3-ACCEPTANCE.md`, a generated file with a marker saying so, that lists every catalogue item with its evidence kinds and, for `test` and `perf`, the file and full title of every test naming it. Perf items are marked as run locally only. The report is committed. A contract test SHALL fail when the committed report differs from the one the command generates, and SHALL name the command to rerun.

#### Scenario: report out of date

- **WHEN** a test gains the title `[EC-3]` and the report is not regenerated
- **THEN** `pnpm test:contract` fails and tells to run `pnpm acceptance:report`

#### Scenario: every success criterion in the report

- **WHEN** `docs/V3-ACCEPTANCE.md` is read after `pnpm acceptance:report`
- **THEN** each of `S1` to `S8`, `S-DISPATCH` and `S-EVALS` has a row with at least one test, perf test or report
