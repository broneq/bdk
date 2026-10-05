# V3 eval: craft skill admission

Every `bdk-craft` skill was measured with and without it before it was admitted (R-6, decision D7 of `v3-t42-craft`). This page is the record of that measurement. `kernel/tests/contract/craft-skills.test.ts` reads its verdict column: a skill ships in `plugins/bdk-craft/skills/` exactly when its row says `admitted`.

## Setup

- Harness: `pnpm eval with-without --skill bdk-craft:<name> --tasks evals/suites/with-without/examples/craft/<name>.yaml --probe --run-cap 3 --budget 500` (`evals/README.md`).
- Both cells load a copy of `plugins/bdk-craft` alone, with no `bdk` plugin. The `without` copy lacks the skill's directory. Each passing `with` cell also shows that the skill works without `bdk`.
- Fixture: `kamkie/technical-interview-frontend` at `946a2081`. Orchestrator: Opus 5.5.
- Tasks: three tasks per skill, each written as a user would ask, without naming the skill. Each assertion checks the reply for a behaviour the skill changes, for example an observed failure for each behaviour, `problem+json`, a Test Data Builder, or an expand-and-contract step. The assertions do not check the skill's own wording.
- Plugin commit: `9fddf58`. Result rows: `evals/results/with-without/probe-<name>-2026-10-05.jsonl`.

## Rule

D7: a skill is admitted when the assertions it passes, summed over its tasks, exceed the sum for the `without` cell. A probe has one run per cell, so this rule answers only whether the skill changes the agent's output in the measured direction. It does not give a size of the effect with noise bounds. The full five-run series (T03 D-7 difference rule) stays available for any skill whose verdict is later disputed.

## Results

| Skill              | Task file                     | Passed `with` | Passed `without` | Cost (USD) | Verdict  |
| ------------------ | ----------------------------- | ------------- | ---------------- | ---------- | -------- |
| `tdd`              | `craft/tdd.yaml`              | 5/9           | 3/9              | 2.23       | admitted |
| `debugging`        | `craft/debugging.yaml`        | 9/12          | 4/12             | 1.40       | admitted |
| `mermaid-drawer`   | `craft/mermaid-drawer.yaml`   | 7/9           | 5/9              | 0.55       | admitted |
| `oop-design`       | `craft/oop-design.yaml`       | 11/11         | 10/11            | 1.12       | admitted |
| `api-design`       | `craft/api-design.yaml`       | 13/13         | 6/13             | 1.48       | admitted |
| `refactoring`      | `craft/refactoring.yaml`      | 5/9           | 2/9              | 1.79       | admitted |
| `data-modeling`    | `craft/data-modeling.yaml`    | 11/13         | 12/13            | 1.54       | rejected |
| `testing-strategy` | `craft/testing-strategy.yaml` | 11/11         | 3/11             | 1.61       | admitted |
| `modularizing`     | `craft/modularizing.yaml`     | 9/9           | 6/9              | 0.68       | admitted |

Total spend: 12.39 USD.

## Per task

| Task                              | `with` | `without` |
| --------------------------------- | ------ | --------- |
| `tdd/slugify`                     | 2/3    | 0/3       |
| `tdd/business-days`               | 2/3    | 2/3       |
| `tdd/password-rules`              | 1/3    | 1/3       |
| `debugging/date-filter`           | 1/4    | 1/4       |
| `debugging/vat-rounding`          | 4/4    | 2/4       |
| `debugging/page-slice`            | 4/4    | 1/4       |
| `mermaid-drawer/platform-map`     | 3/3    | 0/3       |
| `mermaid-drawer/failure-path`     | 1/3    | 3/3       |
| `mermaid-drawer/trust-boundaries` | 3/3    | 2/3       |
| `oop-design/discounts`            | 4/4    | 4/4       |
| `oop-design/notifications`        | 4/4    | 4/4       |
| `oop-design/document-workflow`    | 3/3    | 2/3       |
| `api-design/orders`               | 5/5    | 2/5       |
| `api-design/transfers`            | 4/4    | 3/4       |
| `api-design/comments`             | 4/4    | 1/4       |
| `refactoring/shipping-cost`       | 2/3    | 1/3       |
| `refactoring/user-label`          | 2/3    | 0/3       |
| `refactoring/csv-export`          | 1/3    | 1/3       |
| `data-modeling/shop-orders`       | 5/5    | 5/5       |
| `data-modeling/rename-column`     | 3/4    | 3/4       |
| `data-modeling/subscriptions`     | 3/4    | 4/4       |
| `testing-strategy/checkout`       | 4/4    | 1/4       |
| `testing-strategy/login-mfa`      | 3/3    | 1/3       |
| `testing-strategy/catalog-search` | 4/4    | 1/4       |
| `modularizing/layered-app`        | 3/3    | 2/3       |
| `modularizing/cycle`              | 3/3    | 2/3       |
| `modularizing/big-module`         | 3/3    | 2/3       |

## Reading

- The largest gaps are in `testing-strategy`, `api-design` and `debugging`. Without the skill, the agent rarely uses Test Data Builders, Page Objects or contract tests. It also seldom uses `problem+json`, cursor pagination or `If-Match` with `412`. When debugging, it fixes before reproducing and does not search for the same pattern elsewhere.
- `mermaid-drawer` splits an oversized system into diagrams within the node budget, and the `without` cell does not. On `failure-path` the `with` cell scored lower. It drew a `sequenceDiagram`, which the skill's type table picks for a flow across services over time, and marked the failure branches with `rect` blocks. The task's assertions expect a flowchart with `classDef` lines and `-->|label|` edges, so they did not match that answer. This is a gap in the task file, not a worse diagram. The sum still passes D7.
- `oop-design` passes D7 by one assertion: the state classes of `document-workflow`. Without the skill, the agent already uses value objects, strategy interfaces and constructor injection. It is the weakest admission and the first candidate for a full series.
- `data-modeling` is rejected. Without the skill, the agent already puts constraints in the schema, avoids float money, uses `timestamptz`, and splits a live rename into expand-and-contract phases. The skill was deleted from `plugins/bdk-craft/skills/`. Its task file stays, so a rewritten skill can be measured again.

## `bdk-craft` alone

Acceptance signal of T42: "`bdk-craft` installs alone on a project without `bdk` and `tdd` runs there". The `with` cell of the `tdd` probe is the evidence (`evals/results/with-without/probe-tdd-2026-10-05.jsonl`, rows with `"cell":"with"`). Its sessions loaded one plugin, the copy of `plugins/bdk-craft`. The harness isolation check counts the loaded plugins and discards a run that loaded any other, and none was discarded. The `with` replies of `tdd/slugify` and `tdd/business-days` passed two of their three assertions each. `claude plugin validate plugins/bdk-craft` passes.
