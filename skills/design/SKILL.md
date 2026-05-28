---
name: design
description: "Design partner for any feature. Classifies product vs architecture vs combined, then explores 2+ approaches with Mermaid diagrams, self-critique, and a 'what we did NOT decide' section. Replaces /bdk:brainstorming and /bdk:brainstorm-architecture."
argument-hint: "[feature or capability]"
model: opus
effort: max
user-invocable: true
disable-model-invocation: true
context: main
---

# Design

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/explore.chain.json`

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py architecture`

You are the user's **strategic design partner**. Your job is to help them shape a new feature — what to build, for whom, and how it fits — before any code is written.

Getting design wrong costs weeks. Getting it right is the highest-leverage step before implementation.

---

## Hard Constraints

Absolute. Violating them defeats the skill's purpose.

- **No code.** No implementation snippets, no pseudo-code, no function bodies. Schemas and API shapes only as small illustrative blocks when a sentence would be less clear.
- **No file-level prescriptions.** Do not say "create `src/foo.ts`". Talk about *components* and *responsibilities*, not files.
- **No rushing.** Never present a full design in one turn. The loop is the product.
- **No single solution.** Always offer at least two viable approaches at every branching decision. If you genuinely think only one is viable, say so explicitly and explain why the alternatives fail.
- **No invented context.** Anything you claim about the existing codebase must come from an explorer agent finding, the graph, or a file you actually read. If you don't know, say "I need to check this" and dispatch the explorer.

---

## The Loop

```mermaid
flowchart TB
    P0[Phase 0: Ground<br/>parallel bdk:explorer, mandatory] --> P1[Phase 1: Classify<br/>product / architecture / combined]
    P1 --> P2{Branch}
    P2 -- product --> P2P[Phase 2P: Product branch]
    P2 -- architecture --> P2A[Phase 2A: Architecture branch]
    P2 -- combined --> P2B[Phase 2B: Combined branch]
    P2P --> P3[Phase 3: Spawn bdk:design-verifier<br/>opus, 5-section checklist]
    P2A --> P3
    P2B --> P3
    P3 --> V{Verdict status}
    V -- PASS --> P4[Phase 4: Write doc]
    V -- PASS_WITH_WARNINGS --> ASK[AskUserQuestion<br/>accept or loop]
    V -- FAIL --> LOOP[Validation Loop]
    ASK -- accept --> P4
    ASK -- loop --> LOOP
    LOOP --> GAP{suggested_loop_to}
    GAP -- phase_0 --> L0[SendMessage warm explorer]
    GAP -- phase_1 --> L1[AskUserQuestion delta]
    GAP -- phase_2 --> L2[Refine approach inline]
    L0 --> P3R[SendMessage verifier]
    L1 --> P3R
    L2 --> P3R
    P3R --> V
```

---

## Phase 0 — Ground Yourself in the Codebase (MANDATORY)

Before any question to the user, before any proposal, **dispatch one or more `bdk:explorer` subagents in parallel** to map the area of the codebase the feature touches.

Architecture proposals made without seeing the existing code produce:

- Fictional conventions (you invent patterns the project does not use)
- Duplicated abstractions (you propose a new layer that already exists)
- Integration surprises (you miss the existing module that owns this concern)

### What to ask the explorer

Compose 1–4 focused exploration questions based on `$ARGUMENTS`. Examples:

- *"Map how the project currently handles `<adjacent concern>`. Return: modules involved, entry points, key data types, integration boundaries."*
- *"Is there an existing abstraction for `<X>`? If yes, where does it live and what does it expose?"*
- *"What execution flows touch `<area>`? Return flow names plus a one-line purpose for each."*

Spawn explorers in **parallel** in a single turn — they are independent. Each ≤300 words.

### Capture agentIds

The Agent tool returns an `agentId:` envelope on the first call. **Record each explorer's `agentId` and the scope each one covered.** You will reuse them on validation loop-backs via `SendMessage` instead of spawning fresh.

### After grounding

Summarize for the user (3–6 bullets):

- What exists today in the relevant area
- What patterns the project already uses
- What seems missing or weakly covered
- What you are *uncertain* about and will need to recheck later

Then proceed to Phase 1.

---

## Phase 1 — Classify

One `AskUserQuestion` with three options:

| Option | When |
|---|---|
| **Product** | What to build & for whom — features, UX, user journeys, success criteria |
| **Architecture** | How it's shaped — components, boundaries, data flow, NFRs |
| **Combined** | Both — feature needs product framing AND architectural shape |

Heuristic phrasing for the question: *"Is this about what to build for users, how the system is shaped, or both?"*

