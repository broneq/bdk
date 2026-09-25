# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T02. Tracks #47.

The v3 design's "Skill inventory (PoC / TODO, not a final decision)" proposes 15 user skills, 5 role meta-skills and 13 agents, but it is explicitly unverified. T40 (the thin vs long A/B), T41 (stage skills) and T42 (remaining skills and agents) all need a deliberate, evidence-backed disposition for every item of today's inventory before they start, otherwise each of them reopens the inventory question on its own.

## What Changes

- New document `docs/V3-SKILL-INVENTORY.md`: one row per item of today's shipped inventory with a disposition **stays / merges / redesign / removed**, the evidence behind it and the target task (T41 or T42).
- The inventory counted in the repository (observed 2026-09-24), which corrects the plan's figures:
  - 16 user skills in `skills/` (not 19 as the plan states): `add-rule`, `commit`, `cr`, `create-adr`, `create-plan`, `debug`, `design`, `explain-complex-code`, `mermaid-drawer`, `pr-review`, `refine-rules`, `setup`, `subagent-execute-plan`, `test-driven-development`, `update-docs`, `verify-plan`.
  - 13 meta-skills (`user-invocable: false`): `bdk-tier-{edit,explore,impact,review,search}`, `bdk-rules-{architecture,code-quality,design-patterns,languages,security}`, `bdk-lint-tools`, `bdk-test-tools`, `bdk-implementer-return-contract`.
  - 13 agents in `agents/`.
  - 2 dev-time skills in `.claude/skills/` (`skill-lint`, `agent-lint`), reviewed only for what becomes a CI content test (A3); not user inventory. The OpenSpec dev-time skills are out of scope.
- The per-item review covers everything the plan's T02 Scope lists: size against S1 (SKILL.md <= 200 lines, plus `references/` weight), process vs domain knowledge, `!` blocks, frontmatter hooks, `allowed-tools`; the four merge / rename candidates with for / against / recommendation; the 13 -> 5 `bdk-role-<class>` mapping; agent text conflicting with P3 and T3; how `cr` and `pr-review` accept the dispatch package (not redesigned, per the design's "Out of scope"); the skill chosen for the T40 A/B; what of `skill-lint` / `agent-lint` becomes an A3 content test.
- A list of open decisions for the user, each with a recommendation. T02 recommends; the user decides on the output, and T41 / T42 take the decisions as input.
- Correct the inventory counts in `docs/V3-IMPLEMENTATION-PLAN.md` (T02 Goal) and in issue #47 to the observed numbers.
- Record the user's decisions from the review rounds (sections 11-13 of the inventory) and carry their consequences into `docs/V3-IMPLEMENTATION-PLAN.md`: a T02 Resolution paragraph, two new tasks (T14 state schema and write map, T15 `skill-check` package) with their dependency edges in the task graph, and revised Scope / Acceptance / Dependencies of the tasks the decisions touch (T12, T13, T20, T21, T23, T24, T30, T31, T40, T41, T42, T50). Open GitHub issues #66 (T14) and #67 (T15) in the `v3.0` milestone.

Inputs carried by citation, not restated: design sections "Skill inventory (PoC / TODO, not a final decision)", "Users & Personas", "Existing Codebase Context" (bullet "TSH revision grounding" and "Defects found on the way"); decisions S1, T1, T2, T3, T6, P3, P8, P9, P11, A3; `README.md` Skills and Agents sections; `STARTUP_INSTRUCTIONS.md`.

Out of scope:
- Writing or rewriting any skill, meta-skill or agent (T41, T42).
- Redesigning `cr` and `pr-review` (user decision recorded in the design); only their package-input note is in scope.
- Measuring rule bullets (T31) and running the A/B (T40); T02 only picks the A/B subject.
- Fixing the `STARTUP_INSTRUCTIONS.md` agents-table drift (T6 decided: v3 only, by generation, P11).
- Removing the `__pycache__` residue in `skills/execute-plan`, `skills/create-fixture`, `skills/refine-rules/scripts` (T32 cleanup); T02 records it only.

## Capabilities

### New Capabilities

None. T02 produces a review document and changes no behaviour, so `.openspec.yaml` sets `skip_specs: true` (project rule for document-only tasks). The acceptance signal is checked by the task list, not by spec scenarios.

### Modified Capabilities

None.

## Impact

- New: `docs/V3-SKILL-INVENTORY.md`.
- Edited: `docs/V3-IMPLEMENTATION-PLAN.md` (inventory counts in the T02 Goal; T02 Resolution; new tasks T14 and T15; downstream tasks revised per the decisions in inventory section 13.3).
- GitHub: issue #47 body count correction; board card set to In progress at apply; new issues #66 (T14) and #67 (T15).
- No code, skill, agent, hook or test changes. Downstream consumers: T40 (A/B subject), T41 and T42 (dispositions and the role mapping).
