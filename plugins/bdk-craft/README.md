# bdk-craft

Engineering craft skills for Claude Code. Each skill encodes a process or a set of concrete choices that changes what the agent does, and each one shipped only after a with/without eval showed that effect over no plugin ([`evals/RESULTS.md`](evals/RESULTS.md)).

The skills use only the standard Agent Skills fields: no hooks, no scripts, no CLI. They work on their own, without `bdk`.

## Install

```bash
claude plugin marketplace add broneq/bdk
claude plugin install bdk-craft@bdk
```

## Skills

| Skill | What it changes | Δ over no plugin |
| --- | --- | --- |
| `tdd` | Red-green-refactor one behaviour at a time, with a failing test run before each piece of code | +0.25 |
| `debugging` | A failing reproduction test before the fix, the root cause named, the same defect searched elsewhere | +0.11 |
| `refactoring` | Characterisation tests before the first edit, small steps with the tests run after each, odd behaviour reported instead of fixed | +0.56 |
| `testing-strategy` | One job per test level, doubles only at owned boundaries, Test Data Builders, Page Objects, contract tests | +0.44 |
| `mermaid-drawer` | Diagram type by relationship, at most 15 nodes, labelled edges, colours legible in light and dark themes | +0.41 |

The agent picks a skill from the task. You can also invoke one as `/bdk-craft:<name>`.

## Evals

The cases live in `evals/<skill>-<case>/` and run locally; every run is a paid model call. From the repository root:

```bash
claude plugin eval plugins/bdk-craft --scaffold --allow-tools Write Edit Bash \
  --model claude-opus-5-5 --judge-model claude-sonnet-5-5 --no-publish
```

`evals/RESULTS.md` holds the measured numbers and the admission rule.
