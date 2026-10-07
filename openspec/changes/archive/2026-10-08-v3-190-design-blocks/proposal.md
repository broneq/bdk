# Proposal

## Why

Tracks #190.

The design stage of BDK v3 is three blocks composed by `/bdk:design` (#198): `explore` maps the code a proposal touches, `design-draft` turns the proposal into spec deltas and `design.md` with the user, and `verify-design` checks the result against the code (design "Catalog", "Flows / Design"). None of them exists in the `bdk` plugin yet, and neither do the agents they run on. Draft 1 showed that design verification on a fresh context found real defects (a false claim about the code, L-fw9ettz8), so this stage is worth keeping; it also showed what not to repeat: a kernel holding the order, dispatch packages, a ledger and a 15-line envelope around every verdict ([findings](../../../docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md), sections 1 and 5).

## What Changes

- New skill `explore` (`/bdk:explore`), run by a new agent `bdk:explorer` (haiku): reads the proposal of a Change and the code it touches, and writes `.bdk/runs/<change>/design/explore.md`, a map of modules, entry points, data, boundaries, conventions and tests, each with a file and line.
- New skill `design-draft` (`/bdk:design-draft`), main thread: from the proposal and `explore.md`, offers approaches for each branching decision, asks the user what the code cannot answer (Lavish page when it opens, `AskUserQuestion` otherwise, decide-and-record under `policy.questions: decide-and-record`; D4), and writes the Change's spec deltas and `design.md` under the project's OpenSpec schema. Run again after a failed verification, it fixes every `Must address` item of the last report.
- New skill `verify-design` (`/bdk:verify-design`), run by a new agent `bdk:verifier` (opus): checks the design and specs against the code and the proposal, and writes `.bdk/runs/<change>/design/verify-N.md` with the D6 report body. Continued with `SendMessage`, it verifies the next iteration and keeps item IDs stable.
- A block that runs on an agent is invoked by the caller as `Agent(subagent_type: <agent>)` whose prompt runs the block's skill; the agent can then be continued with `SendMessage`. Typed by a user in the main thread, the skill starts that agent itself and relays its result. Recorded reason: a `context: fork` skill returns no agent ID, so it cannot be continued (probe in design D2).
- Eval cases per block (`plugins/bdk/evals/explore-*`, `design-draft-*`, `verify-design-*`) on a shared fixture, run with and without the plugin; `design-draft` has a case for the Lavish path and one for the `AskUserQuestion` path (D4).
- Resolves nothing open: the issue's "To resolve in the spec" says none; D4 and D6 of the [skills decisions](../../../docs/design/2026-10-07-v3-skills-decisions.md) are applied as decided.

## Capabilities

### New Capabilities

- `design-blocks`: the `explore`, `design-draft` and `verify-design` skills and the `bdk:explorer` agent: inputs, the run files they write, how questions are asked, how an agent block is started and continued, and their eval cases.
- `bdk-verifier`: the `bdk:verifier` agent shared by `verify-design`, `verify-plan` (#191) and `spec-conformance` (#196): it checks and never fixes, writes only its report file, and writes the D6 report body. #191 adds the same capability; whichever Change merges second merges the two into one spec.

### Modified Capabilities

None. `bdk-cli/run` already reads `design/verify-N.md` by its verdict line, and `bdk-cli/config` already holds `policy.questions`.

## Out of scope

- The `/bdk:design` orchestrator: the explore, draft and verify loop, its budget and the design gate (#198).
- `verify-plan` and `plan-draft` (#191), `spec-conformance` (#196), `triage` (#195), which also use D4 or D6.
- `/bdk:setup` reporting the Lavish path (D4 lists #181, already merged): not changed here.
- Any `bdk` command: none is added (CLAUDE.md "Building skills (v3)").

## Impact

- New: `plugins/bdk/skills/{explore,design-draft,verify-design}/`, `plugins/bdk/agents/{explorer,verifier}.md`, `plugins/bdk/evals/{explore,design-draft,verify-design}-*/`, a shared fixture under `plugins/bdk/evals/fixtures/`.
- Shared with #191: `plugins/bdk/agents/verifier.md` and the `bdk-verifier` spec.
- Ships in the released `bdk` plugin (`skills/` and `agents/`); `evals/` does not ship. No change to the CLI, `package.json`, the lockfile or shared configuration.
