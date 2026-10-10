# Explain as a page - an interactive HTML page for a question about your code

`bdk-explain` answers a question about your code, a flow or a concept with one interactive HTML page that opens in your browser: a diagram you can step through or play with, in place of a wall of terminal text. It is its own plugin and works without `bdk` and without `/bdk:setup`.

## Install

```text
/plugin marketplace add broneq/bdk
/plugin install bdk-explain@bdk
```

## Ask

Type the command with your question:

```text
/bdk-explain:explain how does checkout get from the cart to a stored order?
```

Claude also picks the skill by itself when you ask for a visual answer: "explain the retry delays visually", "walk me through the login flow as a page I can step through". A plain question without such a wish gets a plain answer in the terminal.

Claude reads the code that answers the question, then writes one page:

- the question, a one-sentence answer and the key picture in the first screen;
- the picture as inline SVG, with controls where they help: previous and next (or the arrow keys) through the steps of a flow, sliders or number fields for a value that changes the result, a click on a part for its details;
- the file each step or part comes from;
- light and dark themes, following your system;
- everything inside the one file: no CDN, no web font, so it works offline.

The reply in the terminal is two or three lines and the path of the page.

## Where the page goes

```text
<worktree>/.bdk/tmp/explain/<short-name>.html
```

`<short-name>` is the name you give ("call it `checkout`"), else a short name from the topic. Asking about the same topic again replaces that page.

The first page also creates `.bdk/tmp/.gitignore` containing `*`. That file makes git ignore the whole `.bdk/tmp/` directory, itself included, so `git status` shows nothing new and your own `.gitignore` is never edited.

`.bdk/tmp/` is the scratch directory of BDK plugins: a BDK plugin that writes throwaway files puts them under `.bdk/tmp/<tool>/`. Nothing there is ever committed, and you can delete the directory at any time. Pages are never deleted for you; remove `.bdk/tmp/explain/` when you no longer need them.

## When no browser opens

The page opens with `open` on macOS and `xdg-open` on Linux with a display. In an SSH session, on Linux without a display, on another platform, or when the command fails, nothing opens and the reply gives the path to open yourself.

## Sources

- `plugins/bdk-explain/skills/explain/SKILL.md`
- `plugins/bdk-explain/evals/RESULTS.md` (the eval evidence the skill shipped with)
