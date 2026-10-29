---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/tests/agent-models.test.ts
  - plugins/bdk/tests/agent-run-mode.test.ts
  - plugins/bdk/evals/verify-design-second-pass
  - tests/eval-suites.test.ts
---

# ADR-0023: An agent block starts its own agent through `Agent` and `Skill`, so it can be continued

## Context and Problem Statement

Most BDK blocks run on an agent of their own: a fresh context with only the block's input in it, a model set by `models.<agent>`, and an author that never checks its own work ([ADR-0003](./0003-v3-architecture-skills-first.md)). The host offers three ways to put a skill into an agent: a skill with `context: fork` and `agent:`, an agent whose frontmatter preloads the skill under `skills:`, or an `Agent` call whose prompt tells the agent to run the skill with the `Skill` tool. The design and plan loops must continue the same verifier after a fix with `SendMessage`, so a second pass reads only what changed. And a user may type any block in the main thread. How does a block reach its agent, whoever calls it?

## Decision Drivers

- **Continuation:** `/bdk:design` and `/bdk:plan` continue one verifier across passes; that needs the agent's id.
- **Speed** (problem 1 of v3): agents of one stage start in parallel, also in `claude -p`.
- **One shape for every caller:** a typed command and a lead's call must behave the same (model, context), or an eval measures a path the stages never use.
- **One block, one job:** one agent may serve several blocks (`bdk:verifier` runs `/bdk:verify-design`, `/bdk:verify-plan` and `/bdk:spec-conformance`) and must carry only the one it runs.

## Considered Options

1. **`Agent` + `Skill`, with a step 0 hand-off:** the caller starts the agent with a prompt naming the skill; a block typed anywhere else starts its agent itself.
2. **`context: fork` with `agent:`** in the skill.
3. **`skills:` preload** in the agent file.
4. **The process in the agent's body**, no skill.

## Decision Outcome

**Chosen option: 1.** The caller starts `Agent(subagent_type: "bdk:<agent>", prompt: "Run the skill bdk:<block> ...")`, in the foreground, with `model` and `effort` from `models.<agent>` when set; the agent loads the skill with `Skill`. Every block with an agent of its own opens with a step 0: run anywhere but in its agent (a user typed it in the main thread), it starts that agent the same way, waits, and replies with the agent's result, never doing the work itself. The blocks of this shape: `/bdk:explore-project`, `/bdk:explore`, `/bdk:recon`, `/bdk:design-draft`, `/bdk:verify-design`, `/bdk:plan-draft`, `/bdk:verify-plan`, `/bdk:implement-part`, `/bdk:conform-part`, `/bdk:repair-wave`, `/bdk:spec-conformance` and `/bdk:diagnose-run`. A caller continues a verifier with `SendMessage`; the verifier keeps stable item ids by reading its previous report file, so a fresh verifier after a lost context numbers items the same way.

The review blocks and E2E are the named exception: `bdk:reviewer`, `bdk:integration-reviewer`, `bdk:judge` and `bdk:e2e-tester` preload their one skill under `skills:`, are started by a round's lead, never continued, and typed by a user they run in the main thread without a step 0.

It is the only option that gives the caller an agent id, starts agents in parallel and keeps a typed command identical to the stage's call.

### Consequences

- ✅ The design and plan verifier loops continue one agent, so a second pass reads only the fix.
- ✅ The `Skill` call shows in a transcript, so evals and `/bdk:diagnose-run` see that the block ran.
- ✅ `models.<agent>` reaches every start of the agent, from any stage (`tests/agent-models.test.ts`).
- ❌ Typing a block spawns an agent: one more start and turn than doing the work in place.
- ❌ Two loading patterns coexist (skill call and preload), so a new block must pick one by this record.
- 🟡 The pattern rests on host behaviour (no agent id from a fork, serial forks in `claude -p`), measured in #190; a host change could reopen option 2.

## Pros and Cons of the Options

### 1 - `Agent` + `Skill`, step 0

- Good: agent id for `SendMessage`; parallel starts; one block per agent run; the same path for a user and a lead.
- Bad: an agent start per typed block; every agent block carries the step 0 text.

### 2 - `context: fork`

- Good: the host does the hand-off.
- Bad: returns no agent id, so no continuation; forks run one at a time in `claude -p`; `models.<agent>` cannot reach it.

### 3 - `skills:` preload

- Good: no extra turn to load the skill.
- Bad: a shared agent would carry every block it serves; a preloaded skill gets no `$ARGUMENTS`; chosen only for the review and E2E agents, which serve one block each and are never continued.

### 4 - Process in the agent body

- Good: one file.
- Bad: logic leaves the skills; no `/bdk:<block>` command and no with/without skill eval.

## More Information

Archived Changes `v3-190-design-blocks` (design D2), `v3-191-plan-blocks` (design D2), `v3-192-execute-blocks` (design D1) and `v3-193-review-blocks` (design D1). Who starts whom: [Blocks and agents](../concepts/agents.md).