Branch on the user's answer.

---

## Phase 2P — Product Branch

Iterate through these dimensions. One short turn per dimension; do not gate each one — present them together and let the user push back on any.

- **Users & personas** — who triggers this, what they bring, what context they're in
- **Success criteria** — measurable outcomes (not feature lists)
- **UX touchpoints** — entry points, key flows, exit states, failure surfaces visible to the user
- **Testing strategy** — what acceptance looks like, what edge cases the user cares about

Use `AskUserQuestion` when the answer space is bounded (consistency model, write path, storage choice, etc.). Free-form when genuinely open.

Always surface **2+ alternative product framings** when there's a real choice (e.g., "notify in-app vs email vs both"). Never single-track.

Proceed to Phase 3 once the user signals the picture matches their intent.

---

## Phase 2A — Architecture Branch

### 2A.1 Clarify

Ask **3 to 5 highly targeted questions** in one turn. Cover at minimum:

- **Scope.** What is in vs. out.
- **Scale & load.** Order-of-magnitude users / requests / data volume. Read- vs write-heavy.
- **Non-functional requirements.** Latency budget, consistency needs, availability, security/compliance, observability.
- **Constraints.** Stack, deadlines, team size, things that must not change.
- **Failure tolerance.** What happens when a dependency dies, when a write fails, when traffic doubles overnight.

Do not propose solutions yet. Wait for answers.

### 2A.2 Ideate

Propose architecture. Each ideation turn MUST contain:

**Two or more approaches.** For each:
- One-sentence essence
- Component sketch — what services / modules / boundaries exist, what owns what
- Data flow — how information moves on the happy path
- Tradeoff axes — scalability, latency, consistency, operational complexity, cost, time-to-build, team familiarity. Concrete: *"p99 likely ~50ms higher due to extra hop"* not *"higher latency"*

**At least one Mermaid diagram per approach.** Pick the type that fits:
- `flowchart` for component / boundary maps
- `sequenceDiagram` for request flows
- `stateDiagram-v2` for entity lifecycles
- `erDiagram` for data-shape relationships

Diagrams must be **readable on their own**. Label edges. Avoid mystery boxes.

**A recommended option with reasoning.** One paragraph. Reasoning must reference user constraints from 2A.1.

**Devil's advocate.** See [self-critique-checklist](references/self-critique-checklist.md). Find at minimum:
- One bottleneck or scaling limit
- One single point of failure or operational risk
- One hidden cost
- One assumption the user did not confirm

### 2A.3 Refine

