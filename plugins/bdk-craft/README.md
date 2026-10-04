# bdk-craft

Portable engineering craft skills. Each one encodes a process or a set of concrete choices that changes what an agent does, and each one was measured with and without it before it was admitted (`docs/V3-EVAL-CRAFT.md` in the repository).

The skills use only the Agent Skills standard fields: no hooks, no scripts, no kernel. They work on their own, without `bdk`. When `bdk` is installed too, its implementer agents are told to read `tdd`, and `debugging` on a bug Change.

## Install

```bash
claude plugin marketplace add broneq/bdk
claude plugin install bdk-craft@bdk
```

## Skills

| Skill              | What it fixes                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `tdd`              | A red-green-refactor loop with a test list, an observed failure before every change, and a log of each gate        |
| `debugging`        | Reproduce as a failing test, rank hypotheses by evidence, bisect, fix the cause, keep the regression test          |
| `mermaid-drawer`   | Diagram type chosen by the relationship, a node budget, labelled edges, a palette legible in light and dark themes |
| `oop-design`       | Value objects, composition over inheritance, constructor injection, tell-don't-ask, strategy and state objects     |
| `api-design`       | Resource naming, the status code per outcome, problem+json errors, cursor pagination, idempotency keys             |
| `refactoring`      | Characterisation tests first, one named refactoring per step, tests green after each step                          |
| `data-modeling`    | Constraints in the database, justified denormalisation, expand-and-contract migrations                             |
| `testing-strategy` | One job per test level, mocks at owned boundaries, Test Data Builders, Page Objects, contract tests                |
| `modularizing`     | Modules by feature, one public entry each, one dependency direction, the signals to split                          |

Invoke a skill as `/bdk-craft:<name>`, or let the agent pick it from the task.
