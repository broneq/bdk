# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T23 (part B of three). Tracks #55.

Part A shipped the seven role skills and five adapters, but their contract points at commands that still answer `kernel/not-implemented`: `dispatch show`, `rules show --ticket`, `log ingest` for every role, and `log add --category`. Part B makes the package go in and the envelope come out through files only (T23-D0), so that part C (evidence, post-task nodes, swarm skill) and T41 `execute` have something real to drive.

## What Changes

- `bdk dispatch build <task> <role> <ticket>` writes the package `changes/<id>/dispatch/<target>-<role>-<ticket>.md` (T14): frontmatter per `kernel-state` Dispatch package plus `adapter`; the first argument becomes `<target>`, the ticket's target; body from a template in kernel code (T23-D11) with the intent summary, the full task text with `do-not-touch` and `stop-rule`, the `decision(accepted)` and `blocker` entries of the task in full, counts of the other entry types with the `bdk log list --for` command (T23-D13), the role skill body, the `bdk rules show --ticket` command (T23-D5), the blocking categories and the "not a FAIL" list for the verifiers (P8), and the return contract. Refuses above 12 KB, on placeholders in executable fields (T22's task grammar check) and without an open ticket for the task. `template-hash` per T23-D10.
- `bdk dispatch show <ticket|path>` prints a package; `agent` availability, as specified.
- `bdk rules show --ticket <ticket>` prints the rules for the ticket's role and task: rule categories from a role-to-category map in kernel code, plus every language the project configures in `languages:` until T31 selects by rule applies (user choice). Project overrides through the `rules/<name>` prompt values apply. The first call per ticket stamps `rules-read` in the ticket's attempt record (user choice), and `attempt close` of an `implementer` ticket without it writes a `finding` with `review: true` (risk R2). `rules show` moves from `read` to `agent` availability; the `<id>` form stays T31's.
- **BREAKING (contract only):** `bdk log ingest --ticket <ticket>` stores a role's report instead of ingesting a `bdk-entries` block (T23-D14). Every role, the `implementer` included, pipes its report (envelope frontmatter plus body) to it (user choice); the kernel stamps `schema`, `ticket` and `role`, validates the envelope, checks that every id in `entries` was written under the ticket, and writes the report to the package's `report` path. A refused report is the agent's to fix and resubmit before it returns. `log ingest` moves from `orchestrator` to `agent` availability; `--file` is dropped.
- `bdk log add` gains `--category <id>`. A `blocker` written under a `verifier` or `design-verifier` ticket without a category from `policy.verifier.blocking-categories` is stored as an `observation` with `review: true`, the original type and category in its body, and the output names the downgrade (P8).
- **BREAKING (contract only):** the per-dispatch `observation` cap, `policy/observation-cap` and `policy.log.max-observations` are removed (T23-D13).
- `policy.verifier` is registered: `blocking-categories` (six P8 defaults, merged by `id`) and `not-a-fail` (the explicit list of what a verifier must not block on).
- Role contracts: the `implementer` stores its report through `log ingest` like every other role, and every role checks the result of `log ingest` and fixes a refused report before returning (user note). Role bodies stay not overridable in 3.0: the package embeds the plugin's role body, so a forked role and an Agent-tool role read the same text (user choice; corrects T23-D11). The orchestrator may resume an agent once to fix a missing or refused report (user note); the swarm skill that does it is part C.
- `bdk attempt close --envelope <path>` keeps its `entries` check on the stored report (T22); `log ingest` runs the same check earlier, so the agent can still fix it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-cli/dispatch`: `dispatch build` and `dispatch show` specified in full (package sections, sizes, refusals, output); the package file name uses the ticket, as in `kernel-state`.
- `kernel-cli/rules`: `rules show --ticket` form, its role-to-category selection, `agent` availability and the `rules-read` stamp.
- `kernel-cli/log`: `log add --category` and the P8 downgrade; `log ingest` reworked into report storage for every role; observation cap removed.
- `kernel-cli/attempt`: `attempt close` adds the missing-rules `finding`.
- `kernel-cli`: availability table (`rules show`, `log ingest` to `agent`), rule table (`policy/observation-cap` removed, `input/invalid-block` replaced by an envelope refusal).
- `kernel-state`: Dispatch package body sections and `task` / `adapter` fields; Report envelope without `bdk-entries`; Attempt record gains `rules-read`; Write map (`reports/` written only by `log ingest`, `attempts/` also by `rules show`).
- `kernel-settings`: `policy.verifier` registered with `not-a-fail` and consumed by `log`; `policy.log.max-observations` removed; the rule prompt values and `languages` move from consumer `ctx` to `rules`.
- `role-contracts`: every role stores its report through `log ingest` and checks its result; role bodies are not overridable; the orchestrator's single resume.
- `kernel-architecture`: dependency matrix rows for `dispatch` (`rules`, `log`, `export`), `ctx` and `rules`; the `rules` slice lands with `rules show --ticket` and owns the rule text that `ctx` reads.

## Impact

- Kernel: `dispatch` slice (build, show, package template, `template-hash`), new `rules` slice with `rules show --ticket` only, `ctx` reads rule text through `rules`, `log` slice (`add --category`, P8 downgrade, `ingest` rework, cap removal), `attempt` close changes, `policy.verifier` config module, attempt record schema (`rules-read`), report schema unchanged apart from dropping `bdk-entries`; command index, output schemas and refusal catalogue; `dist/bdk.mjs` rebuilt.
- Content: `skills/roles/implementer/SKILL.md` and the report sentence of every role; the role content test.
- Tests: unit and E2E per acceptance signal B (13 KB package refused, `TODO` in an executable field refused, no ticket refused, package embeds the role body, the `rules show --ticket` command and only the accepted decisions and blockers of the task, uncategorised verifier blocker becomes `observation review: true`), `rules show --ticket` selection and stamp, missing-rules finding, `log ingest` envelope refusals.
- Docs: `docs/guide/` pages for dispatch, log and rules commands.
- Out of scope: evidence primitives, post-task nodes, swarm skill (including the single resume), `log list --since-ticket-start`, prune (part C); `rules show <id>` and rule IDs (T31); guard hooks (T24); v2 skill rewiring (T42).
