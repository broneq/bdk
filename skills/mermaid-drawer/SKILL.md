---
name: mermaid-drawer
description: BDK's shared Mermaid standard - diagram type selection, node budget, and a palette verified legible in light and dark themes. Use whenever writing a mermaid block, or when asked to diagram, visualise, or map a flow, architecture, or state machine.
model: sonnet
user-invocable: true
argument-hint: "[what to draw]"
---

# Mermaid Drawer

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

Every BDK skill that emits a diagram emits it through this standard, so diagrams read the same whoever drew them and wherever they are viewed.

You already know Mermaid syntax. What this skill fixes is the part that goes wrong anyway: picking a type that cannot express the thing, packing in more nodes than a reader can hold, and colouring in a way that becomes unreadable the moment someone opens the doc in dark mode.

## Workflow

1. Name the **one** relationship the diagram must make obvious. If you cannot, do not draw.
2. Pick the type from the table below - the type is chosen by the relationship, not by habit.
3. Draw. Label every edge. Stay inside the node budget.
4. Run the self-check at the bottom before emitting the block.

## Draw only when a picture beats prose

A diagram earns its place when the content has a shape that sentences flatten:

- **Fan-out / fan-in** - one thing talks to six, or six converge on one
- **Cycles and retries** - prose has to say "back to step 2", a diagram just draws the arc
- **Ordering across parties** - who waits for whom, and what happens meanwhile
- **Boundaries** - what is inside the trust/process/service line and what crosses it

Three sequential steps with no branching is a sentence. A list of components with no edges between them is a bullet list, not a diagram - boxes alone carry no information.

## Pick the type

| What you need to show | Type | Why this one |
|---|---|---|
| Components, layers, ownership boundaries | `flowchart` + `subgraph` | Subgraph is the only clean way to draw a boundary |
| An HTTP request, RPC, or message crossing services | `sequenceDiagram` | The only type with a time axis - shows who blocks on whom and what returns |
| Lifecycle of one entity (order, job, connection, session) | `stateDiagram-v2` | States are nouns, transitions are events; terminal states are explicit |
| Table/collection shape and cardinality | `erDiagram` | The only type that expresses 1:N vs N:M natively |
| Inheritance, composition, interface conformance | `classDiagram` | Carries members and relationship kind together |
| Branching logic inside one function or algorithm | `flowchart TD` with `{}` decisions | Diamonds make branch coverage visible |

**The mistake that matters most:** drawing a flowchart for something that happens *over time*. A request path drawn as a flowchart silently loses the return leg, the waiting, and the ordering of concurrent calls - the three things a reader opened the diagram for. If the answer to "what does this show" contains the word *then*, or involves two parties exchanging messages, it is a `sequenceDiagram`.

Recipes for the three types models get wrong - `sequenceDiagram` with `alt`/`loop`, `stateDiagram-v2`, `erDiagram` - are in [references/diagram-recipes.md](references/diagram-recipes.md). Read it when drawing one of those; plain flowcharts need no recipe.

## Keep it readable

- **15 nodes hard ceiling, 8 is better.** Past that a reader stops tracing edges and starts skimming. Over budget means the diagram is answering two questions - split it at a boundary and draw two.
- **Label every edge that is not self-evident.** In a request flow, use the real thing: `POST /orders`, `401`, `order_id`. `-->` with no label between two nouns tells the reader nothing they could not guess.
- **One direction.** `TB` for layered architecture (traffic flows down), `LR` for pipelines and stages. Mixing them makes the eye backtrack.
- **Name nodes for what they are, not for their file.** `Auth middleware`, not `auth_mw.py`. The file name goes in the prose around the diagram, where it can be a clickable path.

## Colour

**Default to no colour.** Mermaid's built-in theme already adapts to the viewer's light or dark mode. An uncoloured diagram is correct everywhere and costs nothing to maintain. Reach for colour only when it **encodes** something a reader must see at a glance - the failure path, the third-party boundary, the thing that persists state. Colour applied for decoration adds a legend the reader has to learn for no return.

