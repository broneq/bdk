# Approaches and self-critique

How `/bdk:design` presents a branching decision and pushes back on its own recommendation.

## One approach

Each approach of a decision carries:

- **Essence**: one sentence.
- **Components**: the modules or services involved, what each owns, where the boundaries run. Name the existing modules the code already has; a new one is marked as new.
- **Data flow**: how information moves on the happy path and on the main failure path.
- **Tradeoffs**: concrete, in the units of the project ("one more network hop on every login, p99 about 50 ms higher"), across scalability, latency, consistency, operational complexity and evolution. State build cost for transparency; weigh it as the `Rules: engineering-judgment` section says.
- **Diagram**: at least one Mermaid diagram, drawn per `/bdk:mermaid-drawer` when it is installed. Label the edges. When two approaches differ in shape, use the same diagram type for both so they compare side by side.

Then one recommendation with its reason, tied to the constraints the user stated or the code showed.

## Self-critique

Before asking, answer at least four of these questions for the recommended approach, from at least three groups, with concrete answers: "the dispatcher saturates above about 5 000 requests a second because it rebuilds the routing table on every change", not "scalability could be a concern". Every critique names at least one bottleneck, one single point of failure or operational risk, one hidden cost and one assumption the user did not confirm.

**Bottlenecks and limits.** Which component must every request pass? Which shared resource (connection pool, queue, lock, leader) is contended at ten times today's load? Which slow synchronous step sits on the critical path?

**Failure modes.** What happens when each external dependency fails? When a write succeeds in one place and fails in the next? Is there a retry storm, and what makes the operation idempotent? Where is state held, and what happens when its host restarts?

**Hidden costs.** How many hops does the happy path take? Is data duplicated, and which copy is the source of truth? Must two components agree on something, and how? What new thing must the on-call engineer understand?

**Assumptions.** What did the user not confirm that the design depends on: scale, consistency, team capability, a deadline?

**Boundaries and coupling.** Could two components merge without loss, or one split without complication? Does a call across a boundary carry more knowledge than it needs? What forces two parts to deploy together?

**Evolution.** What is the likely next feature on top, and does the design welcome it? Which decisions are cheap to reverse and which lock the project in? If the load pattern flips between read-heavy and write-heavy, what breaks first?

**Observability.** What is the first signal when this misbehaves at night? Can one request be traced end to end? Are the failure modes distinguishable in logs and metrics?

**Product.** Who cannot use the feature, and is that intended? What does the failure path look like to the user, and can they act on it? Which measure shows from day one that it worked? What is the smallest version that still delivers value?

## When only one approach is viable

Say so, and give for each alternative you considered the reason it fails: the constraint or the code it breaks. The user still confirms the approach before it is written.

## When to split the design

Write the design as parts when it spans three or more subsystems or would exceed 12 KB as one `design.md`. Settle the parts and their module boundaries in the conversation first; each part holds one concern and names the parts it `depends-on`. Decisions that cross parts go to the ledger, not into one part.
