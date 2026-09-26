# Docs and decisions

Four skills for the writing side of the work: recording a decision, explaining code that
is hard to read, keeping an existing doc true, and drawing the diagram in all of them.

| Skill | Use when |
|---|---|
| `/bdk:create-adr` | A decision has been made and needs to outlive the conversation |
| `/bdk:explain-complex-code` | A module is hard to onboard onto and has no architecture doc |
| `/bdk:update-docs` | An architecture doc exists and the code moved under it |
| `/bdk:mermaid-drawer` | You are drawing any diagram, in any of the above or on its own |

## Record a decision - `/bdk:create-adr`

```
/bdk:create-adr <decision context, options, constraints, preferences>
```

Generates an Architecture Decision Record in MADR format. It extracts the problem
statement, considered options, decision drivers, and stated preference from your free-form
description, and asks only about what is genuinely unclear - always the ADR status
(proposed / accepted / rejected / deprecated), never the decision-makers, consulted, and
informed fields, which are left as `{TBD}` for you to fill in.

It scans `docs/adr/` for existing `NNNN-*.md` files and takes the next sequential number,
zero-padded to four digits. The file lands at `docs/adr/NNNN-{slugified-title}.md`.

Consequences are marked with symbols, not prose labels: `✅` for positive, `❌` for
negative, `🟡` for neutral.

!!! note
    Diagrams in an ADR are optional and only added when they carry genuine visual value -
    architecture options with different component layouts, or different data flows. A
    trivially simple or abstract decision gets none.

`/bdk:design` ends by pointing here: a design doc explores the space, an ADR formalizes
one decision out of it.

## Explain a module - `/bdk:explain-complex-code`

```
/bdk:explain-complex-code <path>
```

Analyses the code structure, maps dependencies through the session's exploration tier,
then partitions the module and launches subagents - never more than three or four - all in
one message. Where the code graph is available, community boundaries decide the
partitioning; otherwise file count does:

| Files | Subagents |
|---|---|
| 1-2 | 1 |
| 3-5 | 1-2 |
| 6-10 | 2-3 |
| 10+ | 3-4 |

The synthesized doc has seven parts: overview, core architecture with a file tree,
architecture flow, critical rules, live examples, core classes, and testing coverage.

!!! warning
    Live examples are **prototype code, never the actual implementation**: placeholder
    function names, clear control flow, comments on key steps, under 20 lines each, one
    concept per example. A doc that pastes the real implementation goes stale the day the
    implementation changes.

A `Stop` hook checks the result before the skill can finish - file saved in the right
place, overview present, file tree present, at least one Mermaid block, critical rules,
prototype examples, core classes, testing coverage. Missing sections come back as a
failure with the list. See [Hooks](../reference/hooks.md).

Output: `.bdk/explain-complex-code/<feature-name>.md`.

## Refresh a doc - `/bdk:update-docs`

```
/bdk:update-docs <doc_path>
```

Parses the existing doc into sections, module root, code references, file list, and every
embedded Mermaid block. Then it explores the current code with **comparison-aware**
subagents: each one receives the doc's claims alongside the files, and reports what is
ACCURATE, what is OUTDATED, what is NEW, and what is GONE - diagrams included, node by
node.

You approve the plan before anything is written, in a single question:

```
Update plan for [doc_path]:

  KEEP:     [list of accurate sections]
  UPDATE:   [list of outdated sections with brief reason]
  ADD:      [new content to add]
  REMOVE:   [orphaned references to clean up]
  DIAGRAMS: [list of diagrams to update/add/keep with brief reason]

Approve this update plan?
```

Accurate sections are copied verbatim, which is what preserves hand-written prose,
formatting, and wording. Orphaned references are simply omitted - no "removed" comments.

!!! note
    The result reads as one uniform document. No changelog markers, no "updated on"
    annotations, no diff markers. A diagram that is still correct but predates the current
    standard is not outdated - it is left alone, so updates stay reviewable as content
    changes rather than churn.

Output: the same path you passed in.

## Draw the diagram - `/bdk:mermaid-drawer`

```
/bdk:mermaid-drawer <what to draw>
```

Every BDK skill that emits a diagram emits it through this standard, so diagrams read the
same whoever drew them and wherever they are viewed. Invoke it directly to draw one.

It fixes the parts that go wrong anyway:

- **Type by relationship, not by habit.** Components and boundaries are a `flowchart` with
  subgraphs; anything crossing services over time is a `sequenceDiagram`; an entity's
  lifecycle is a `stateDiagram-v2`; cardinality is an `erDiagram`. If the answer to "what
  does this show" contains the word *then*, it is a sequence diagram - a request path
  drawn as a flowchart silently loses the return leg, the waiting, and the ordering.
- **Node budget.** 15 nodes hard ceiling, 8 is better. Over budget means the diagram is
  answering two questions; split it at a boundary and draw two.
- **Colour encodes, or is absent.** The default is no colour, because Mermaid's built-in
  theme already adapts to light and dark. When colour is used it comes from a six-role
  palette, and every `classDef` sets `fill`, `stroke` **and** `color` together - `fill`
  without `color` is the defect that makes a diagram unreadable in dark mode while looking
  fine to whoever authored it in light mode.
- **Draw only when a picture beats prose.** Three sequential steps with no branching is a
  sentence. A list of components with no edges is a bullet list.

## What you get

| Skill | Artifact |
|---|---|
| `/bdk:create-adr` | `docs/adr/NNNN-<slugified-title>.md` |
| `/bdk:explain-complex-code` | `.bdk/explain-complex-code/<feature-name>.md` |
| `/bdk:update-docs` | the doc at the path you passed in, rewritten in place |
| `/bdk:mermaid-drawer` | one Mermaid block, in whatever document you are writing |

None of these commit. Files are generated; when they land in git is your call.

## Next step

[Rules hygiene](rules-hygiene.md) - the other half of written knowledge, and the one that
rots fastest.
