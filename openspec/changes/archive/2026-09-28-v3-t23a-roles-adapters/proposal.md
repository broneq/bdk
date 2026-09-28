# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T23 (part A of three). Tracks #55.

The v3 dispatch contract needs something to dispatch to: role skills that carry the role contract and host adapters that bind a role to a tool set and model. Both are the base that part B (`dispatch build`, envelope, P8 in ingest) and part C (evidence, post-task nodes, swarm skill) build on, and the T23 spike has now confirmed the role mechanism of T02 decision Q-3 on Claude Code 2.1.283 (`docs/HOST-FACTS.md`, rows `roles-nested-*`, `fork-*`, `sub-bang`, `nested-agents`, `send-*`).

## What Changes

- T23 is split into three OpenSpec Changes merged in order into `staging/v3`: A (this one) role skills, adapters, `export agents`, plan and contract cleanup; B `dispatch build` / `show`, envelope, `rules show --ticket`, `log ingest` for read-only roles, P8; C evidence primitives, post-task nodes, swarm skill, archive prune. Issue #55 closes after C.
- Seven role skills under `skills/roles/<role>/SKILL.md` with their final contract: `implementer`, `verifier`, `design-verifier`, `reviewer`, `pr-reviewer`, `runner`, `scout`. Each is `user-invocable: false`, `context: fork`, `agent: bdk:<adapter>`, with no `!` block; the body is the role contract only (read the package with `dispatch show` and the rules with `rules show --ticket`, ledger writes through `log add`, output = envelope, P3, T3, P8 for the verifiers).
- Five adapters in `agents/`: `worker`, `reader`, `reviewer`, `runner`, `scout`, generated from adapter definitions and a Claude Code tool map held in the kernel. `verifier` runs on `reader`, not `runner`. The read-only adapters gain `Bash` for kernel commands, every adapter gains `SendMessage`, and only `worker` can write files.
- `bdk export agents --host claude [--check]` writes the five adapter files; `--check` compares only those five files. The 13 v2 agents stay untouched until T42.
- `.claude-plugin/plugin.json` gains `"skills": ["./skills/roles/"]`; without it the host does not discover nested skills.
- **BREAKING (contract only, never implemented):** `bdk dispatch run`, `execution.runner` and `execution.host` are removed. Waves run through the host's own subagents, driven by the swarm skill of part C; `execution.concurrency` stays.
- `export agents` supports `--host claude` only in v3.0; `gemini`, `cursor` and `opencode` are refused with `input/invalid-argument` until a task adds a verified tool map.
- `docs/V3-IMPLEMENTATION-PLAN.md`: T23 rewritten for the A/B/C split and the decisions of `design.md`; T42 aligned (verifier on `reader`, roles already delivered, no `bdk-entries` in role contracts); new inputs for T24 (prompt guard on `Agent`, no file writes through Bash from read-only adapters) and T30 (calls the T23 prune function); T50 multi-host test through the swarm skill.

## Capabilities

### New Capabilities

- `role-contracts`: role skills and adapters as shipped plugin content - layout, frontmatter, the role-to-adapter map, adapter tool sets and models, what every role contract states, and the minimal orchestrator prompt.

### Modified Capabilities

- `kernel-cli/export`: `export agents` generates from adapter definitions in the kernel, supports `claude` only, writes and checks only the five adapter files, `--check` refuses with `policy/generated-drift` (exit 2, missing from today's exit list), output schema unchanged.
- `kernel-cli/dispatch`: `dispatch run` removed.
- `kernel-cli`: `dispatch run` removed from the Availability classes table and from the rule table (`policy/no-open-ticket`, `policy/invalid-transition`); new rule `policy/generated-drift` for `export agents --check`.
- `kernel-settings`: `execution.runner` and `execution.host` removed from the execution keys.
- `kernel-state`: the `reports/` writer list drops `dispatch run`; only the `implementer` writes its report file, every other role stores it through `log ingest`.
- `kernel-architecture`: the `dispatch` slice loses `run` and the headless runner; the `export` slice generates from adapter definitions, not role skills.

## Impact

- New content: `skills/roles/*/SKILL.md` (7), `agents/{worker,reader,reviewer,runner,scout}.md` (5, generated).
- Kernel: `export` slice (generator, Claude Code tool map, `--check`), removal of `dispatch run` from the command index and of `execution.runner` / `execution.host` from `shared/config/known.ts`; `schema/cli/output/dispatch-run.json` deleted; `dist/bdk.mjs` rebuilt.
- Tests: E2E for `export agents` (byte-identical regeneration, `--check` drift, refused host); content test that every role skill names an adapter the generator produces; `pnpm skill-check` over the new skills and agents.
- Docs: `docs/guide/` pages that mention the runner or the export command; `README.md` Agents table lists the five adapters next to the v2 agents.
- Out of scope here: `dispatch build` / `show`, `rules show --ticket`, `log ingest` changes, P8 and the observation cap removal (part B); evidence, post-task nodes, swarm skill, `log list --since-ticket-start`, prune (part C); guard hooks (T24); removal of the v2 agents and skills (T42).
