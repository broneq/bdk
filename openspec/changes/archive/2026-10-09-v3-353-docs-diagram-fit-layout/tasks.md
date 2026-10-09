# Tasks

## 1. Unmeasurable and error diagrams fail

- [x] 1.1 Add failing tests to `docs/.vitepress/diagram-fit.test.ts`: a diagram with a natural width of 0 (and NaN) fails with `<page>:<line>: not laid out, so its fit cannot be measured`; a diagram with an error fails with `<page>:<line>: does not draw: <error>`; neither gets fit or label findings
- [x] 1.2 In `diagram-fit.ts`, add `error` to `DrawnDiagram` and report both in `diagramProblems`

## 2. Measure after the layout

- [x] 2.1 Wait until each frame is drawn (not `.mermaid-source` with a child `svg` of non-zero `viewBox` width) or shows `.mermaid-error`, with a 30 s timeout after which the page is measured as it is
- [x] 2.2 `measureDiagrams` reads only the frame's child `svg`, returns one entry per frame, with `naturalWidth` 0 for an undrawn frame and the error text for an error frame

## 3. Acceptance and gates

- [x] 3.1 Build the site and run `docs:diagram-fit`: it exits 0, and a log of every diagram's scale shows a finite value for each
- [x] 3.2 Redraw the last diagram of `docs/concepts/workflow.md` wider than 717 px (745 px measured), rebuild: `docs:diagram-fit` fails and names that page and line; revert
- [x] 3.3 `pnpm docs:reference`, `pnpm check`, the docs job steps of `.github/workflows/pr.yml`, `openspec validate v3-353-docs-diagram-fit-layout --strict`, `openspec validate --specs --strict`
