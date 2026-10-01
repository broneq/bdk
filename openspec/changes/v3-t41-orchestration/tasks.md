# Tasks

## 1. Plan and prompt convention

- [x] 1.1 Update the T41 section of `docs/V3-IMPLEMENTATION-PLAN.md`: the five T41 Changes (`v3-t41-orchestration`, `-execute`, `-plan`, `-design`, `-lifecycle`), the orchestration layer of this Change, and `verify-design` as a separate stage skill on a fresh context next to `verify-plan`; verify the section names each Change with its skills and that `pnpm docs:build` stays green
- [x] 1.2 Write `.claude/rules/prompt-writing.md` with `paths:` covering `skills/**` and `agents/**`, carrying the T41-D10 principles with one positive example each and the two guides as sources; verify the frontmatter scopes the two globs and `.claude/rules/skills.md` gains no duplicate of it

## 2. Registry and settings

- [x] 2.1 Write failing unit tests for the `agents` settings module and `policy.budgets.part-lead` (the defaults and `ttl` out of range scenarios of `kernel-settings`); verify they fail for the missing keys
- [x] 2.2 Register the `agents` module and the `part-lead` budget, regenerate `schema/settings.json` with `pnpm build`; verify the tests of 2.1 pass and `bdk config show agents --json` prints the defaults
- [x] 2.3 Write failing unit tests for the registry in `kernel/src/agents/`: row upsert in either order (link before start), state derivation (`starting`, `running`, `suspect` by TTL and by open-call limit, `ended`, revived by a newer heartbeat), stale-session end, replacement of a registry of another version, independence from `index.sqlite`; verify they fail
- [x] 2.4 Implement the registry database `.bdk/.machine/agents.sqlite`, the heartbeat reader and the message and cursor tables; verify the tests of 2.3 pass and the structure test shows `agents` importing only `shared/`

## 3. `bdk agents` commands

- [x] 3.1 Add `agents list`, `agents show` and `agents wait` to `schema/cli/commands.json` with `slice: agents`, their availability classes and output schemas `agents-list.json`, `agents-show.json`, `agents-wait.json`; verify `pnpm test:contract` fails only on the missing implementations
- [x] 3.2 Write failing E2E tests through `dist/bdk.mjs` for every scenario of `kernel-cli/agents` (affected by a file ref, a part ref reaching the lead, suspect without a hook, ended hidden by default, `input/not-found`, `wait` on report, message, suspect, cursor, event between waits, timeout, timeout above 540)
- [x] 3.3 Implement the three commands in `kernel/src/agents/`, `--affected-by` with the entry-target match rule shared with `dispatch build`, and `wait` with a one-second poll and the per-agent cursor; verify the tests of 3.2 and `pnpm test:contract` pass
- [x] 3.4 Update the kernel-architecture module list and dependency matrix in the kernel (slice registry, import scan); verify the "agents is a leaf" structure scenario passes

## 4. Agent hooks, guards and heartbeat

- [x] 4.1 Write failing E2E tests with the 2.1.284 fixtures for `hooks subagent-start` (context lines for a linked `bdk:` agent, id only for a foreground spawn, nothing for `Explore`), `hooks post-tool` (background link at launch, foreground end, `TaskStop` end) and the stale-row end of `hooks session-start`
- [x] 4.2 Implement `hooks subagent-start`, `hooks post-tool` and the stale-row end, with their output schemas; verify the tests of 4.1 pass
- [x] 4.3 Write failing E2E tests for the Continuation check and `hooks stop` / `hooks subagent-stop` (T40 early stop sent back, open question passes, background leads pass, worker without a report, lead with a task left and `elapsed`, limit without progress with its `finding`, ordinary conversation, broken Change never traps the user)
- [x] 4.4 Implement the Continuation check shared by both hooks, the `continuations` counter with its progress reset and the stall `finding`; verify the tests of 4.3 pass
- [x] 4.5 Write failing tests for the new pre-tool guards: `guard/lead-scope` (own part passes, other part and no package denied, `part done` stays `guard/subagent-kernel-command`), `guard/agent-spawn` (lead types, worker scout within and over the limit, worker starting a worker), `guard/agent-message` (no ledger id, too long, recipient ended, admitted message recorded), `guard/reader-write` for `bdk:lead`, `guard/dispatch-prompt` for `bdk:lead` and the worker's scout exemption
- [x] 4.6 Implement the guards in `hooks pre-tool` in the specified order, add the four rules to the rule catalogue and the lead exception to the availability check; verify the tests of 4.5 and `pnpm test:contract` pass
- [x] 4.7 Write failing script tests for `hooks/guard/pre-tool.sh` and a new `hooks/guard/post-tool.sh`: heartbeat `open` / `idle` without Node, no heartbeat outside a BDK project, an id outside `^[A-Za-z0-9_-]+$` ignored, the widened prefilter (`bdk:lead`, `SendMessage`), `post-tool.sh` starting Node only for `Agent` and `TaskStop`
- [x] 4.8 Implement both scripts and register `PreToolUse` and `PostToolUse` without matcher and `SubagentStart`, `SubagentStop` and `Stop` in the agent form in `hooks/hooks.json`; verify the tests of 4.7, the "hooks file entries" and "agent hooks without a kernel" scenarios pass
- [x] 4.9 Add the heartbeat, agent-hook and `wait` wake-up budgets to `pnpm test:perf`; verify each p95 is under its budget locally and the report names every value
- [x] 4.10 Update the Purpose of `openspec/specs/kernel-cli/hooks/spec.md` from five to nine entry points, and `docs/guide/reference/hooks.md` with the agent hooks, the heartbeat and the continuation check; verify `pnpm docs:build` and the docs drift guards in `pnpm test:contract` pass

