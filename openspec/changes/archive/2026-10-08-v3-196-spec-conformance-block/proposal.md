## Why

Tracks #196.

The OpenSpec main specs are BDK's living documentation (problem 3 of `CLAUDE.md`, "Goal of this line"): `openspec archive` copies a Change's spec deltas into them. When a delta says one thing and the product does another, archive turns a wrong statement into the documentation. Draft 1 never checked this: its run only showed that `spec merge` worked, not "whether the merged spec describes the product correctly after the Change" ([findings](../../../docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md), "Living documentation"). The v3 architecture puts a check before archive: `/bdk:close` composes `spec-conformance`, run by `bdk:verifier` (opus), "Do the spec deltas describe the product after the change?" (`docs/design/2026-10-07-v3-architecture.md`, "Catalog"), and the autopilot resumes at row 9 until `close/spec-conformance.md` passes ("Autopilot continuation"; spec `bdk-cli/run`). The report body is D6 of `docs/design/2026-10-07-v3-skills-decisions.md`.

## What Changes

- New block skill `spec-conformance` in `plugins/bdk/skills/spec-conformance/`: on the `bdk:verifier` agent, it reads a Change's spec deltas, the main specs they modify, the code of the Change and the E2E results in `.bdk/runs/<change>/e2e/`, and checks each delta against the product: every added or modified requirement and scenario holds in the code, every removed requirement is gone, a modified requirement keeps the main-spec scenarios that still hold, and the Change adds no user-visible behaviour that no delta describes. It writes `.bdk/runs/<change>/close/spec-conformance.md` in the D6 body (`Verdict:`, `Must address`, `Should consider`, `Checked`, stable IDs) and replies with the verdict line, the path and the `Must address` IDs.
- Runs on the agent `bdk:verifier` (`plugins/bdk/agents/verifier.md`, opus, spec `bdk-verifier`), which #191 shipped for all three verifier blocks; its description already names `bdk:spec-conformance`, so the agent is used unchanged.
- Eval cases `spec-conformance-*`: a delta the code contradicts (the acceptance signal), user-visible behaviour no delta describes, and a Change that conforms (no false `FAIL`), on one shared fixture.

## Capabilities

### New Capabilities
- `bdk-spec-conformance`: the `spec-conformance` block - input, what it compares, how it sorts problems, the report file, the reply, and running on `bdk:verifier`.

### Modified Capabilities
None.

## Impact

- `plugins/bdk/skills/spec-conformance/` (new); `CLAUDE.md` "Current state" names it.
- `plugins/bdk/evals/`: a shared fixture, three cases, README grants and run command.
- No CLI change: `bdk run status` already reads `close/spec-conformance.md` (row 9). No helper: none is asked for by an eval or a measurement.
- Out of scope: the `/bdk:close` orchestrator that composes this block with archive, commit and PR, and decides what to fix after a `FAIL` (#202); `verify-design` (#190); the `bdk:verifier` agent and its spec (#191, merged); E2E itself (`e2e-check`, #194, merged).
