# Design system tokens

The site follows the Broniszewski design system, https://github.com/broneq/design-system. This directory holds an unchanged copy of its tokens:

| File | Source |
|---|---|
| `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `components.css` | `tokens/` at commit `2406b3091ad9a40df7a814e638e2b6bb519b6c69` (2026-09-30) |
| `docs/public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png` | `assets/favicon/` at the same commit |

Left out on purpose: `tokens/fonts.css` (the site self-hosts Archivo, Geist and JetBrains Mono from `@fontsource-variable` packages instead of Google Fonts, as the design system's README asks for production) and `tokens/base.css` (global resets and a `.container` class that would restyle VitePress; `../brand.css` carries the few utilities the site uses).

To update: copy the same files from a newer commit of the design system, change the commit above, and check every page in both themes. `design-system.test.ts` fails when `brand.css` no longer repeats the dark theme of `colors.css` for VitePress's `.dark` class.
