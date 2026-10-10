---
name: explain
description: Explains how code, a flow or a concept works as one self-contained, interactive HTML page - inline SVG diagrams, step-through or controls, light and dark themes - written to .bdk/tmp/explain/ (ignored by git) and opened in the browser. Load it when the user asks to explain or walk through something visually, as a page, a diagram, an interactive or visual explainer, or something to step through or play with, and on /bdk-explain:explain followed by a question.
license: MIT
---

# Explain as a page

Answer the question with one HTML page the user opens in a browser, not with terminal text. The page is the answer; the reply only points to it. Do not write the page before step 1 is done.

## 1. Read what answers the question

Find and read the code, docs or config that answer the question. Note each file the explanation relies on (path, and the function or lines). Never invent behaviour the code does not have: when something is unclear, say so on the page.

**Done when:** you can state the answer in one sentence and name the files behind each part of it.

## 2. Choose the picture and the interaction

Pick the one picture that answers the question, and the interaction that helps a reader understand it:

| The subject is | Picture | Interaction |
| --- | --- | --- |
| A sequence of steps or calls (a request, a pipeline, a checkout) | Boxes and arrows, or a sequence diagram | Step-through: previous / next / play, the current step highlighted with its details beside the picture |
| States and transitions | State diagram | Click or step a transition, the current state highlighted |
| A value that depends on inputs (a limit, a backoff, a price) | A chart or a gauge drawn in SVG | Range or number inputs for the inputs, the picture and numbers updating live |
| Structure (modules, layers, data model) | Grouped boxes | Hover or click a part to show what it does and where it lives |
| A concept with no code | The diagram that shows its mechanism | Whichever of the above fits |

Add an interaction only where it helps understanding; a static picture is fine for a simple structure.

**Done when:** the page has one key picture and, for a sequence, a state change or a value, the controls that go with it.

## 3. Write the page

Get the worktree root with `git rev-parse --show-toplevel` (outside a git repository, use the current directory). Then:

1. If `<root>/.bdk/tmp/.gitignore` does not exist, write it with the single line `*`. That file makes git ignore the whole scratch directory, itself included. Never edit the project's own `.gitignore`.
2. Pick `<short-name>`: the name the user gave, else two to four lowercase kebab-case words from the topic (`checkout-flow`, `token-bucket`). Asking about the same topic again reuses the name and replaces the old page.
3. Write `<root>/.bdk/tmp/explain/<short-name>.html` with the `Write` tool. Write no other file.

The page rules:

- **One file, nothing external.** CSS in a `<style>` element, JavaScript in an inline `<script>`, diagrams as inline `<svg>`. No `<script src>`, no stylesheet `<link>`, no `@import`, no web font, no remote image, no CDN library. It must work offline. Use a system font stack.
- **First screen.** A title (the question), the one-sentence answer, then the key picture. Details come below it.
- **Light and dark.** Define colors as CSS custom properties on `:root` and redefine them in `@media (prefers-color-scheme: dark)`. Draw SVG strokes, fills and text with those properties (`var(--fg)`, `currentColor`), never with fixed black or white, so the diagram stays legible in both themes.
- **A clean diagram.** Place the boxes on a grid with room between them, then route each line around the boxes: no line crosses a box, a label or another label, and every edge label sits clear of its line. Elements not in the current step stay legible (dim them to no less than about 60% opacity).
- **Any window width.** A viewport meta tag, a centred column with a `max-width`, an SVG with a `viewBox` and `width: 100%`, code blocks that scroll inside themselves (`overflow-x: auto`), and controls that wrap: no horizontal page scroll down to a 360 px wide window.
- **Controls.** Use `<button>` and `<input>` elements, wired with `addEventListener`. A step-through also answers the arrow keys (`keydown`). Respect `prefers-reduced-motion`: animate nothing that the reader did not start.
- **Grounded.** Each step or part names its source as a path the reader can open (`src/pricing.js`, `priceCart()`). Show short real code excerpts where they help, escaped as HTML.
- **Plain and small.** Short sentences, no filler; aim for a page the reader takes in within a few minutes, well under 200 KB.

**Done when:** the page exists at that path, `.bdk/tmp/.gitignore` exists, and the page follows every rule above.

## 4. Open it and reply

Open the page in the default browser, unless the session cannot show one:

- macOS: `open <path>`.
- Linux with `DISPLAY` or `WAYLAND_DISPLAY` set: `xdg-open <path>`.
- An SSH session (`SSH_CONNECTION` set), Linux without a display, or any other platform: open nothing.

If opening fails, do not retry and do not try another viewer.

The reply is at most three short lines, because everything else is on the page: the answer in one sentence, what the page lets the reader do, and the path. When the page was not opened, the last line says so and gives the path to open. No headings, no lists, no code blocks, no findings or caveats (put those on the page), and never the HTML, CSS or JavaScript. For example:

```text
Checkout prices the cart, charges the card, then stores the order; nothing is stored when the charge fails.
The page steps through the four modules (buttons or arrow keys), each with its source file.
Opened .bdk/tmp/explain/checkout.html in your browser.
```

**Done when:** the page was opened (or the reply says why not) and the reply is three short lines or fewer with the path.

## Anti-patterns

- Answering in the terminal and adding a page as an afterthought.
- A Mermaid, D3 or Chart.js page loaded from a CDN: it breaks offline and fails the "nothing external" rule.
- Writing the page into the project tree (`docs/`, the root) or adding `.bdk/` to the project's `.gitignore`.
- A page of prose with a decorative picture: the picture is the explanation.
- Colors that vanish in a dark theme (black strokes, white fills on `#fff`).
