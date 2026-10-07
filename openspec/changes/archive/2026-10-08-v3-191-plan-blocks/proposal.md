# Proposal

## Why

Tracks #191.

The plan stage of a Change has no blocks yet. `bdk plan check` (#185) measures plan parts, and the BDK OpenSpec schema (#180) defines their frontmatter, but nothing writes the parts and nothing checks them against the code before execute. Draft 1 showed that both jobs matter (design "Existing Codebase Context": plan verification found real defects, B1 lost minutes to tasks without an owner, a missing part preamble and an acceptance line that ran paid commands) and that the plan's shape sets the execute time (design "Stages and units of work": wave depth decides the duration). `/bdk:plan` (#199) composes these two blocks and is blocked by this task.

## What Changes

- New author block `plugins/bdk/skills/plan-draft/` (`/bdk:plan-draft`, main thread, design "Catalog"): reads the proposal, spec deltas, design and the code they name, and writes the Change's plan parts `plan/parts/NN.md`: frontmatter `id`, `depends-on`, `isolation`, `files` (spec `bdk-openspec-schema`), acceptance scenarios taken from the spec deltas, and tasks as contracts in the format of D1 of `docs/design/2026-10-07-v3-skills-decisions.md`. It cuts parts for short wave chains, runs `bdk plan check` until it reports no problem, and, when the last `plan/verify-N.md` of the run fails, fixes what its `Must address` names.
- New verifier block `plugins/bdk/skills/verify-plan/` (`/bdk:verify-plan`), run by the new agent `bdk:verifier`: checks the plan parts against the code, the specs and the design, and writes `.bdk/runs/<change>/plan/verify-N.md` with the report body of D6 of the same document.
- New agent `plugins/bdk/agents/verifier.md` (`bdk:verifier`, opus): the read-only role shared by `verify-design` (#190), `verify-plan` and `spec-conformance` (#196): it checks and never fixes, writes only its report, and follows D6.
- The part template of the BDK schema shows the D1 task lines, so the template, the plan instruction and `plan-draft` state one format.
- Eval cases `plugins/bdk/evals/plan-draft-*` and `verify-plan-*` on a shared fixture of a configured project with a Change ready to plan; their with/without results go into the design.

## Capabilities

### New Capabilities

- `bdk-plan-blocks`: the `plan-draft` and `verify-plan` skills: inputs, what each writes, the checks of `verify-plan`, and their eval cases.
- `bdk-verifier`: the `bdk:verifier` agent and the verifier report body (D6) every verifier block writes.

### Modified Capabilities

- `bdk-openspec-schema`: "Plan parts are files with frontmatter" states the D1 task format, and the part template shows it.

## Out of scope

- The `/bdk:plan` orchestrator and its draft, check and verify loop with a budget (#199).
- `verify-design` and `design-draft` (#190), `spec-conformance` (#196): they use `bdk:verifier` and D6 but bring their own skills.
- `implement-part` (#192), which reads the parts this block writes.
- Any new `bdk` command: `plan-draft` uses `bdk config show` and `bdk plan check`; `bdk plan check` does not parse tasks (D1).
- A `policy.budgets.verifier` key: the loop budget belongs to #199.

## Impact

- New: `plugins/bdk/skills/plan-draft/`, `plugins/bdk/skills/verify-plan/`, `plugins/bdk/agents/verifier.md`, `plugins/bdk/evals/plan-draft-*/`, `plugins/bdk/evals/verify-plan-*/`, a shared fixture in `plugins/bdk/evals/fixtures/`.
- Changed: `plugins/bdk/openspec/schemas/bdk/templates/part.md` and the `plan` instruction in `schema.yaml` (projects get it on the next `/bdk:setup` or `bdk openspec install`).
- Shared ground: `plugins/bdk/agents/` is new and also used by #190, #193, #194; `bdk:verifier` is shared with #190 and #196.
- No change to `package.json`, the lockfile, the CLI or shared configuration.
