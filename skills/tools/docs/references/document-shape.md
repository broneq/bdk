# Document shape

Every document `/bdk:docs` writes or refreshes has these sections, in this order. A refresh keeps the section titles a document already uses when they cover the same ground.

````markdown
# <Module name> - Architecture

## Overview

Two or three sentences: what the module does, why it exists, what it depends on.

## Core architecture

### File tree

```
module/
├── core/
│   ├── parser       # parses the input format
│   └── processor    # the transformation
└── service          # coordinates the pipeline
```

### Components

```mermaid
flowchart TB
    ...
```

## Flow

The main path first, then the error and fallback paths, as a diagram and a numbered list of steps.

## Critical rules

For each non-obvious rule: the rule, why it holds, a violating example and the correct one.

## Examples

For each common case and each surprising edge case: the input, prototype processing code, the output, and the points to notice.

## Main components

For each key class, function or service: its purpose, its responsibilities, its public surface, a prototype of its use, and notes on thread safety, state or cost.

## Tests

Where the tests of the module live, what each level covers, the patterns they use and where their data comes from.

## References

Related documents, specs and decisions.
````

## Section rules

- **Overview**: the "what" and the "why", not the "how".
- **File tree**: two or three levels; one comment per entry; names as in the code.
- **Flow**: the happy path first; error paths after it.
- **Critical rules**: only what a capable reader would get wrong; always with the reason.
- **Examples**: realistic, minimal data; one concern per example. Add a step table (step, action, intermediate result) when the module transforms data in several steps.
- **Main components**: one subsection per component; public surface only.
- **Tests**: describe what exists; do not propose tests.

## Prototype code

Examples show the shape of the logic, never the implementation.

- Placeholder names (`parse`, `transform`, `format_output`), clear control flow, a comment per step.
- At most 20 lines per example, one concept per example.
- No copied implementation, no full parameter lists, no logging, no exhaustive error handling.

```
# parse and validate
parsed = parse(raw_input)
if not parsed.valid:
    return error_response()

# transform by type
result = special_transform(parsed) if parsed.special else standard_transform(parsed)
return format_output(result)
```

## Diagrams

Embed each diagram as a fenced `mermaid` block in the document; no separate file, no compile step.

- Draw only when the content has a shape prose flattens: fan-out or fan-in, cycles and retries, ordering across parties, boundaries.
- Pick the type by the relationship: `flowchart` with `subgraph` for components and boundaries; `sequenceDiagram` for anything that happens over time across parties; `stateDiagram-v2` for the lifecycle of one entity; `erDiagram` for data shape and cardinality; `classDiagram` for inheritance and composition. Never draw a request path as a flowchart.
- At most 15 nodes, better 8; split a larger diagram at a boundary.
- Label every edge that is not self-evident, with the real thing (`POST /orders`, `401`).
- One direction: `TB` for layers, `LR` for pipelines.
- Name nodes for what they are, not for their file.
- No colour by default. When colour encodes a role, every `classDef` sets `fill`, `stroke` and `color` together, for example `classDef store fill:#5f4b8b,stroke:#9b8bc4,color:#ffffff`.
- Quote node labels that contain `(`, `[`, `:`, `,` or `-`.

## Done when

- [ ] Overview of two or three sentences
- [ ] File tree
- [ ] At least one Mermaid diagram that follows the diagram rules
- [ ] Critical rules with examples
- [ ] Examples with prototype code only
- [ ] Main components
- [ ] Tests
- [ ] Uniform text: no changelog, no "updated on" note, no diff marker
