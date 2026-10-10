# bdk-explain

Explains a question about your code, a flow or a concept as one self-contained, interactive HTML page and opens it in your browser: a diagram you can step through or play with, in light and dark themes, with nothing loaded from the network.

The page goes to `.bdk/tmp/explain/<short-name>.html` in the current worktree. The skill creates `.bdk/tmp/.gitignore` containing `*` when it is missing, so `git status` stays clean and your `.gitignore` is never edited. The reply in the terminal is two or three lines and the path.

The plugin is one skill with only the standard Agent Skills fields: no hooks, no scripts, no CLI. It works on its own, without `bdk`. It shipped only after a with/without eval showed its effect over no plugin ([`evals/RESULTS.md`](evals/RESULTS.md)).

## Install

```bash
claude plugin marketplace add broneq/bdk
claude plugin install bdk-explain@bdk
```

## Use

```text
/bdk-explain:explain how does checkout get from the cart to a stored order?
```

Claude also picks the skill by itself when you ask for a visual answer ("explain the retry delays visually", "a page I can step through"). In an SSH session or without a display, nothing opens and the reply gives the path.

## Evals

The cases live in `evals/explain-<case>/` and run locally; every run is a paid model call. From the repository root:

```bash
claude plugin eval plugins/bdk-explain --trust-plugin --scaffold --allow-tools Write Edit Bash \
  --runs 3 --model claude-opus-5-5 --judge-model claude-sonnet-5-5 --no-publish
```

On a Mac, the run needs the clean `HOME` and the `git` shell prefix of "Host limits" in `plugins/bdk/evals/README.md`. `evals/RESULTS.md` holds the measured numbers and the admission rule.
