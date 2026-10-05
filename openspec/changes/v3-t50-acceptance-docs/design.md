# Design

## Context

See proposal.md for why. The state this design builds on, from a survey of the branch on 2026-10-05:

- **Tests.** Four vitest projects (`vitest.config.ts`): `unit`, `e2e` (against the built bundle, two shards per Node line in CI), `perf` (local only) and `contract`. Acceptance tests sit in their slices (`kernel/src/<slice>/tests/acceptance.e2e.ts`, `it("acceptance: ...")`). Decision IDs appear as title suffixes (`"(T41-D12)"`). No title carries a design item ID except `describe("S4: rule ids are cited")`, and no test maps the design's list to tests.
- **Coverage of the design's list.** Of 74 items: 61 covered; partly covered AC-1 (no single new-to-close flow), AC-5 (`bdk import` was removed by T41, only v2 detection is tested), EC-3, EC-4, EC-7, S3, S4, R-11, R-16; missing NFR-SCALE-1. NFR-LAT-1 is already an E2E test (kernel time from telemetry); NFR-LAT-2 to -4 are in `guards.perf.ts`; NFR-LAT-5 is approximated by `next.perf.ts`. The design text is out of date for S8 (stage skills are started by `run` behind the pre-tool guard, not all user-only) and R-7 (`doctor` checks no `uv`).
- **Docs.** `kernel/tests/docs/banner.test.ts` forces the v2 banner on every page outside its `V3_PAGES` list. Stale v2 pages: `index`, `getting-started/installation`, `getting-started/first-feature`, `workflows/full-pipeline`, `workflows/standard`, `workflows/trivial`, `concepts/shared-foundation`, `concepts/verification-scoping`, `concepts/plan-pipeline`. Banner on mostly-v3 content: `workflows/docs-and-decisions`, `reference/skills`, `reference/hooks`, `reference/artifacts`, `troubleshooting`. Migration notes are spread over `getting-started/setup.md`, `reference/artifacts.md`, `reference/skills.md` and the README. No settings page and no eval page exist.
- **Rules.** The eight `.claude/rules/` files reference no deleted v2 file, but three have no top-level bullets (`prompt-writing`, `skill-context`, `testing-protocol`, which `rules import` would turn into one rule each, headings included), two hold definitions others cite (`verification-scoping` from three specs and `kernel/src/evidence/config.ts`; `quality-rules` from `rule-pack.test.ts` and the `rule-pack` spec), and several restate what `pnpm skill-check` already enforces. `rules import` derives the prefix from the file name, keeps only top-level bullets, and leaves the source files in place. `.gitignore` ignores only `/.bdk/.machine/` and `/.bdk/settings.local.yaml`, so `.bdk/rules/` is committed.

## Goals / Non-Goals

**Goals:**

- A failing check whenever a design item loses its evidence, with the evidence kept where the behaviour lives.
- A site and README that describe only v3, with one migration page.
- BDK's own repository uses the rule mechanism it ships.

**Non-Goals:**

- No kernel behaviour changes. A gap whose behaviour is missing becomes a follow-up issue.
- No edits to `docs/v3/` (the design archive): the catalogue records the drift instead.
- No timing assertion in CI.

## Decisions

### D1 The catalogue is a main spec

The list of items lives in `openspec/specs/acceptance-catalogue/spec.md` as one table, and the contract test parses that table.

- Rejected: reading the design document. `docs/v3/` is temporary material by the project's rule, its wording has drifted (S8, R-7), and a test reading prose headings breaks on any edit.
- Rejected: a YAML file under `kernel/tests/`. It is easy to parse but nobody reviews it as a contract, and it would be a second home for the list next to the specs.

### D2 IDs per design section, in square brackets in the test title

The prefixes follow the design's sections: `S1`-`S8` plus `S-DISPATCH` and `S-EVALS` (the two unnumbered success criteria), `AC-n`, `TSH-n`, `EC-n`, `NFR-<dimension>-n`, `R-n` in the order of the Risk Register. A test carries `[ID]` anywhere in its own title or an enclosing `describe` title, and may carry several. Existing tests are retitled in place, so every slice keeps its tests.