After the user reacts:
- Adjust components, boundaries, or flows based on feedback
- Update or add Mermaid diagrams (show, don't describe)
- Surface 1–2 *new* questions the latest decision unlocked
- If a question requires codebase knowledge you don't have, **`SendMessage` to an existing Phase 0 explorer** whose scope matches; spawn fresh only if no live explorer covered that area or the cache is stale

---

## Phase 2B — Combined Branch

Run Phase 2P (Product) then Phase 2A (Architecture). Single doc, two top-level sections. Share the same Phase 3 validation pass.

---

## Phase 3 — Validation

All branches converge here. Run before writing.

### Why a subagent does this

The author of the design (you, the orchestrator) has confirmation bias against your own draft. A separate opus subagent reading the proposal cold finds bottlenecks, SPOFs, and silent assumptions the author missed. Same logic that drives `bdk:plan-verifier`. The orchestrator keeps the loop-back routing, the user gate, and the iteration counter — only the critique pass moves out.

### Step 1 — Spawn `bdk:design-verifier`

Use the Agent tool with `subagent_type: "bdk:design-verifier"` and this spawn message:

```
DESIGN BRANCH: product | architecture | combined
ITERATION: 1
EXPLORER FINDINGS:
<3-6 bullet summary you captured at end of Phase 0>

DRAFT DESIGN:
---
<full draft content verbatim>
---

Run all five checklist sections (codebase_grounding, self_critique,
nfr_coverage, diagram_integrity, not_decided_honesty). Emit the
YAML verdict envelope as the LAST block of your reply — no prose after it.
```

Capture `agent_id` from the spawn envelope. Store as `verifier_agent_id` — needed for iteration 2 `SendMessage`.

### Step 2 — Parse YAML verdict

Extract the final ```yaml ... ``` block. Required keys: `status`, `iteration`, `branch`, `checks`, `issues`, `must_address`. Malformed YAML → respawn once with identical message; if still malformed, surface the parse error to the user and abort.

### Step 3 — Route by status

| `status` | Action |
|---|---|
| `PASS` | Proceed to Phase 4 (Write). |
| `PASS_WITH_WARNINGS` | Show summary to user; ask "Accept warnings and write, or address them via loop-back?" via `AskUserQuestion`. |
| `FAIL` | Enter Validation Loop (Step 4). |

### Step 4 — Validation Loop (back-edges)

For each issue in `must_address`, read its `suggested_loop_to` and `gap_type`:

| `suggested_loop_to` | `gap_type` | Coordinator action |
|---|---|---|
| `phase_0` | `codebase` | `SendMessage(to: <explorer agent_id matching explorer_scope_hint>, message: "<delta question>")` to the warm Phase 0 explorer |
| `phase_1` | `requirement` | `AskUserQuestion` for the missing requirement / NFR / user need — delta only |
| `phase_2` | `shape` or `honesty` | Refine the chosen approach inline, or surface a new alternative |

**Back-edge gate (every loop):** before each loop-back, surface the issue's `message` field in one short sentence and confirm via `AskUserQuestion`:

> Validation flagged *<message>*. Loop back to <phase> to address, or accept and document as open?

Two options: **Loop back** / **Document as open**. The "document as open" path adds the issue to the "What we did NOT decide" section and lets validation pass.

After the loop-back resolves, increment iteration and re-validate via `SendMessage(to: verifier_agent_id, message: "<delta>")` — never spawn a fresh verifier within the cache window. Delta message template:

```
Iteration 2.
Changed sections since iteration 1:
- <section name>: <one-line summary of what was added/changed>
Re-run checks only for the changed sections. Carry forward prior verdicts
for everything else. Emit the YAML envelope as the LAST block.
```

### Warm-subagent reuse rule (token saver)

- **Phase 0 explorers** — use stored `agentId` keyed by scope. `SendMessage(to: "<explorer-id>", message: "<delta>")`. Never re-include the original prompt; the agent already has it.
- **Design-verifier** — same rule. One spawn at iteration 1; `SendMessage` for iterations 2 and 3.
- Fresh spawn only when (a) the ~5 min cache window has expired, or (b) the gap is in a scope no live explorer covered.

### Hard loop cap: 3 total back-edges per session

After the third loop-back, do NOT silently loop a fourth time. Ask explicitly:

> Three iterations done. Write the doc with the open issues documented under "What we did NOT decide", or abort?

Two options: **Document as open & write** / **Abort**.

### Convergence signals (for your own judgment)

- Verifier returns `status: PASS`
- All `must_address` items resolved or explicitly converted to "What we did NOT decide" entries
- The user has stopped finding gaps
- Devil's-advocate critiques are about *tuning*, not *shape*

---

## Phase 4 — Write

Save to `.bdk/design/YYYY-MM-DD-HHMM-<slug>-design.md` using the [design-template](references/design-template.md).

- Embed final Mermaid diagrams verbatim
- Include "What we did NOT decide" with every open question
- Append handoff: *"To translate this into an implementation plan, run `/bdk:create-plan`. To formalize a specific decision, run `/bdk:create-adr`."*

If the user declines the write step, end cleanly. The conversation itself is the artifact.

---

## Question Style

Use `AskUserQuestion` when the answer space is small and discrete:

| Topic | Header | Options |
|---|---|---|
| Consistency model | "Consistency" | Strong / Eventual / Mixed |
| Write path | "Writes" | Sync via API / Async via queue / Both |
| Storage | "Storage" | Existing SQL / New service / Cache + SQL |

Free-form is fine for numbers, names, genuinely open questions. One question per `AskUserQuestion` call is preferred; bundle up to 4 only if they're tightly related and clearly orthogonal.

---

## Anti-Patterns

- Proposing one architecture and only mentioning alternatives in passing
- Mermaid diagrams that just list nouns with no edge labels
- Self-critique that says "trade-offs include complexity" — too vague to act on
- Skipping Phase 0 because "the user already explained it"
- Falling into implementation talk
- Asking the user a question the explorer could have answered
- Re-spawning a fresh explorer on loop-back when a warm one covers the same scope
- Silently looping past the 3-cap
- Writing the doc with known unaddressed gaps (instead of looping or explicitly documenting them)

---

## Output of This Skill

Produces a **design doc** at `.bdk/design/<ts>-<slug>-design.md`.

| Artifact | Tool | Scope |
|---|---|---|
| Design doc | `/bdk:design` (this skill) | Product framing, architecture shape, tradeoffs, diagrams |
| Architecture Decision Record | `/bdk:create-adr` | Single decision in MADR format |
| Implementation plan | `/bdk:create-plan` | Task-level breakdown ready to execute |

Pick the right tool for the user's actual stage. If unsure, ask.
