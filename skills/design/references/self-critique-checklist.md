# Self-Critique Checklist — Devil's Advocate Pass

Run through this list every time you recommend a design. The goal is to expose weaknesses *before* the user does. If every answer is "no risk", you have not pushed hard enough — keep looking.

## Bottlenecks & Limits

- Where is the single component every request must pass through? When does it saturate?
- What's the hottest data path? Is it cached? Is the cache coherent?
- Does any shared resource (DB connection, queue, lock, leader) become contended at expected scale × 10?
- What's the slowest synchronous step? Is it on the critical path?

## Failure Modes

- What happens when each external dependency dies?
- What happens when a write succeeds in one place but fails in the next?
- Is there a retry storm risk? Idempotency story?
- Where is state held? What happens when the host holding it restarts?

## Hidden Costs

- Latency: how many hops does the happy path traverse? p99 impact?
- Data: am I duplicating data across services? Who is the source of truth?
- Coordination: do two services need to agree on something? How?
- Operational: how many new things does the on-call now need to understand?

## Assumptions

- What did the user *not* explicitly confirm that this design depends on?
- What scale numbers did I assume?
- What consistency expectations did I assume?
- What team capability did I assume (e.g., "they have ops bandwidth for Kafka")?

## Boundaries & Coupling

- Could two of these components be merged without loss? (over-decomposition)
- Could one of these components be split without complication? (over-coupling)
- Does any cross-boundary call carry more knowledge than necessary?
- What forces the system to be deployed/versioned together that shouldn't be?

## Evolution

- What's the most likely next feature on top of this? Does the design welcome it or fight it?
- Which decisions are reversible cheaply? Which lock us in for years?
- If load patterns change (read-heavy → write-heavy, or vice-versa), what breaks first?

## Observability & Debuggability

- When this misbehaves at 3am, what's the first signal? Is it visible?
- Can a single request be traced end-to-end?
- Are failure modes distinguishable from each other in logs/metrics?

## Product / UX (when Product or Combined branch)

- Who can't use this feature, and is that intentional?
- What does the failure path look like to the end user? Is it actionable?
- What success metric proves this worked? Can we measure it from day one?
- What's the simplest version that would still deliver value?

Pick at least **four** items across at least **three** categories and answer them concretely for the proposed design. Concrete = *"the dispatcher becomes a bottleneck above ~5k req/s because the routing table is rebuilt on every change"*, not *"scalability could be a concern."*