**When you do colour, set `fill`, `stroke` and `color` together, always.** This is not style advice - it is the single defect that keeps producing unreadable diagrams. `classDef x fill:#ADD8E6` sets the box background only; the label keeps whatever colour the *renderer's theme* chose. In a dark-mode renderer that label is near-white, sitting on a pale blue box, and the node becomes unreadable. Nothing errors, and it looks fine to whoever authored it in light mode.

### The palette

Six roles. Each was checked against WCAG AA (all exceed 4.5:1 for white text) and rendered in both Mermaid's `default` and `dark` themes.

```
classDef primary fill:#3b6ea5,stroke:#7fa8d0,color:#ffffff
classDef store   fill:#5f4b8b,stroke:#9b8bc4,color:#ffffff
classDef ok      fill:#2f7d52,stroke:#6cbb90,color:#ffffff
classDef warn    fill:#8a6116,stroke:#c9a24d,color:#ffffff
classDef error   fill:#b3352e,stroke:#e08a84,color:#ffffff
classDef ext     fill:#5a6472,stroke:#98a2b3,color:#ffffff
```

| Role | Use for |
|---|---|
| `primary` | The subject of the diagram - the code being explained or changed |
| `store` | Anything that persists: DB, cache, queue, bucket, file |
| `ok` | Success terminal state, happy-path outcome |
| `warn` | Degraded, optional, or fallback path |
| `error` | Failure state, error branch, rejected input |
| `ext` | Third party or anything outside your control |

Copy only the `classDef` lines you actually use. Declaring six and applying two leaves dead lines in the doc.

Strokes are lighter tints of their fill so the box edge stays visible against a dark page. Fills are mid-tone rather than pastel so white labels hold contrast on a white page too - that is what makes one palette work in both themes instead of needing two.

### Subgraphs

Leave subgraph borders unstyled and Mermaid fills them with a pale yellow wash in light mode and a heavy grey in dark. Both fight the nodes inside. Use a transparent fill with a dashed neutral border instead - it reads as a boundary in both themes and keeps the label colour under the theme's control:

```
style <SubgraphName> fill:transparent,stroke:#8b93a1,stroke-dasharray:4 3
```

### Where styling actually applies

Verified by rendering, because Mermaid fails silently here:

| Diagram type | How to style | Note |
|---|---|---|
| `flowchart` | `classDef` + `class A,B name` | Also `A:::name` inline |
| `stateDiagram-v2` | `classDef` + `class A,B name` | Works as in flowchart |
| `erDiagram` | `classDef` + `class ENTITY name` | Entity boxes only |
| `classDiagram` | `class Foo:::name` or `style Foo fill:...` | **`cssClass "Foo" name` is silently ignored** - it parses, renders, and changes nothing |
| `sequenceDiagram` | no per-node styling | Tint a region with `rect rgba(59,110,165,0.25) ... end` |

## Self-check before emitting

- [ ] The type matches the relationship - nothing sequential drawn as a flowchart
- [ ] 15 nodes or fewer
- [ ] Every non-obvious edge is labelled
- [ ] Either no colour at all, or every `classDef` carries `fill` **and** `stroke` **and** `color`
- [ ] Every `classDef` declared is applied to at least one node
- [ ] Colour encodes a role from the table, not decoration
- [ ] Subgraphs, if any, use the transparent style
- [ ] Node labels containing `(`, `[`, `:`, `,` or `-` are wrapped in double quotes - unquoted punctuation is the most common parse failure

If the environment has it, `npx -y @mermaid-js/mermaid-cli -i diagram.mmd -o /dev/null` catches syntax errors before they reach the doc. Optional - do not install it just for this, and never treat its absence as a blocker.

## Anti-patterns

- **Mystery boxes** - nouns connected by unlabelled arrows. Says a relationship exists, not what it is.
- **Colour without meaning** - six colours because six looked nicer than one. The reader hunts for a code that is not there.
- **`fill` without `color`** - the dark-mode invisibility bug above.
- **The file tree as a flowchart** - directory structure is a tree; write it as a tree in a code block.
- **One diagram doing three jobs** - architecture, request flow and state machine crammed together. Three diagrams, each answering one question.
- **Diagram duplicating adjacent prose** - if the paragraph above already lists the same steps in the same order, delete one of them.
