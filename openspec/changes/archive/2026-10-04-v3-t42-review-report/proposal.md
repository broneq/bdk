## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T42, Delivery item 3. Tracks #62.

After `v3-t42-review-skills` the pipeline runs from `/bdk:change` to `/bdk:close`, but the human at `gate:review` sees only the short text report of `cr`: a list of entry ids per level. The reviewer cannot see what the Change touched (parts, areas, permissions, data model, API, configuration, files outside the plan), and the `should-fix` and `nice-to-have` entries reach the PR summary without anyone deciding what happens to them. Decision H of `.lavish/t42-review-process.html` asks for a report that the kernel renders from a fixed template, opening with a graphical summary, then the findings with one decision per finding recorded in the ledger. Decision J adds the tracker those decisions can send a finding to. `pr-review` gets the same per-finding step before it posts.

## What Changes

- New `bdk review render [--format html|md]`: the kernel renders the human report of the active Change from the ledger, the evidence, the plan parts and the diff of the whole Change. The HTML template is fixed and self-contained, served through Lavish, and its form sends one disposition per finding back to the agent. `--format md` renders the same content as the Markdown fallback.
- `bdk review render --pr <file|-> --out <path>`: the same template renders the pull request decision page of `pr-review` from the parsed `pr-review-result` blocks, with no Change and no ledger.
- New `bdk log decide <id> fix|defer|reject|track [--reason <text>] [--issue <ref>] [--review]`: it records the human's disposition of a `finding`, `observation` or `blocker` in place, as `log triage` records the level. `fix` triages the entry `blocker`, so the next `cr` round fixes it. `defer` accepts it. `reject` resolves it. `track` accepts it with the tracker issue it was filed as.
- `bdk change close` refuses with `policy/undecided-entries` while a live `finding`, `observation` or `blocker` has no disposition, or has the disposition `fix` and is not fixed. The PR summary shows each open entry with its disposition and tracker issue.
- The change map: `review.risks` items get an optional `paths` list of globs. The report shows, for each risk, the changed files that match and the findings that name the risk or those files, plus the files no plan task declared. Each file shows the plan tasks that declare it and the commits that changed it. Each card opens with one sentence on what changed in that area, which the `integration-reviewer` writes in a `## Areas` section of its report. A sixth default risk `configuration` covers runtime configuration. `dependencies` keeps dependencies and the build.
- New settings key `tracker`: `{kind: github}`, filed through `gh issue create`, or `{kind: instruction, instruction: <text>}` for any other tracker, filed by the model with the user's CLI or MCP. `/bdk:setup` detects GitHub and asks for an instruction otherwise.
- The `reviewer` and `integration-reviewer` write each finding's body as `Problem:`, `Why it matters:` and `Suggested fix:`, and the `pr-reviewer` result block gains `why`. The report shows the three fields, so the human sees why an entry is worth fixing.
- `cr` triages every live entry of the Change that has no level, the entries written during execute included, so the human decides only entries the orchestrator has judged.
- `/bdk:cr` ends with the report: it renders it, serves it through Lavish or the Markdown fallback with `AskUserQuestion`, files tracker issues, records every disposition, and starts a new round when any disposition is `fix`. `/bdk:cr --report` goes straight to the report, so the user can revisit decisions.
- `/bdk:run` (with or without `--auto`) does not stop at the report (user decision 2026-10-04). It renders the report and records `defer` with `review: true` for every undecided entry. A run with `--auto` closes the Change, and its PR summary lists those entries as deferred.
- `/bdk:pr-review` gets a Lavish step, skipped with `--quick` or when Lavish is unavailable. On that page the user decides per finding: post as blocker, post as nice to have, send to the tracker, or drop. The verdict follows from the blockers the user kept.
- **BREAKING** (kernel-loops): an `ok` record ends its round, so a later ticket of the same loop and target starts with the full budget. Without this change, a `fix` chosen in the report would run on the budget that the earlier review rounds had used up.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-cli`: the rule catalogue names `log decide` and adds `policy/undecided-entries`.
- `kernel-cli/review`: adds `bdk review render`.
- `kernel-cli/log`: adds `bdk log decide`.
- `kernel-cli/change`: `bdk change close` refuses undecided entries, and its summary carries dispositions.
- `kernel-state`: the ledger entry fields `disposition` and `issue`, and their in-place mutation.
- `kernel-loops`: an `ok` record ends a round.
- `kernel-settings`: `review.risks[].paths`, the `configuration` default risk and the `tracker` key.
- `review-skills`: the `cr` report step and `--report`, the triage of execute entries, the shape changes they need, and the `pr-review` decision step with `--quick`.
- `role-contracts`: the three-part finding body and the integration reviewer's `## Areas` section.
- `stage-skills`: `run` records `defer` for the report, and `setup` detects the tracker.

## Impact

- **Kernel:**
  - `kernel/src/review/` gains the `render` use case, its HTML and Markdown templates and the change-map domain.
  - `kernel/src/log/` gains `decide`.
  - `kernel/src/change/` adds the close check and the summary lines.
  - `kernel/src/attempt/domain/ladder.ts` changes how a round is cut.
  - `kernel/src/dispatch/config.ts` adds the risk `paths` and the `configuration` default.
  - A new config module adds `tracker`.
  - The generated output schemas `review-render.json` and `log-decide.json`.
- **Skills:**
  - `skills/tools/cr/SKILL.md` and `skills/tools/pr-review/SKILL.md`, with its `references/comment-templates.md` for the tracked section;
  - `skills/stages/run/SKILL.md` and `skills/stages/setup/SKILL.md`;
  - the role contracts `reviewer`, `integration-reviewer` and `pr-reviewer`.
- **Tests:**
  - E2E for render, decide and close;
  - snapshot tests of both templates;
  - contract tests on the skills;
  - the ladder unit tests;
  - the close fixtures that leave live findings now need dispositions.
- **Evals:** the `stages` suite case `run-auto` now passes through the report. Re-probing it costs money and waits for the user's approval.
- **Out of scope:**
  - The tools skills (`v3-t42-tools`) and `bdk-craft` (`v3-t42-craft`).
  - Answering the report from outside the session, for example from a page that writes the ledger directly. The decisions always come back through the agent.
