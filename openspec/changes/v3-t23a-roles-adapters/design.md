# Design

## Context

See proposal.md, Why. T23 was discussed in a Lavish review before any artifact (six rounds, 2026-09-28) and its role mechanism was probed on Claude Code 2.1.283 (`docs/HOST-FACTS.md`, rows `roles-nested-default` to `send-to-main`, fixtures in `tests/fixtures/host-payloads/2.1.283/`). The decisions of that discussion are recorded here, prefixed `T23-D` so they do not collide with the design register's `D*`. This design is shared by the three T23 Changes; parts B and C cite it and add their own decisions.

State today: the kernel has the state schemas for packages, reports and evidence (`kernel/src/shared/store/state/{dispatch,report,evidence}.ts`), the `export` and `dispatch` commands exist only as index records answering `kernel/not-implemented`, `agents/` holds the 13 v2 agents, and `skills/roles/` does not exist.

Spike facts this design relies on:

| Fact (HOST-FACTS row)                           | Consequence                                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `roles-nested-default`, `roles-nested-manifest` | `plugin.json` needs `"skills": ["./skills/roles/"]`; the default `skills/` scan stays active. |
| `fork-plugin-agent`                             | `context: fork` with `agent: bdk:<adapter>` runs on the plugin adapter (Q-3 path A holds).    |
| `fork-bang`, `sub-bang`                         | `!` blocks resolve in forks and in subagent skill calls; not used by roles (T23-D17).         |
| `fork-concurrency`                              | Forked skills run one after another under `claude -p`; waves never rely on forks.             |
| `nested-agents`                                 | A subagent can start subagents (three layers); the swarm skill (part C) may build a tree.     |
| `send-by-name`, `send-by-id`, `send-to-main`    | `SendMessage` works by agent id and to `main`, not by a name given at spawn.                  |

## Goals / Non-Goals

**Goals:**

- Freeze the role contract so that part B can embed role bodies into packages and hash them (P10) without later churn.
- One generator path for adapters, checked in CI, so a hand edit of an adapter cannot survive.
- Remove the parts of the T23 contract that the discussion dropped (`dispatch run`, runner and host keys) before anything implements them.

**Non-Goals:**

- Dispatch packages, envelope checks, `rules show --ticket`, the `log ingest` rework, P8 in the kernel (part B).
- Evidence primitives, post-task nodes, the swarm skill, `log list --since-ticket-start`, prune (part C).
- Rewiring v2 skills to the new roles and deleting the v2 agents (T42). Guard hooks (T24).

## Decisions

### Decisions of the T23 discussion (all three parts)

