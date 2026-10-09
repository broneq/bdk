## Why

Tracks #332.

On the docs site, the three sequence diagrams of `docs/concepts/orchestrators.md` that set `"wrap": true` in their `sequence` init line break names inside a word: the `/bdk:pr-review` participant shows `/bdk:pr-rev-` / `iew`, the message `Agent: /bdk:pr-review-round` shows `/bdk:pr-review-rou-` / `nd`, and the `par` label shows `execution.max-parall-` / `el`. With wrapping on, Mermaid fits each participant, message and note into a fixed width and cuts any word wider than that width into pieces, adding a hyphen of its own. Measured on the rendered site at 1280 px: no other sequence diagram breaks a word, and none of them wraps. #308 fixed the same defect for flowcharts and left sequence diagrams out.

## What Changes

- The docs site draws every sequence diagram with Mermaid's automatic wrapping off (`sequence.wrap: false`, set site-wide next to the flowchart setting of #308), so a participant name, message, note or block label breaks only where its author wrote `<br/>`.
- The `"wrap": true` of the three sequence init lines in `docs/concepts/orchestrators.md` goes; their layout settings stay.
- `pnpm check` fails when a sequence diagram in a site page turns wrapping on (in an init line, a `%%{wrap}%%` directive or a `wrap:` text prefix), naming the page and the block's line.
- The 40-character limit per label line of #308 covers sequence diagrams too: participant names, messages, notes, block labels (`loop`, `alt`, `par`, ...) and boxes. The 17 lines over the limit in `docs/concepts/` and `docs/design/` are broken with `<br/>` at word boundaries; no wording changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: "Mermaid diagrams render as diagrams" extends the line-break rule from flowchart labels to every text of a sequence diagram; "Flowchart label lines stay short" becomes "Diagram label lines stay short" and covers sequence diagrams and their wrap setting.

## Impact

- Code: `docs/.vitepress/theme/mermaid-diagram.ts` (Mermaid configuration), `docs/.vitepress/mermaid-parse.test.ts` (the checks).
- Docs content: line breaks inside sequence diagrams of `docs/concepts/orchestrators.md`, `docs/concepts/cli-config-hooks.md` and `docs/design/2026-10-07-v3-architecture.md`, and a few more line breaks in the three formerly wrapped diagrams of `orchestrators.md` so they fit the content column at desktop width again (the `integration-<br/>reviewer` participant becomes `integration<br/>reviewer`); the prose is unchanged.
- It changes nothing a BDK user sees in a skill, agent, hook, `bdk` command, settings key or the flow between them, so the Change has no Docs task group; the Reference is unaffected.
- Out of scope: centring a diagram narrower than its frame (#328), which changes the same component in parallel.
