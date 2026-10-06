# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T50 (revised in #138). Tracks #63.

Every kernel task closed with its own acceptance tests, but nothing ties the design's test list ("Testing Strategy", "Constraints & NFRs", "Risk Register", S1-S8) to the tests that answer it. A scenario can lose its test, or never get one, and no check notices. A survey of the tests found 9 of about 70 items only partly covered and one NFR (about 200 kernel calls per Change) with no measurement. The design text also drifted from the code in two places (S8, risk R-7).

The user documentation is still mostly v2. Nine guide pages carry the "Describes BDK v2" banner while describing removed skills (`create-plan`, `subagent-execute-plan`, `.bdk/plans/`). The README reads like a CLI reference with no quick start and no migration path. No page explains the evals to a contributor.

BDK's own repository keeps eight hand-written `.claude/rules/` files that v3's `doctor` reports as `rule-without-id`. Several of them hold definitions or procedures rather than rules.

T50 closes these gaps so that T54 can release 3.0 on top of a verified, documented kernel.

## What Changes

- **Acceptance catalogue.** A living spec lists every item of the design's test list under a stable ID (`AC-n`, `TSH-n`, `EC-n`, `S1`-`S8`, `NFR-*`, `R-n`) with the kind of evidence that answers it (test, perf measurement, eval report, or accepted without a test, with a reason). The catalogue states current behaviour where the design text drifted (S8, R-7).
- **Traceability guard.** Tests keep living in their slices. Each test that answers a catalogue item carries the ID in its title (`[AC-2]`). A contract test fails when an item has no evidence, or when a title names an ID the catalogue does not hold. A generated report, `docs/V3-ACCEPTANCE.md`, maps every item to its evidence, and a contract test keeps the committed report equal to the generated one.
- **Missing evidence.** New tests for the gaps the survey found: one Change from `change new` through `close` (AC-1); two live Changes on two branches (EC-3); a local override that disables escalation, listed in D4b (EC-4); the whole reason chain in `explain` (S3); index freshness (R-11); a perf test for a Change of about 200 kernel calls (NFR-SCALE-1). A gap whose behaviour the kernel does not have gets a follow-up issue and stays open in the catalogue with that issue's link. It is not built in T50.
- **README v3.** A rewrite: what BDK is, installation with Node, the two plugins, a quick start (`/bdk:setup`, `change new`, `run`), the Change pipeline with gates and `run`, profiles, layered configuration, rules and the learning funnel, and a link to the migration page. Reference detail moves to the guide.
- **Guide v3.** Every page carrying the v2 banner is rewritten for v3 or deleted. A new `reference/configuration.md` documents the settings keys (until now in the README). A new page gathers migration from v2, with no v2 support (hard cut). The banner, its test and its requirement go away. A guard takes their place: no page except the migration page and the removed-skills table names a removed v2 skill or path.
- **Eval documentation for contributors.** A guide page explains why the evals exist (A/A noise floor, the A/B and rules no-op measurements, the regression eval), what each suite measures, how to run one and read its report, the run cap and probe workflow, and why no measured run is in CI. `evals/README.md` shrinks to a pointer.
- **BDK's own rules.** Every `.claude/rules/` file goes through the content admission test (durability, decision, visibility, derivability). What passes is rewritten as one-sentence bullets and imported with `bdk rules import` into `.bdk/rules/`. Definitions move to the spec that owns them; procedures move to `CONTRIBUTING.md`. `.claude/rules/` then holds only the files `bdk rules export --claude` generates. `CLAUDE.md` and `CONTRIBUTING.md` lose their stale v2 lines and their pointers to deleted files.
- **Plan.** The T50 entry drops the launch of the first Change after v3 (`change new` for `ui-verify`, user decision 2026-10-05). `ui-verify` stays on the "After v3.0" list.

## Capabilities

### New Capabilities

- `acceptance-catalogue`: the catalogue of the design's test items with stable IDs and evidence kinds, the traceability guard over test titles, and the generated acceptance report.

### Modified Capabilities

- `docs-site`: "v2 banner" is removed; new requirements "README v3", "Migration from v2 page" and "Eval page for contributors"; "Site drift guards" also checks that every `bdk <command>` in the README and the site exists and that the eval page names every suite; "Site describes only shipped mechanisms" extends to the README, bans v2 workflow names outside the migration page and names the v3 settings page `reference/configuration.md`.
- `plugin-tooling`: new requirement "Repository rules managed by the kernel" - BDK's own `.claude/rules/` holds only the generated projection, guarded by a contract test.
- `rule-pack`: "What a rule is" names `rules/README.md` instead of `.claude/rules/quality-rules.md` as the authoring convention.
- `kernel-state`: "Plan part and plan index" defines the `Verification: none` task class in place, instead of pointing at `.claude/rules/verification-scoping.md`.
- `kernel-settings`: "Keys of evidence policy" states the file-class partition in place, instead of pointing at `.claude/rules/verification-scoping.md`.
- `stage-skills`: "plan tasks are contracts with concrete test cases" points at `kernel-state` for the `Verification: none` class.

## Impact

- Tests: one new contract test (catalogue guard and report equality), new E2E and perf tests for the gaps, and IDs added to the titles of existing tests across `kernel/src/**/tests/`. `kernel/tests/docs/banner.test.ts` is deleted and `kernel/tests/docs/shipped.test.ts` is extended. `kernel/tests/contract/rule-pack.test.ts` reads `rules/README.md`.
- Docs: `README.md`, `docs/guide/**` (rewritten and deleted pages, `sidebar.ts`), `docs/V3-ACCEPTANCE.md` (generated), `evals/README.md`, `.claude/skills/docs-sync/references/docs-map.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `docs/V3-IMPLEMENTATION-PLAN.md` (T50 entry).
- Repository rules: `.claude/rules/*.md` replaced by `.bdk/rules/*.md` plus the two generated files.
- Code: `kernel/src/evidence/config.ts` (comment pointing at the deleted rule file). No kernel behaviour changes.
- Already in place, only re-checked: the `kernel-cli` and `kernel-state` specs are held to the code by the existing contract tests (`cli-contract`, `kernel-contract`, `help`, `state-spec`, `state-write-map`, `state-fixture`).
- Out of scope: the 3.0 release, marketplace and migration announcement (T54, #137); the spec migration skill and any move of `openspec/specs/` (T55, #136); multi-host acceptance (dropped); evals for every skill (#135); the `log ingest` role bug (#133).

## Decisions taken with the user (2026-10-05)

- `openspec/` stays after the release, and the BDK repo keeps being run with OpenSpec.
- promptfoo does not run in CI.
- v2 support policy: none, a hard cut.
- No multi-host acceptance (revises T02 decision Q-3).
- No `change new` for `ui-verify` in T50.

## Resolved here (T50 "To resolve in the spec")

- Scenario ID scheme and where the list lives: IDs per design section, the catalogue as a main spec under `openspec/specs/acceptance-catalogue/` (design.md D1, D2).
- Coverage report: committed at `docs/V3-ACCEPTANCE.md`, generated, and held equal by a contract test (design.md D3).
- Which NFR measurements exist: mapped in design.md "Context"; only NFR-SCALE-1 is new.