- **T23-D0 Minimal prompt, context in files.** The orchestrator hands an agent the package path and at most one sentence; everything else is in the package or in files and commands it names, so nothing is lost to summarising, compaction or a retry. Enforcement is a T24 input (hook on `Agent`, risk R9). Specified in `role-contracts`, Dispatch prompt.
- **T23-D1 Three Changes** (A roles and adapters, B dispatch and envelope, C evidence and swarm), merged in order into `staging/v3`; issue #55 closes after C. Alternative: one Change - rejected, over 40 tasks across four slices in one review.
- **T23-D2 Spike first**, before any artifact. Done; facts above.
- **T23-D3 T23 ships the mechanism, the seven roles with their final contract and five adapters next to the 13 v2 agents.** `export agents` writes and checks only its five files. T42 removes the v2 agents and rewires v2 skills. Alternative: T23 ships mechanism only and T42 the roles - rejected, part B hashes role bodies (P10) and needs them final.
- **T23-D4 `verifier` runs on `reader`** (read-only, opus). T42's plan text (`verifier` on `runner`) is corrected here.
- **T23-D5 Rules on demand.** The package names `bdk rules show --ticket <ticket>` (part B; selection by file and role, T31 switches it to rule IDs) instead of inlining rule text, because today's rule files (about 38 KB) cannot fit a 12 KB package (K4). `reader` gains `Bash` for this. The "forked roles inline rules through `!`" half is superseded by T23-D17.
- **T23-D6 No kernel-spawned host processes.** `dispatch run`, `execution.runner` and `execution.host` are dropped; waves run through the host's own subagents, driven by a swarm skill (part C, called by `execute` and `cr`) with host notes in `references/hosts/` (Claude Code only for now). The skill states principles (disjoint `Files:` for isolation, a tree of agents when warranted, prompt = package path), not host mechanics. `execution.concurrency` stays. Supersedes the "two runners" extension of Q-3. Alternative: a `headless` runner (`claude -p` per package) - rejected: a nested `claude -p` counts as a user-typed prompt for the stage guard (HOST-FACTS `upe-headless`), needs broad permission flags, and forks do not run concurrently under `-p`.
- **T23-D7 Evidence freshness** hashes the `Files:` of the whole part plus build-feeding config (part C).
- **T23-D8 Citations**: `file#/json/pointer`, `file:line`, `file:line=text`; no file means the manifest's only file; binaries are not citable (part C).
- **T23-D9 Post-task node order**: `simplify` (worker package kind `simplify`), then `tests-scoped` and `lint` (runner); a node is done on fresh evidence with `pass`, or `not-run` within budget (part C).
- **T23-D10 `template-hash`** = sha256 of the template skeleton, the role body and the rule texts, normalised to LF, no trailing whitespace, no frontmatter (part B).
- **T23-D11 The package template lives in kernel code** and is not overridable, so T40 can measure it; role bodies and rules stay overridable (part B).
- **T23-D12 Prune**: T23 ships the prune function and the hash-index format; T30's `change close` calls it (part C).
- **T23-D13 Package ledger content**: only `decision(accepted)` and `blocker` entries of the task in full, plus counts per type and the `bdk log list --for` command. The per-dispatch `observation` cap and `policy.log.max-observations` are dropped. Changes K3 ("summaries of finding / observation / assumption by refs") (part B).
- **T23-D14 One ledger channel.** Every role writes with `bdk log add --ticket`; a role other than the implementer stores its report with `bdk log ingest --ticket` from stdin, which becomes agent-available (part B). `bdk-entries` leaves the role contracts. Supersedes T2's split by role class; T2's rejected option C ("Bash for everyone") is effectively taken for the read-only adapters, with file writes through Bash blocked by T24 (new T24 input). T2's trigger for a narrow MCP server stays recorded.
- **T23-D15 The ledger is the channel between agents** (`log add` with refs, `log list --for`, `--since-ticket-start` in part C). A finding that must stop other work also goes to `main` by `SendMessage`, naming the entry id (HOST-FACTS `send-to-main`).
- **T23-D16 Freshness ignores non-executable files** through a deterministic file-class filter, overridable in `policy.evidence`; stale evidence means rerun, and an agent can never declare evidence fresh (part C).

### Decisions of part A

- **T23-D17 Roles have no `!` block; the agent reads its package and rules through commands.** The body's first step is `bdk dispatch show <path>`, then `bdk rules show --ticket <ticket>`. Reasons: the `content-wrapper` regex (`kernel-cli`, Output modes) allows `!` only for `ctx skill <name>` and `next` (Key boundaries); inlining a package would need `$ARGUMENTS` inside a shell command, an injection path the guards never see, and the spike did not probe whether `$ARGUMENTS` expands before `!`; one path serves forks and Agent-tool dispatch on every host. Alternative: widen the wrapper to `ctx role <role> $ARGUMENTS` - rejected (user choice 2026-09-28): two input paths, a new probe and argument validation for a guarantee that part B's telemetry and `attempt close` finding cover (R2). Supersedes the `!bdk dispatch build` inlining of Q-3 path A.
- **T23-D18 Frontmatter `user-invocable: false`, not `disable-model-invocation: true`.** The orchestrating skill invokes a role through the Skill tool, which `disable-model-invocation` forbids; `user-invocable: false` only hides the role from the `/` menu. No `model` in a role: the adapter supplies it (`require-model` applies to agents only). T42's text is corrected.
- **T23-D19 Adapter definitions live in kernel code** (the `export` slice: sentence, tool classes, model tier per adapter; tool map per host), not in `prompts/adapters/` files as T42 assumed. Adapters are plugin content, not project content, so there is nothing to override; one source makes the byte-identical check trivial. Alternative: Markdown sources under `prompts/adapters/` - rejected, a second source that must agree with the generator's tool map.
- **T23-D20 Tool sets.** `SendMessage` on every adapter (T23-D15; a sibling without it cannot answer, HOST-FACTS `send-by-id`). `Bash` on every adapter (kernel commands). Only `worker` has `Edit` / `Write`, so `runner` stores its report through `log ingest` like the read-only roles; this narrows T2, where the runner wrote its report file. No `Agent` tool yet: whether workers may spawn sub-trees is part C's swarm decision. Model tiers from `docs/V3-SKILL-INVENTORY.md` 13.2.
- **T23-D21 `export agents` supports `--host claude` only in 3.0.** The flag's values shrink to `claude`, so other hosts get `input/invalid-argument`. A tool map that no live host verified would be guesswork; T50 adds hosts through the swarm skill's references. Alternative: keep four hosts with best-effort maps - rejected for the same reason.
- **T23-D22 `--out` defaults to the plugin root's `agents/`** (the directory holding the bundle's `dist/`), and the generator touches only its five paths. `policy/generated-drift` (exit 2) is the `--check` refusal; today's spec declared `--check` exits 2 without a rule or the exit code, a contract bug fixed here.
- **T23-D23 Role body budget 4 096 bytes**, a third of the 12 KB package, leaving room for the task text, decisions and blockers (K4). Checked by a content test.
- **T23-D24 Role to verdict kind.** `verifier` judges a plan part (`plan-verify` verdict kind, T21); `design-verifier` the design. The `plan-verifier` spelling in the `log ingest` example is fixed by part B when it rewrites that requirement.

