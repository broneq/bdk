# Design

## Context

Tracks #307. The execute stage runs `bdk check run` from three blocks: `/bdk:implement-part` (steps 4 and 6), `/bdk:conform-part` (step 5) and `/bdk:resolve-conflict` (step 4). `/bdk:execute-waves` runs no check itself; after it merges a wave, nothing checks the merged Change branch until `/bdk:review-round` runs `bdk check run <run dir> round-N --round N` without `--scope`. A `--scope` run uses an entry's `scoped` variant on the scope files its `paths` match, skips an entry whose `paths` match none, and runs the full `command` of an entry with no `scoped` variant (`plugins/bdk/src/check/domain/plan.ts`). The docs show none of this in the execute diagrams.

## Goals / Non-Goals

**Goals:** a reader of the execute docs sees every check run of the stage, on which files it runs, what happens when it is red, and what is left unchecked until review.

**Non-Goals:** changing a skill; changing the behaviour of #306 (one-part wave in the main checkout).

## Decisions

### D1. The checks go into the existing diagrams, and a table holds the details

The part flowchart gets nodes for the red acceptance tests, the part checks with their three runs and the conform checks; the merge flowchart gets the checks of `/bdk:resolve-conflict`. The id, kinds, scope and the action on red of each run go into one table under the diagrams, not into the nodes.

Why: the issue asks the diagrams to name every run, but a node that also carries kinds, scope and retry rules grows past what a flowchart node reads well at the site's width. A table is the one place a reader compares the runs. Alternative rejected: a new, separate "checks" diagram, which would repeat the part flow and drift from it.

### D2. The scope is described as the CLI resolves it

The text says a part's checks run with the part's `files` as scope: an entry with a `scoped` variant checks those files that its `paths` match, an entry whose `paths` match none is skipped, and an entry without `scoped` runs its full command. It links to the configuration page for `scoped` and `paths`.

Why: "scoped to the part's files" alone is wrong for an entry without `scoped`, which runs on the whole project; a reader tuning check time needs the exact rule.

### D3. "What is not checked" is stated as a fact of the flow, with its consequence

The page says that a worktree part's checks run in its worktree, so they see the Change branch as the wave started plus that part, never the other parts of the same wave; that a clean merge runs no check; and that the first run of every check on the whole merged Change is the first round of `/bdk:auto-review`, whose red check is a `blocker` finding.

Why: this is the gap a reader most needs to know about when they stop after `/bdk:execute`. Whether execute should check the merged wave is a product question, not a docs one; this Change does not file it as a bug, since the skills behave as #307 lists.

### D4. The two "three"s are told apart in gates-and-budgets

`policy.budgets.part-attempts` (3) counts implementer runs; inside each run the implementer runs the part checks up to three times, a fixed number. The budgets page says so in one sentence.

Why: both are three, and a reader of the budget table otherwise reads the check retries as the budget.

### D5. Merging with #306

#306 changes the execute-waves flowchart of the same page in parallel. This Change edits only the part flowchart, the merge flowchart, the sequence diagram's surroundings and new text, not the execute-waves flowchart, so the overlap is small; whichever lands second merges the other's text.

### D6. The two edited flowcharts set their own wrapping width; no subgraphs

Mermaid 12 wraps a flowchart label at 120 px, which broke `/bdk:implement-part` and `bdk check run NN-red` mid-word on the rendered site. The part and merge flowcharts set `%%{init: {"flowchart": {"wrappingWidth": 200}}}%%`, as the sequence diagram of the same section already sets its own `init`, and keep each label line short enough to fit. A subgraph per worker agent was tried first and dropped: with the retry edge back to the implementer, the layout put the conformer above the implementer.

Why: a per-diagram setting fixes the diagrams this Change touches without reflowing every diagram of the site; the site-wide default is filed as its own issue.

## Risks / Trade-offs

- [The table and the skills drift] -> each row names the skill step it comes from, and the page's Sources already list the skills.