- Rejected: one consolidated acceptance suite (the plan's first wording). It moves tests away from the slice that owns the behaviour, duplicates fixtures and breaks the per-slice layout of `kernel-architecture`. The user chose to keep the modular layout.
- Rejected: parentheses like the decision suffixes. `(T23-D35)` already means "this test pins decision D35"; brackets keep the two readable and the parser unambiguous.
- Rejected: vitest annotations or tags. Titles show in every test run and in a plain grep.

### D3 Titles are collected with `vitest list`

The report script runs `vitest list --json` for each project (`unit`, `e2e`, `contract`, `perf`) and reads the full names, so titles built with template literals or `describe.each` and nesting are seen as vitest sees them. The contract test and `pnpm acceptance:report` share one module (`kernel/scripts/acceptance/`). The script needs no build: `vitest list` collects files without running them.

- Rejected: a regex over the test sources. It is faster but misses computed titles and needs its own model of `describe` nesting.

### D4 The report is generated and committed

`pnpm acceptance:report` writes `docs/V3-ACCEPTANCE.md`, and a contract test regenerates it in memory and fails on a difference, like the `schema/` up-to-date check. The diff shows a reviewer which item gained or lost a test. The report is a task artifact, so it belongs under `docs/`; the catalogue, being a living spec, does not.

- Rejected: a CI artifact only. Nobody sees it in review, and the T50 acceptance signal asks for a report.

### D5 Gaps: a test where the behaviour exists, an issue where it does not

For each partial item the implementation first checks whether the kernel or skill has the behaviour:

| Item          | Expected evidence                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-1`        | New E2E: `change new`, design, plan with one part, execute with one task, review, `close` on the fixture, driven by kernel commands as the skills call them. |
| `AC-5`        | The item is restated as detection (the `bdk import` command was removed by T41); existing detection tests get the ID.                                 |
| `EC-3`        | New E2E: two Changes on two branches, each advanced with `next` and `log add`, then `git merge` of both branches and `rebuild` give both states.      |
| `EC-4`        | New E2E: `settings.local.yaml` disables escalation; the Change's local-override list names the key.                                                   |
| `EC-7`        | Existing ingest refusal tests, plus a content test that the dispatching skills state "re-dispatch once, then `blocker`".                               |
| `S3`          | New E2E: `explain` on a task prints part, plan, design and intent.                                                                                    |
| `S4`          | Content test that the plan verifier contract asks for the rule ID tick list, plus the T31 citation E2E.                                               |
| `R-11`        | New E2E: telemetry of a call after an unchanged ledger reports no refresh.                                                                             |
| `R-16`        | New test if `attempt close` checks the envelope's entry ids; otherwise `open` with a follow-up issue.                                                 |
| `NFR-SCALE-1` | New perf test (D6).                                                                                                                                   |

A missing behaviour is never built here (non-goal). An `S` item cannot be `open` (spec), so S3 and S4 must end with evidence; if a content test is all the code supports, the item is restated to what the code does and the drift is named, as for S8.

### D6 NFR-SCALE-1 measures a scripted Change

A perf test drives one Change through about 200 kernel calls in the mix a real run makes (`next`, `log add`, `attempt start` / `close`, `part start`, `commit`, `status`, `explain`), on a fixture with 8 plan parts. It asserts the p95 of a single call under the kernel-reaching budget of 150 ms (the same budget as `pre-tool`) and prints the total. `NFR-LAT-5` takes the ID on `next.perf.ts`, whose 150 ms bound already stands for the per-call budget.

- Rejected: asserting the design's 30-50 ms per call. That figure is Node start time on the author's machine, not a budget; the other perf tests already use 150 ms.

### D7 Guide pages: rewrite, rename or delete

| Page                                                                                         | Outcome                                                                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `index`, `getting-started/installation`, `getting-started/first-feature`                     | Rewritten for v3 (first feature: a `small` Change from `/bdk:setup` to `close`).                        |
| `workflows/trivial`, `workflows/standard`, `workflows/full-pipeline`                         | Renamed to `workflows/tiny`, `workflows/small`, `workflows/large` and rewritten around the profiles.    |
| `concepts/plan-pipeline`                                                                     | Replaced by `concepts/change-pipeline` (artifact graph, gates, `next`, `run`).                          |
| `concepts/shared-foundation`                                                                 | Replaced by `concepts/context` (STARTUP, `bdk ctx skill` context lines, dispatch packages).             |
| `concepts/verification-scoping`                                                              | Rewritten for v3 (evidence partition, `Verification: none`, tree hash).                                 |
| `workflows/docs-and-decisions`, `reference/skills`, `reference/hooks`, `reference/artifacts`, `troubleshooting` | Checked against the code, v2 tables moved to the migration page, banner dropped.            |
| new `getting-started/migration-from-v2`, `reference/configuration`, `contributing/evals`      | Written.                                                                                                |

Renamed pages break inbound links, which the strict build reports; there are no external links to keep, because the site has never been deployed. `.claude/skills/docs-sync/references/docs-map.md` follows every move.

- Rejected: keeping the three workflow page names. "Standard" and "full pipeline" are v2 vocabulary; the profiles are what the user picks.

### D8 README is an entry point, the site is the reference

The README keeps the sections the spec lists and the skills table (drift guard 1); the settings prose moves to `reference/configuration`, the sections on Change state, the artifact graph, plan parts, loops and the living spec move to `concepts/change-pipeline`, and the removed-skills tables move to the migration page. Command detail stays in `bdk <command> --help`, which the `help` contract test holds to the spec. Shorter README, one place for each fact.

- Rejected: a new reference page per kernel command. `--help` and the `kernel-cli` specs already carry it and are tested; a third copy would drift.

### D9 Eval documentation lives in the site

`contributing/evals.md` is the explanation; `evals/README.md` keeps the command synopsis and a link, and the provider facts table moves to the page. The page cites `docs/V3-EVAL-*.md` as the records of past decisions instead of repeating them.

- Rejected: growing `evals/README.md`. It is not in the site, so the strict build and the drift guards never check it.

### D10 Repository rules: verdict per file, thematic sources, then import

Each file goes through the four-test admission (plugin-tooling, Repository rules managed by the kernel). Preliminary verdicts from the survey, to be confirmed bullet by bullet during the work:

| File                      | Verdict                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `artifacts.md`            | One rule (skills write `.bdk/` only through `bdk`); the "why" bullets are narration and go.                                                                     |
| `portability-check.md`    | Keep the dispatch-package rule and the stack-detection exception; the rest is enforced by `skill-check` and goes. The `STARTUP_INSTRUCTIONS.md` framing is v2. |
| `prompt-writing.md`       | Three to five one-sentence rules (whole task, not a step script; no "double-check" prose; reviewers report every finding; a positive example, no shouting).     |
| `quality-rules.md`        | Deleted: the definition is in `rules/README.md`; `rule-pack.test.ts` and the `rule-pack` spec repoint there.                                                     |
| `skill-context.md`        | One rule (more context through a manifest part, never a new `!` line), scoped to `skills/**`; the rest is enforced by `skill-context.test.ts`.                  |
| `skills.md`               | The "not enforced" bullets stay as rules; the enforced list becomes nothing (the test names itself).                                                            |
| `testing-protocol.md`     | Procedure, moves to `CONTRIBUTING.md`; possibly one rule "never test a skill inside the BDK repo".                                                               |
| `verification-scoping.md` | Definition, moves into `kernel-settings` (Keys of evidence policy) and `kernel-state` (Plan part and plan index); `kernel/src/evidence/config.ts` repoints.     |

The survivors are written as one-sentence top-level bullets into new source files named for their prefix (`skills.md` scoped to `skills/**` and `agents/**`, `prompts.md`, and a global `repo.md` if any global rule survives), so `rules import` gives readable IDs (`SKILLS-1`, `PROMPTS-1`). After the import the sources are deleted and `rules export --claude` writes the projection. `CLAUDE.md`, `CONTRIBUTING.md`, `skill-check.config.ts` (comment) and the docs map lose their pointers to the deleted files; `CLAUDE.md` also drops its v2 architecture and "Adding a skill / agent" steps for the v3 layout.

- Rejected: importing the files as they are. Three files would become one rule each with their headings, and the definitions would become `house` rules, which `rule-pack` says they are not.
- Rejected: `--prefix` per original file. It keeps the old file boundaries, which mixed rules, definitions and procedures.

## Risks / Trade-offs

- [`vitest list` on the `e2e` project imports helpers that expect a build] → the report command runs `pnpm build` first, like `test:e2e`; the contract project already depends on the build.
- [Retitling about 70 tests touches many files and conflicts with parallel work] → only titles change; T50 is the last kernel task before the release, so little runs in parallel.
- [A `.bdk/` directory in the BDK repository makes the session hooks treat it as a BDK project] → after the import, run `bdk doctor` and one session in the repository; if a hook misbehaves, that is a kernel bug and gets an issue, it does not keep the rules hand-written.
- [Deleting the banner test before every page is rewritten] → the banner test goes in the same group as the last page rewrite, and the v2 workflow guard lands first, so no state is ever unguarded.
- [The catalogue table is long and edited by hand] → the contract test checks its shape (unique IDs, known evidence kinds, a reason for `accepted`, an issue for `open`), so a malformed row fails at once.

## Migration Plan

No user-facing migration: the change adds tests and documentation. Inside the repository, `.claude/rules/` is replaced in one commit by `.bdk/rules/` plus the projection, so the rules a session loads never disappear between commits.
