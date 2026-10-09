# Design

## Context

`docs/.vitepress/theme/brand.css` styles tables as hairline rows under a strong top rule. The rule sits on `.vp-doc table` (`border-top: 2px solid var(--line-strong)`), while VitePress's default theme sets `.vp-doc table { display: block; overflow-x: auto }` so a wide table scrolls. A block box fills the content column; the anonymous table box inside it, and so its rows, shrinks to the content. The rule therefore follows the column, the row rules follow the content.

## Decisions

### D1. The top rule goes on the first row's cells

`.vp-doc table > :first-child > tr:first-child > :is(th, td)` gets `border-top: 2px solid var(--line-strong)`, and the table box loses its border. The cells already carry the row rules (`border-bottom` on `th, td`), so the top rule now has the same width as them by construction, in any table width and either theme (`--line-strong` is a theme token). `:first-child` on the row group picks the `thead` of a Markdown table and the first `tbody` of an HTML table without a `thead`, and never the first row of a later `tbody`.

Alternatives considered:

- `width: fit-content; max-width: 100%` on the table box: shrinks the block to the rows and keeps the scroll, but couples the fix to how VitePress sizes the box (`display: block`) and to the browser's sizing of an anonymous table inside a block; a later VitePress change of that rule would bring the bug back. Lost.
- `display: table` on the table box: narrow tables fit, but a wide table no longer scrolls and overflows the column on a phone. Lost.
- `thead tr:first-child`: misses an HTML table without a `thead`. Lost.

### D2. No automated test of the rendering

The bug is a layout result; the repository has no browser test runner, and a test that reads the selector out of `brand.css` would only mirror the code. The fix is verified in the rendered local site instead: the wave table of `docs/concepts/stages.md` and the wide table of `docs/reference/bdk/rules.md`, in the light and the dark theme and at phone width, measuring the rule width against the row width. Adding a browser test runner for one style rule is not worth its upkeep; if theme bugs of this kind repeat, a visual test suite becomes its own task.

## Risks

- A table whose first row group is a `caption` would miss the rule; no page of the site has a caption, and Markdown tables never do.
