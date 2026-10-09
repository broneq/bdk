# Gates and budgets - where BDK stops for you, and what makes a run end

Two kinds of settings decide how autonomous a run is. **Gates and questions** are the points where a stage waits for your decision; each can be switched to decide by itself. **Budgets** cap the retries of each loop, so a run always ends: with a result, or with a clear stop that names what is left.

## Gates and questions

| Setting | Asked by | `manual` / `stop` (default) | `auto` / `decide-and-record` |
|---|---|---|---|
| `policy.gates.design` | `/bdk:design` (design gate), `/bdk:debug` (fix gate) | you approve a verified design before planning, and a diagnosis before a bug fix is built | approved without asking; the gate file records it |
| `policy.gates.review` | `/bdk:triage` in `/bdk:auto-review` | you decide fix, accept or defer for every finding | the [triage policy](./findings.md#decisions) decides by level |
| `policy.questions` | `/bdk:propose`, `/bdk:design-draft`, `/bdk:execute`, `/bdk:pr-review` | a stage asks when the intent or a design decision is open, before retrying blocked parts, and before posting a PR review | the recommended answer is taken and recorded in the Change; blocked parts are not retried; the run stops there |

With everything on `auto` and `decide-and-record`, `/bdk:run` goes from an intent to pull requests without asking. Every decision it took is recorded (`## Decided without the user` in the proposal, `Decided without the user:` in the design, `By: policy.gates.design auto` in the gate file), and its final report lists them.

## Budgets

| Budget | Default | Loop it caps | When it is spent |
|---|---|---|---|
| `policy.budgets.verifier` | 3 | draft and verify of a design, and of a plan | the stage stops before the gate and names the open points of the last report |
| `policy.budgets.part-attempts` | 3 | implementer runs of one plan part in one execute run | the part is blocked; the last run uses `policy.escalation.model` (`opus`) and `policy.escalation.effort` |
| `policy.budgets.review-rounds` | 3 | review rounds of one auto-review | triage runs with `--last-round`: `should-fix` is deferred, a `blocker` still asks for a fix, and a fix left over ends the review as blocked |

A part that the plan made too large never gets an attempt: `bdk plan check` holds every part to `plan.part.max-tasks` (5), `plan.part.max-files` (10) and `plan.part.max-bytes` (8192), and `/bdk:verify-plan` sends an oversized plan back.

## What a stop looks like

A stage that stops writes why in its result file and names the command that continues: `/bdk:execute <change>` after you fixed the cause of a blocked part, `/bdk:design <change>` after a spent verifier budget, and so on. `/bdk:run` stops the whole queue at that Change and continues from it when you run `/bdk:run` again. Nothing is lost: every stage resumes from its files ([run state](./run-state.md)).

## Sources

- `plugins/bdk/skills/design/`, `plan/`, `execute/`, `execute-waves/`, `auto-review/`, `triage/`, `debug/`, `pr-review/`, `run/`
- `plugins/bdk/src/config/domain/settings.ts` (defaults)
