## Why

Tracks #338.

On the docs site 30 of the 51 diagrams are wider than the desktop content column (574 px inside a diagram frame at 1280 px). `docs/.vitepress/theme/mermaid-diagram.ts` shrinks a wide diagram to the column down to 0.6 of its natural width, so their 14 px labels render at 8.4 to 11 px, and 13 of them still scroll sideways inside their frame (up to 749 px). Most are wide because of their layout, not their content: left-to-right chains up to 2205 px long, a decision staircase that grows one column per question, six edges fanning into one side of one node, and sequence diagrams whose lifelines sit 200 px apart (Mermaid's defaults: 150 px boxes, 50 px gaps, 50 px side margins). "Who starts whom" in `docs/concepts/agents.md` braids the edges of two leads so it cannot be read which lead starts which worker. Nothing keeps a new diagram from being drawn as wide again.

## What Changes

- The site draws sequence diagrams with a tighter layout, set once in `mermaid-diagram.ts` next to the wrapping setting: 96 px minimum boxes, 10 px minimum gaps, 8 px note margins and 8 px side margins. The four per-diagram `%%{init}%%` layout lines of `docs/concepts/` go.
- Every diagram wider than the column at a scale of 0.8 is redrawn, in `docs/concepts/` (`workflow.md`, `orchestrators.md`, `run-state.md`, `agents.md`, `rules.md`, `findings.md`; the sequence diagrams of `e2e.md` and `cli-config-hooks.md` fit with the tighter layout alone) and `docs/design/` (the architecture and the repo structure designs): left-to-right chains and fans go top-down, the run-status decision becomes a straight vertical spine with the exits to one side, the writers of the findings log become one node with one edge, "Who starts whom" shows one row per lead with its own workers, sequence participants are reordered so long messages pass a lifeline instead of widening a gap, and long lines break at `<br/>`. The `docs/design/` records keep their content; only the layout changes.
- A new check, `pnpm --filter @bdk/docs docs:diagram-fit`, opens every page with a diagram of the built site in Chromium at 1280 px and fails when a diagram renders below 0.8 of its natural width or its frame scrolls sideways, naming the page, the block's line and the width that fits. The `docs` job of PR CI runs it after the build.
- `pnpm check` fails when a `mermaid` block of a site page sets its own Mermaid configuration (an `init` or `initialize` directive or a `config:` frontmatter), so wrapping and layout stay site-wide. This replaces the narrower `wrappingWidth` rule of #308.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: a new requirement "Diagrams fit the content column"; "Diagram label lines stay short" rejects any per-diagram configuration instead of only `wrappingWidth`.

## Impact

- Code: `docs/.vitepress/theme/mermaid-diagram.ts` (sequence layout), `docs/.vitepress/diagram-fit.ts` and its test (new), `docs/.vitepress/mermaid-parse.test.ts`, `docs/package.json` (`playwright` 1.63.0, `docs:diagram-fit`), `pnpm-lock.yaml`, `.github/workflows/pr.yml` (the `docs` job installs Chromium and runs the check).
- Docs content: diagram layout on the Concepts pages `workflow.md`, `orchestrators.md`, `run-state.md`, `agents.md`, `rules.md`, `findings.md` and the two designs; the prose is unchanged.
- It changes nothing a BDK user sees in a skill, agent, hook, `bdk` command, settings key or the flow between them, so the Change has no Docs task group; the Reference is unaffected. The `mermaid-drawer` craft skill (`plugins/bdk-craft`) is unchanged: its "`LR` for pipelines" serves diagrams in user projects, not this site's column (design D5).
- Out of scope: sequence lifelines and frame lines drawn through message labels (#339), diagram content after #317 and #322 (#340), centring a narrow diagram (#328).