## 5. Lead ticket, lead package and serialised commits

- [x] 5.1 Write failing tests for the `part-lead` loop: the attempt record accepts it, budget `policy.budgets.part-lead`, `ok` gives `next.action: part-done`, `ok` with an open task ticket refuses with `policy/ticket-open`
- [x] 5.2 Implement the loop in the attempt record schema, `attempt open` and `attempt close`; regenerate `schema/state/` with `pnpm build`; verify the tests of 5.1 pass and the state fixture still validates
- [x] 5.3 Write failing tests for `dispatch build <part> lead <ticket>` (package with `adapter: lead`, the `Tasks` section marking committed tasks, `lead` on a task ticket and another role on a `part-lead` ticket refused)
- [x] 5.4 Implement the lead package; verify the tests of 5.3 pass and a lead package of an 8-task fixture part stays under 12 288 bytes
- [x] 5.5 Write failing tests for serialised commits (two concurrent `bdk commit` processes both succeed with their own trailers, `policy/commit-busy` after 60 s with a live holder, takeover of a dead holder's lock)
- [x] 5.6 Implement the commit lock and add `policy/commit-busy` to the catalogue; verify the tests of 5.5 and `pnpm test:contract` pass

## 6. Roles, adapters and the swarm skill

- [x] 6.1 Write failing content tests for the six adapters (tools, `Agent` only on `lead` and `worker` with their type lists, `effort`, no file-writing tool on `lead`) and for nine role skills
- [x] 6.2 Add the `lead` adapter, `Agent(scout)` on `worker` and `effort` to the kernel's adapter definitions and the Claude Code tool map, regenerate `agents/` with `bdk export agents --host claude`; verify the tests of 6.1 pass and `bdk export agents --host claude --check` reports no drift
- [x] 6.3 Write `skills/roles/lead/SKILL.md` and add the Messages paragraph to the eight existing role contracts and the no-package case to `scout`, following `.claude/rules/prompt-writing.md`; verify the role content tests (messages in every contract, the lead waits, size <= 4 096 bytes, no bang block) and `pnpm skill-check` pass
- [x] 6.4 Rewrite `skills/swarm/SKILL.md` and `skills/swarm/references/hosts/claude-code.md` per the Swarm skill requirement; verify the swarm content tests (shape, single resume, no flat-swarm sentence) and `pnpm skill-check` pass
- [x] 6.5 Update `README.md` (Agents table: `lead`), `docs/guide/concepts/agents.md` and `docs/guide/reference/agents.md` with the tree, the registry and the messages; verify `pnpm docs:build` passes

## 7. Acceptance

- [x] 7.1 Add an E2E test through `dist/bdk.mjs` on a fixture Change with two parts, driven by the 2.1.284 payload shapes: `main` opens and dispatches two `part-lead` tickets in the background; each lead dispatches its workers, a worker's entry reaches the affected sibling through `agents list --affected-by` and an admitted message, `agents wait` returns the report, the lead closes, commits and stores its report, the continuation check blocks a lead with a task left, and `part done` passes for both parts; a worker cut off without a signal turns `suspect` and its lead's `wait` returns it
- [x] 7.2 Run a live headless check with `tests/host-probe/run-headless.sh` (a new `bdk-tree` check): a real lead starts two background workers, waits in `bdk agents wait`, receives one message and both reports; record the outcome as a HOST-FACTS row with its anonymised fixture and keep the Timeline file out of git
- [x] 7.3 Run `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pnpm test:perf`, `pnpm skill-check` and `pnpm docs:build`; verify all pass
- [x] 7.4 Run `openspec validate v3-t41-orchestration --strict`; verify it reports the Change valid
- [x] 7.5 Read the command word `bdk` as a kernel command in `hooks pre-tool` (Pre-tool command reading), so a `bdk` shell function no longer hides a verb from `guard/hooks-from-bash`, `guard/subagent-kernel-command` and `guard/lead-scope`; found by the live `bdk-tree` check
