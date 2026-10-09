# bdk-skill-kit evals

Eval cases of the `bdk-skill-kit` plugin for [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals), one directory per case named `<skill>-<case>`. Every run is a real model call on your account; nothing here runs in CI.

## Run

From the repository root, after `pnpm install` and `pnpm --filter bdk-skill-kit build` (the skill runs `dist/skill-check.mjs`):

```bash
PATH="$(echo "$PATH" | tr ':' '\n' | grep -v node_modules/.bin | paste -sd: -)" \
  ./node_modules/.bin/claude plugin eval plugins/bdk-skill-kit --scaffold --allow-tools Bash Edit \
  --ablation none --model claude-opus-5-5 --judge-model claude-sonnet-5-5 --no-publish
```

The cases need `Bash` itself: the model often chains the checker with `echo "exit=$?"`, which a `Bash(node *)` grant does not cover. The OS sandbox still confines every command to the run's workspace. Run with `--ablation none`: without the plugin there is no `skill-check` to run, so a baseline arm measures nothing.

## Cases

- `skill-check-internal-error`: the project's own plugin rule throws, so `skill-check` exits 3. Graded: the reply says the rule failed and the skill was not checked, and the skill is left untouched.

## Results

| Date | Claude Code | Model | Case | Skill text | Score (3 runs) |
| --- | --- | --- | --- | --- | --- |
| 2026-10-09 | 2.1.292 | `claude-opus-5-5` | `skill-check-internal-error` | before exit 3 was named | 1.00 |
| 2026-10-09 | 2.1.292 | `claude-opus-5-5` | `skill-check-internal-error` | with exit 3 named | 1.00 |

The one-line `skill-check: internal error: rule <id> failed on <file>: ...` message alone leads the model to the broken rule, so the skill names exit 3 in one sentence only, to keep its list of exit codes complete (design D5 of `v3-314-skill-check-internal-error`).
