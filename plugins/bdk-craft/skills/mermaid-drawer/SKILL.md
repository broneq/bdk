---
name: mermaid-drawer
description: Mermaid diagram standard - type chosen by the relationship shown, at most 15 nodes per diagram (split larger systems), labelled edges, colours legible in light and dark themes. Load it before writing any mermaid block, and whenever asked to draw or diagram an architecture, a flow, trust boundaries, a lifecycle or a data model.
license: MIT
---

# Mermaid diagrams

Diagrams go wrong in three ways that Mermaid never reports: a type that cannot express the relationship, more nodes than a reader can follow, and colours that vanish in dark mode. Draw in these steps.

## 1. Name the one relationship

Write one sentence: what must the diagram make obvious? If the answer is two things (the architecture and a request flow), draw two diagrams.

**Done when:** each planned diagram has one sentence.

## 2. Pick the type by the relationship

| Show | Type |
| --- | --- |
| Components, layers, zones, ownership | `flowchart` with `subgraph` per zone or boundary |
| Messages between parties over time, with replies, retries and timeouts | `sequenceDiagram` with `alt`, `loop`, `opt` |
| Lifecycle of one entity | `stateDiagram-v2` |
| Tables and cardinality | `erDiagram` |
| Branching logic of one algorithm | `flowchart TD` with decision diamonds |

If the description says "then" or two parties exchange messages, it is a sequence. Recipes for sequence, state and ER diagrams: [references/diagram-recipes.md](references/diagram-recipes.md).

**Done when:** each diagram's type matches its sentence.

## 3. Stay inside the node budget

- At most 15 nodes per diagram; 8 reads better. Count every box.
- Over budget: split at a boundary (for example clients and edge; core services; data stores and third parties; or one diagram per domain) and draw each part as its own diagram. Group similar items into one node (`Postgres (users, catalog, orders)`) only when the edges stay true.
- One direction per diagram: `TB` for layers, `LR` for pipelines.

**Done when:** every diagram has 15 nodes or fewer.

## 4. Label the edges

Label every edge whose meaning is not obvious with the real thing: `-->|POST /orders|`, `-->|order.paid event|`, `-->|reads|`. An unlabelled arrow between two nouns says nothing.

**Done when:** every non-obvious edge has a label.

## 5. Colour only to encode, and always completely

Default to no colour; Mermaid's theme adapts to light and dark. Colour when it encodes something the reader must see, such as the failure path. Then set `fill`, `stroke` and `color` together on every `classDef`; a `fill` alone keeps the theme's label colour, which is near-white in dark mode and unreadable on a pale box.

```text
classDef primary fill:#3b6ea5,stroke:#7fa8d0,color:#ffffff
classDef store   fill:#5f4b8b,stroke:#9b8bc4,color:#ffffff
classDef ok      fill:#2f7d52,stroke:#6cbb90,color:#ffffff
classDef warn    fill:#8a6116,stroke:#c9a24d,color:#ffffff
classDef error   fill:#b3352e,stroke:#e08a84,color:#ffffff
classDef ext     fill:#5a6472,stroke:#98a2b3,color:#ffffff
```

Mid-tone fills with white labels pass WCAG AA on both themes. Declare only the classes you apply. In a `sequenceDiagram`, mark a failure region with `rect rgba(179,53,46,0.2) ... end`.

Style every subgraph with a transparent fill and a dashed neutral border, so zones read in both themes:

```text
style Internet fill:transparent,stroke:#8b93a1,stroke-dasharray:4 3
```

**Done when:** every `classDef` and `style` with a fill also sets `stroke` and `color`, or uses `fill:transparent`.

## 6. Check before emitting

- [ ] Type matches the relationship; nothing over time drawn as a flowchart
- [ ] 15 nodes or fewer in each diagram
- [ ] Non-obvious edges labelled
- [ ] No colour, or complete `fill` + `stroke` + `color`
- [ ] Every subgraph styled transparent with a dashed border
- [ ] Labels with `(`, `:`, `,` or `/` wrapped in double quotes
