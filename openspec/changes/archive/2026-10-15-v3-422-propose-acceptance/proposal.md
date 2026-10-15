## Why

Tracks #422.

In the OCR-376 run (`.bdk/analysis/projects-compare/WHY-sw-better.md`, 2026-10-12) the issue was read once, the proposal had no acceptance criteria, an acceptance point (the expiry variant, "revert the rule by hand once per spec") was dropped by the designer as "Decided without the user", and no verifier saw it, because each stage checks only the stage before it. The acceptance criteria of the source must survive every stage, and every change of scope must be a decision the user took and sees once, at one gate. The decisions of the design session of 2026-10-15 are D1-D7 of `.bdk/analysis/propose-shift-left/REPORT.md` (section 9), with the page mockup `summary-mockup.html`; this Change carries them out and does not reopen them.

## What Changes

- `/bdk:propose` saves the source word for word (issue title, body, comments and the issues it names as its source, or the intent) to `.bdk/runs/<change>/source/issue.md`.
- `proposal.md` gains `## Intent` (a quote of the source) and `## Acceptance` (`AC-1`..`AC-n`, stable ids, a conditional point keeping its condition), also when the Change sets `skip_specs: true`; the BDK schema's proposal instruction and template carry both.
- `/bdk:propose` opens `openspec/changes/<change>/scope-log.md`, an append-only log of every change of scope (entry id, stage, date, what changed, before and after, why, who decided: the user or a setting).
- A new block `/bdk:recon` on `bdk:explorer` (sonnet) checks only the conditional or unclear AC and writes facts with `file:line`, no recommendation, to `.bdk/runs/<change>/explore/propose-recon.md` (D1, D4).
- `/bdk:propose` asks one decision round: every open scope question at once, with options and a default. Dropping, narrowing or reinterpreting an AC is always the user's decision; under `policy.questions: decide-and-record` it becomes an open `needs-user` entry of `scope-log.md`, never "Decided without the user" (D2).
- **BREAKING** The code map moves from `.bdk/runs/<change>/design/explore.md` to `.bdk/runs/<change>/explore/design.md`; every file of `explore/` has one writer and a front matter (`question`, `summary`, `stage`, `files`), and `explore/index.md` is built from those front matters by the orchestrator that ran the block (D6).
- `/bdk:verify-design`, `/bdk:verify-plan`, `/bdk:review-integration`, `/bdk:spec-conformance` (and so `/bdk:close`) read `source/issue.md`, `## Acceptance` and `scope-log.md` as the reference: an AC dropped or changed without a user entry of the log is a FAIL, and "deferred" without the user is no coverage.
- `/bdk:design-draft` records each scope change of the design as a log entry, and writes the "intent against now" page (`.bdk/runs/<change>/design/intent.html`: the struck intent, each decision with its evidence and rejected options, the before/after AC table, a picture of the changed flow) when `/bdk:design` asks for it (D7).
- The design gate of `/bdk:design` shows that page and asks, under `manual` and `auto` alike, whenever the scope log holds an entry after propose that no gate has shown; otherwise it behaves as today (`manual` asks for approval, `auto` approves).
- `/bdk:run` marks a Change with an open `needs-user` entry as `needs-user` in `run.json` and goes on with the next Change, instead of stopping the run.
- `/bdk:close` puts the scope changes of the log into the pull request body.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-propose`: source saved, Intent and Acceptance, scope log, the recon block, one decision round with AC decisions kept for the user.
- `bdk-openspec-schema`: the proposal artifact's instruction and template hold `## Intent` and `## Acceptance`.
- `design-blocks`: the `explore/` directory and its index, the map at `explore/design.md`, AC coverage in the draft, scope-log entries for scope changes, the intent page, AC checks of `verify-design`.
- `bdk-design`: resume from `explore/design.md`, the intent page at the gate, its eval case.
- `bdk-plan-blocks`: `verify-plan` checks that every AC is carried by a part.
- `review-blocks`: the integration review checks the AC against the code.
- `bdk-spec-conformance`: the AC are part of what the block checks.
- `bdk-close`: scope changes in the pull request body.
- `bdk-run`: Changes that need the user are marked and skipped.

## Out of scope

- The model evaluation of designer and planner (opus against `inherit`, D5): the issue that follows this one.
- Targeted explorers beyond the two files this Change writes: the layout leaves room for them (D6), no block writes one yet.
- A `bdk` helper that builds `explore/index.md` or reads `scope-log.md`: added only when a measurement shows the need.
- The docs and release checks of the closing issues #170, #171, #213, #217, #384, which this one blocks.

## Impact

- `plugins/bdk/skills/`: `propose`, a new `recon`, `explore`, `design`, `design-draft` (and a new reference for the intent page), `verify-design`, `verify-plan`, `review-integration`, `spec-conformance`, `close`, `run`; `plugins/bdk/agents/explorer.md` (the new block); `plugins/bdk/openspec/schemas/bdk/` (proposal instruction and template).
- `plugins/bdk/evals/`: new cases `propose-conditional-ac`, `verify-design-dropped-ac`, `verify-design-dropped-ac-user`, `design-intent-page`, `run-needs-user`; the graders and fixtures that name `design/explore.md` move to `explore/design.md`.
- User docs: `docs/concepts/stages.md`, `docs/concepts/run-state.md`, `docs/concepts/orchestrators.md`, `docs/concepts/agents.md`, `docs/guide/workflow.md` and the pages that name the map path, with their flow diagrams; the Reference regenerated with `pnpm docs:reference`.
- A project whose run directory holds a map at the old path `design/explore.md` gets a new map at `explore/design.md` when its design has not started; once `design.md` exists the map is not read again.