### "To resolve in the spec" of T23, where each item landed

| Item                                         | Resolution                                       |
| -------------------------------------------- | ------------------------------------------------ |
| Exact package template per role              | T23-D11, D13; written in part B                  |
| `template-hash` normalisation                | T23-D10                                          |
| Citation format per evidence kind            | T23-D8                                           |
| Observation limit per dispatch in policy     | Dropped (T23-D13)                                |
| Form of the `bdk-entries` block              | Dropped from role contracts (T23-D14)            |
| Per-host tool and permission map             | Claude Code tool map in kernel code (D19 to D21) |
| How the `headless` runner passes the package | Dropped with the runner (T23-D6)                 |

## Risks / Trade-offs

- [R1 Host changes the role mechanism in a later version] → Facts carry the host version in HOST-FACTS and the probe reruns with one command; the fallback for single-instance roles is the Agent tool with the same package, no change to role definitions.
- [R2 An agent skips `rules show --ticket` and codes without rules] → The command stands before the role's work in every contract; part B records the call per ticket and `attempt close` adds a `finding` when a worker closes without it; T31 adds rule-ID citations; T40 measures on-demand versus embedded rules.
- [R3 Evidence fresh although a shared file outside the task changed] → T23-D7 widens the hash to the part (part C); changes outside the part are caught by the end-of-plan full suite.
- [R4 18 files in `agents/` during the transition] → Generated marker in each adapter, `export agents --check` in CI; the STARTUP agents table (generated from `agents/`, P11) lists the adapters with descriptions that say they are started by BDK role skills, not for general tasks.
- [R5 Orchestrator drops or rewrites entries] → Gone with T23-D14: agents write entries themselves; `attempt close --envelope` still checks the ids.
- [R6 Evidence primitives without a real consumer] → `tests-scoped` and `lint` consume them from day one (part C).
- [R7 P8 downgrade hides a real blocker] → Downgraded entry keeps `review: true` and its text; `log ingest` lists `downgraded` (part B).
- [R9 Orchestrator pads the prompt] → Contract in `role-contracts`; hook on `Agent` is a T24 input.
- [Read-only adapters now have Bash] → A reader can write files through Bash until T24's guard lands; accepted for the `staging/v3` window, no release ships between A and T24.
- [Roles and B/C specs disagree until B lands] → `kernel-state` Report envelope and `log ingest` still describe `bdk-entries`; part B rewrites them. Roles are content only until B, nothing dispatches them.

## Migration Plan

Contract-only removals (`dispatch run`, `execution.runner`, `execution.host`) had no implementation and no user settings in a release, so no migration. Rollback is a revert of the PR; `agents/` v2 files are untouched.
