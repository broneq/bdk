## Why

Tracks #308.

Mermaid 12 wraps a flowchart label line at `flowchart.wrappingWidth`, 120 px by default, and the browser breaks the line at the last break opportunity that fits, which includes the point after a hyphen. On the docs site this splits names inside a word in most flowcharts of `docs/concepts/` (`/bdk:implement-` / `part`, `plan.part.max-` / `tasks`, `--` / `version`). A wider width only moves the problem: measured on the rendered site, a 240 px width still splits `npx -y lavish-axi --version` after `--` and `writes R/close/spec-conformance.md` after `spec-`, because any line longer than the width can break at a hyphen.

## What Changes

- The docs site draws every flowchart with Mermaid's automatic label wrapping turned off (one site-wide `flowchart.wrappingWidth` far wider than any label), so a label line breaks only where its author wrote `<br/>`.
- The per-diagram `%%{init: {"flowchart": {"wrappingWidth": 200}}}%%` lines of `docs/concepts/orchestrators.md` (#307) go.
- `pnpm check` fails when a flowchart label line in a site page is longer than 40 characters, naming the page, the block's line and the label line, so diagrams stay narrow once nothing wraps for the author.
- `pnpm check` fails when a `mermaid` block in a site page sets its own `wrappingWidth`, so all flowcharts keep the one site-wide value.
- The label lines longer than 40 characters in `docs/concepts/` and `docs/design/` are broken with `<br/>` at word boundaries, and the widest line of `docs/concepts/findings.md` too, so that diagram stays as wide as before; no wording changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: "Mermaid diagrams render as diagrams" gains the rule that flowchart labels break only where the author breaks them; a new requirement makes `pnpm check` hold label lines to 40 characters and reject a per-diagram `wrappingWidth`.

## Impact

- Code: `docs/.vitepress/theme/mermaid-diagram.ts` (Mermaid configuration), `docs/.vitepress/mermaid-parse.test.ts` (the new checks).
- Docs content: line breaks inside Mermaid labels of `docs/concepts/orchestrators.md`, `docs/concepts/cli-config-hooks.md`, `docs/concepts/findings.md` and `docs/design/2026-10-07-v3-architecture.md`; the prose is unchanged.
- It changes nothing a BDK user sees in a skill, agent, hook, `bdk` command, settings key or the flow between them, so the Change has no Docs task group; the Reference is unaffected.
- Out of scope: sequence diagram layout (their per-diagram `sequence` init lines stay), and #304 (brand.css), which runs in parallel.
