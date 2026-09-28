# Tasks

## 1. Plan and contract cleanup

- [x] 1.1 Rewrite T23 in `docs/V3-IMPLEMENTATION-PLAN.md` for the A/B/C split (T23-D1): scope per part, no `headless` runner or `dispatch run`, the swarm skill in part C, `rules show --ticket` and the `log ingest` rework in part B, acceptance without "two concurrent processes" and without "the spike report is in `docs/`" (facts live in HOST-FACTS); verify by reading the section against design.md
- [x] 1.2 Align T42 (verifier on `reader`, roles and adapters delivered by T23, adapters defined in kernel code, `user-invocable: false`, no `bdk-entries` in role contracts), add the T24 inputs (prompt guard on `Agent`, no file writes through Bash from `reader` / `reviewer` / `scout`), the T30 input (call the T23 prune function) and the T50 multi-host test through the swarm skill; verify each edit cites its T23-D id from design.md
- [x] 1.3 Write a failing contract test expectation for the removals: `dispatch run` absent from `schema/cli/commands.json`, `execution.runner` / `execution.host` absent from the planned keys, `policy/generated-drift` declared by `export agents`; verify `pnpm test:contract` fails on exactly these
- [x] 1.4 Remove `dispatch run` from `schema/cli/commands.json`, delete `schema/cli/output/dispatch-run.json`, drop `execution.runner` and `execution.host` from `kernel/src/shared/config/known.ts`, shrink `export agents --host` to `claude`, add exit 2 and `policy/generated-drift` to its record, update `kernel/tests/contract/cli-contract.test.ts` wording and the `child_process` allowance for the dispatch runner in `kernel/tests/structure.test.ts`; verify `pnpm test:contract` and `pnpm test:unit` pass
- [x] 1.5 Edit the main spec `openspec/specs/kernel-cli/export/spec.md` preamble (Purpose and the refusal example still name four hosts and "from the role skills"), since a delta cannot change a Purpose; verify `openspec validate --specs --strict` passes

## 2. Adapter generator (`export` slice)

- [x] 2.1 Write failing unit tests for the adapter definitions and the Claude Code rendering: five adapters, tools and models per `role-contracts` Adapters, generated marker, one-sentence body, LF, fixed key order, output independent of time; verify they fail for the missing module
- [x] 2.2 Implement the `export` slice domain and use case (definitions and host tool map in kernel code, T23-D19 to D21) and verify the unit tests from 2.1 pass with coverage thresholds met
- [x] 2.3 Write failing E2E tests for `bdk export agents` covering every scenario of the `kernel-cli/export` delta (example run, byte-identical regeneration, `policy/generated-drift` on an edit and on a missing file, v2 agents untouched, `--host gemini` refused); verify they fail against the stub
- [x] 2.4 Implement the command (`--out` default from the bundle location, `--check` writes nothing), register the slice in `kernel/src/registrations.ts`, rebuild `dist/bdk.mjs`; verify `pnpm build && pnpm test:e2e` passes the tests from 2.3
- [x] 2.5 Generate `agents/{worker,reader,reviewer,runner,scout}.md` with `node dist/bdk.mjs export agents --host claude`, add `export agents --host claude --check` to CI next to the other generated-file checks; verify `pnpm skill-check` passes over `agents/` and the check exits 0

## 3. Role skills

- [ ] 3.1 Write a failing content test for the role skills covering every scenario of the `role-contracts` delta: seven directories, frontmatter fields, no `!` block, adapter names produced by the generator, file-only input wording, P3 terms absent, one git sentence in `implementer`, no `bdk-entries`, `bdk log add` named, body at most 4 096 bytes; verify it fails with `skills/roles/` missing
- [ ] 3.2 Add `"skills": ["./skills/roles/"]` to `.claude-plugin/plugin.json` and verify with `claude --plugin-dir . -p` (as in `tests/host-probe/run-headless.sh`) that the existing `skills/` names and the new `bdk:<role>` names are both listed
- [ ] 3.3 Write the seven role skills under `skills/roles/` per `role-contracts` and design.md T23-D14, D15, D17, D18, D24, reusing the P3 / P8 knowledge of `agents/plan-verifier.md`, `agents/design-verifier.md`, `agents/code-reviewer.md` and the return contract of `skills/subagent-execute-plan/references/return-contract.md`; review with `/bdk-skill-kit:skill-authoring`; verify the content test from 3.1 and `pnpm skill-check` pass
- [ ] 3.4 Live check on Claude Code: invoke `bdk:verifier` as a forked skill with a dummy package path and confirm from the `PreToolUse` payload that it runs as `bdk:reader` and that its first tool call is `dispatch show` (which answers `kernel/not-implemented` until part B); record the result in the PR description

## 4. Documentation

- [x] 4.1 Update `docs/guide/reference/agents.md`, the `README.md` Agents table and any drift-guarded listing to show the five adapters and the seven roles next to the v2 agents (v2 rows stay until T42); verify `pnpm docs:build` and the drift guards in `pnpm test:contract` pass
- [ ] 4.2 Check `docs/guide/` for mentions of a headless runner, `execution.runner` or `execution.host` and remove them; verify with a repository grep limited to shipped docs

## 5. Acceptance

- [ ] 5.1 Run the part A acceptance end to end: `node dist/bdk.mjs export agents --host claude --check` exits 0 on the committed tree and 2 after a hand edit; the role content test and `pnpm skill-check` pass; the fork check of 3.4 is recorded
- [ ] 5.2 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pytest tests/unit/` and `openspec validate v3-t23a-roles-adapters --strict`; verify all pass
