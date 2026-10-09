# Tasks

## 1. Reproduce

- [x] 1.1 On the local site, measure the wave table of `docs/concepts/stages.md`: the top rule is wider than its rows

## 2. Theme

- [x] 2.1 `docs/.vitepress/theme/brand.css` ("Tables"): move the top rule from `.vp-doc table` to the cells of the first row (design D1)
- [x] 2.2 On the local site, check the wave table and the wide table of `docs/reference/bdk/rules.md` in the light and the dark theme and at phone width: the rule is as wide as the rows, and a wide table still scrolls with its rule

## 3. Gates

- [x] 3.1 `pnpm docs:reference` (no change expected), `pnpm check`, every check of `.github/workflows/`, `openspec validate --specs --strict`
