# Docs and decisions

::: warning Describes BDK v2
This page describes BDK v2. The v3 documentation replaces it (T50).
:::

Three skills for the writing side of the work: recording a decision, documenting code and
keeping that documentation true, and drawing the diagrams in both.

| Skill                       | Use when                                                                     |
| --------------------------- | ---------------------------------------------------------------------------- |
| `/bdk:adr`                  | A decision has been made and needs to outlive the conversation or the Change |
| `/bdk:docs`                 | A module has no architecture doc, or the code moved under an existing one    |
| `/bdk-craft:mermaid-drawer` | You are drawing any diagram on its own                                       |

## Record a decision - `/bdk:adr`

```
/bdk:adr <decision context, options and choice>
/bdk:adr L-3
/bdk:adr 2026-09-25-passwordless-login/L-7
```

Writes an Architecture Decision Record in MADR format. From a free-form description it
takes the problem, the options, the drivers and the choice. From the id of a `decision`
entry - bare for the active Change, `<changeId>/L-...` for any Change, archived ones
included - it reads the entry with `bdk log show` and builds the record from its summary
and body. Either way it asks only for what is missing: always the status (proposed,
accepted, rejected, deprecated), the options or drivers only when the input names none.
The decision-makers, consulted and informed fields stay `{TBD}` for you to fill in.

It takes the number one above the highest `NNNN-*.md` in `docs/adr/`. The file lands at
`docs/adr/NNNN-<slug>.md`. Pros, cons and consequences are marked with symbols, not prose
labels: `✅` for positive, `❌` for negative, `🟡` for neutral. Every option, the chosen one
included, gets its pros and cons.

::: info
A diagram is added only when the options differ in structure or data flow.
:::

`/bdk:design` records each decision it takes with you as a `decision` entry; `/bdk:adr`
turns the one worth keeping into a record.

## Document code - `/bdk:docs`

```
/bdk:docs <code path>
/bdk:docs <existing .md document>
```

The argument picks the mode. A code path creates a document; an existing Markdown file is
refreshed against the code it describes. Both write the same shape: an overview, a file
tree, Mermaid diagrams, critical rules with a violating and a correct example, examples in
prototype code, the main components, and the tests.

::: warning
Examples are **prototype code, never the actual implementation**: placeholder
function names, clear control flow, a comment per step, at most 20 lines, one concept
per example. A doc that pastes the real implementation goes stale the day the
implementation changes.
:::

**Create.** The skill reads the module's entry points, its key components with their
callers, and its tests, then writes every section of the shape. For a path of more than
about 30 source files it proposes documenting one sub-module at a time. The document lands
at the path you name, or at `docs/architecture/<module>.md`; never under `.bdk/`, which
holds BDK state. When the file already exists, the skill refreshes it instead.

**Refresh.** The skill splits the document into sections, reads the code each one
describes, and classifies every section and diagram as accurate, outdated or missing. You
approve the plan before anything is written, in a single question: what to keep, update,
add and remove, and which diagrams change.

Accurate sections are copied word for word, which is what preserves hand-written prose.
What no longer exists is simply omitted - no "removed" comments.

::: info
The result reads as one uniform document. No changelog markers, no "updated on"
annotations, no diff markers. A diagram that is still correct but predates the current
standard is left alone, so a refresh changes content, not style.
:::

## Draw the diagram - `/bdk-craft:mermaid-drawer`

```
/bdk-craft:mermaid-drawer <what to draw>
```

A standalone diagram standard, so diagrams read the same whoever drew them and wherever
they are viewed. It ships in the separate `bdk-craft` plugin (`/plugin install bdk-craft@bdk`).
Invoke it directly to draw one; `/bdk:docs` carries the same rules.

It fixes the parts that go wrong anyway:

- **Type by relationship, not by habit.** Components and boundaries are a `flowchart` with
  subgraphs; anything crossing services over time is a `sequenceDiagram`; an entity's
  lifecycle is a `stateDiagram-v2`; cardinality is an `erDiagram`. If the answer to "what
  does this show" contains the word _then_, it is a sequence diagram - a request path
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

| Skill                       | Artifact                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `/bdk:adr`                  | `docs/adr/NNNN-<slug>.md`                                                                    |
| `/bdk:docs`                 | `docs/architecture/<module>.md` or the path you named; a refreshed doc is rewritten in place |
| `/bdk-craft:mermaid-drawer` | one Mermaid block, in whatever document you are writing                                      |

None of these commit. Files are generated; when they land in git is your call.

## Next step

[Rules hygiene](rules-hygiene.md) - the other half of written knowledge, and the one that
rots fastest.
