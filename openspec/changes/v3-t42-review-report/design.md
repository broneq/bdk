## Context

See proposal.md for the motivation. The state this Change builds on, from `v3-t42-review-kernel` and `v3-t42-review-skills`:

- `cr` ends a successful round with `bdk done review`. `gate:review` is then ready, and the user passes it by typing `/bdk:close`, or a run passes it by policy (T41).
- `review` is stale only when the committed code tree changes (`ReviewKind.inputs`). A ledger write after `done review` leaves it done.
- The levels come from `bdk log triage` (T42-T). `log triage` and `log resolve` are the in-place mutations an entry allows (`kernel-state`, Derived state and mutation). Main-thread writes are `source: kernel`. Only the hooks stamp `source: user`, and only on `transition` entries.
- `bdk review plan` already computes the modules and the `unplanned` files of a range (`kernel/src/review/domain/groups.ts`). `kernel/src/shared/store/glob.ts` matches globs with the dialect of the settings.
- `review.risks` (T42-K) holds model instructions without paths, and `dispatch` alone consumes it.
- The ladder (`kernel/src/attempt/domain/ladder.ts`) ends a round only with an answered ladder question. `ok` and `fail` records both count against the budget.
- `pr-review` is stateless (user decision 2026-10-03, refining D1). It confirms each verdict with `AskUserQuestion`.
- Lavish (`fragments/decision/lavish.md`) is opened with `lavish-axi <file>` and answered with `lavish-axi poll <file>`. A tracked batch sends one prompt whose data is an `items` array (`lavish-axi playbook input`).

## Goals / Non-Goals

**Goals:**

- One deterministic renderer in the kernel, so the report reads the same for every model and every run, and tests can pin it byte for byte.
- The human's decision per entry is ledger state that the kernel enforces at `change close`, not a convention of the skill.
- A `fix` the human asks for reuses the existing `review-fix` round. There is no second fix path.

**Non-Goals:**

- No page writes the ledger directly. Answers always return through the agent, which calls `bdk log decide`.
- No JavaScript framework, CDN or Mermaid in the page. The diagram is HTML and CSS that the kernel generates.
- No model decides the structure of the change map. Cards, files, tasks, commits and tags come from globs, the plan, git and the ledger. The only model text on a card is the integration reviewer's one-sentence area summary (R10).
- No new graph node or gate. The report sits between `done review` and `gate:review`.

## Decisions

### R1. The kernel renders the report from a template compiled into the bundle

`bdk review render` builds a view model from the index, the evidence, the plan parts and `git diff --numstat`. It then renders that view model with two template functions in `kernel/src/review/render/` (`report-html.ts`, `report-md.ts`). Both share one escaping helper and one section order.

- **HTML.** The page is self-contained: inline CSS with light and dark tokens, plus one inline script that runs only when `window.lavish` exists.
- **Diagram.** The "parts and areas" diagram is a CSS grid: parts as rows, modules as columns. Each cell's shade scales with its changed lines.
- **Output path.** The output goes to `.bdk/.machine/review/`, which is ignored and is not committed state. The ledger is the record, and the page is a view of it.

Alternatives considered:

- **The skill writes the HTML, as other Lavish pages do.** Rejected. Decision H says "fixed template", and a model-written page drifts between runs. `cr` also has no `Write` tool (`review-skills`, Review skill shape).
- **A template file shipped next to the bundle and read at runtime.** Rejected. It is one more generated or copied file for the T48 packaging, and a separate file buys nothing over a TypeScript module.
- **Mermaid from a CDN.** Rejected. The page must render offline, and the kernel cannot test a client-side diagram byte for byte.

### R2. The human's decision is a field on the entry, written by `bdk log decide`

`disposition` (`fix | defer | reject | track`) and `issue` are mutated in place, with a body line, exactly like `level` from `log triage`.

- `fix` sets `level: blocker`. The existing rule "a live entry triaged `blocker` is blocking" then drives the next `cr` round without any new concept.
- `defer` and `track` set `accepted`, so the entry stays live and reaches the PR summary.
- `reject` resolves the entry.

Alternatives considered:

- **A separate `decision` entry whose refs name the finding.** Rejected. The disposition would have to be parsed from free text, or the `decision` type would need a disposition field that means nothing for other decisions. Every reader (render, close, summary) would also have to join two entries.
- **Reusing `log triage` levels.** Rejected. A level is the orchestrator's judgement (T42-T), and the disposition is the human's. Mixing them loses which one decided.
- **`source: user` on the decision.** Rejected. Only the hooks can prove a human typed something (P1). The body line and the `cr` transcript are the provenance, as for design decisions.

### R3. `change close` enforces a disposition on every live finding, observation and blocker

The check runs right after `policy/ticket-open`. It also refuses `disposition: fix` on a live entry: the review stays done until a commit changes the code tree, so without this check a `/bdk:close` typed right after choosing `fix` would close with the fix not made.

Live entries from execute count too, but the human never decides them untriaged (user decision 2026-10-04, option A): `cr` triages every live entry of the Change that has no level, whichever stage wrote it, in the round and again in `--report`. Noise leaves as `not-a-problem` with a reason, visible under Settled, and the human decides only `should-fix` and `nice-to-have` entries. The `review` verdict's `triaged` check stays scoped to the round's ticket: widening it would refuse a verdict for an entry the round never saw, while the close check already catches anything left undecided.

Alternatives considered:

- **A gate requirement on `gate:review`.** Rejected. A gate checks provenance and timing only (`kernel-pipeline`, Gate).
- **A `review` verdict check.** Rejected. The report comes after the verdict.
- **No enforcement, with "undecided" listed in the summary.** Rejected. Decision H's "a decision per finding" would then be optional, and `--auto` would close with entries nobody decided, not even by policy.
- **Every live entry, triaged or not, goes to the human.** Rejected by the user (2026-10-04). Execute observations are many and small, and the human would judge entries the orchestrator never looked at.
- **Only the round's entries need a decision.** Rejected. An execute entry would reach the PR as open although nobody judged it.

### R4. The change map comes from `review.risks[].paths`, not from a new key

Each enabled risk with `paths` becomes a card of the changed files it matches. A file is tagged with the live entries whose refs name the risk id (the integration reviewer's convention, `role-contracts`) or the file. The plan's five areas (permissions, data model, API, configuration, out-of-plan) map to the risks `auth`, `migration`, `public-api` and `configuration` (new) and to the `unplanned` files from `review plan`. `dependencies` keeps dependencies and the build, and `secrets` keeps its own card. The defaults are deliberately broad: a false match costs one line on a card, and a miss hides a risky file.

Alternatives considered:

- **A separate `review.areas` key.** Rejected. It would duplicate the risk ids and drift from them, and the user asked for "a change map with risk tags", which is the same list.
- **The integration reviewer writes the map.** Rejected by the user (2026-10-04): it costs tokens and varies between runs. R10 keeps only one sentence per area from the model.

### R5. `cr` owns the report step, and `--report` reaches it alone

The report follows `bdk done review` in `cr`'s Finish. A `fix` answer loops back into a round (fix first, then the delta review). `cr` ends only when nothing decided `fix` is open. `/bdk:cr --report` renders and asks without a round. `/bdk:close`'s refusal names it, and a run's stop names it.

Inside `/bdk:run`, `cr` asks nothing and records `defer --review` for each undecided entry (user decision 2026-10-04). Without `--auto` the run then stops at `gate:review` as before. With `--auto` it closes, and the PR summary carries the deferred entries. `cr` cannot see the run's arguments, so the rule lives in both skills: `cr` says what to record inside a run, and `run`'s "Deciding instead of asking" names the exception.

Alternatives considered:

- **The report in `close`.** Rejected. `close` asks nothing, and the typed `/bdk:close` is already the consent that passes the gate (T41). Asking there would split consent from the decision.
- **A new skill `/bdk:report`.** Rejected. It is one more command to learn, and it would duplicate `cr`'s round loop for `fix`.

### R6. An `ok` record ends its round (kernel-loops)

`attempt open` stamps `after: <ok ticket>` on every record opened after the round's `ok`, until the next `ok`. `currentRound` keeps the records whose `after` equals the latest boundary and that no answered ladder question names. Stamping the boundary on every record of the round, not only the first, keeps rounds apart without comparing times, which `kernel-loops` already rejects for ladder rounds.

A success is not a reset of a failing streak, so the principle "a budget of failures never resets without a decision" still holds. Without this, a report `fix` after a review that used one fail and one ok would start on an exhausted budget of 2 and park at once.

Alternatives considered:

- **Count only `fail` records.** Rejected. It changes `attempt` numbering for every loop, and it still charges the user's fix with failures on unrelated blockers.
- **Have `log decide fix` write a ladder-style answer.** Rejected. It abuses the park question protocol.
- **Compare `closed-at` and `opened-at`.** Rejected. Two records of one millisecond, as in the E2E fake clock, would land in the wrong round.

### R7. The `pr-review` decision page goes through the same renderer

`bdk review render --pr - --out <file>` reads the parsed `pr-review-result` blocks. It needs no Change and writes only `--out`, which `pr-review` points at a `mktemp` file, so the skill stays stateless. The four choices are those of decision J and the plan item (blocker, nice to have, tracker), plus `drop`. The role sometimes reports a false positive, and today the only way to suppress it is overriding the verdict. `--quick`, or any Lavish failure, falls back to the current `AskUserQuestion` confirmation, so the fragment's fallback rule holds.

Alternatives considered:

- **A separate `bdk pr render` command.** Rejected. The template, the escaping and the Lavish form are the same, and a second command would duplicate them.
- **No `drop`.** Rejected. The old rule "a non-blocking finding is never dropped" was about the model dropping findings. The human dropping one is a decision, and the page shows it.

### R8. The tracker is a setting, and the skills file issues

`tracker` is `{kind: github}` or `{kind: instruction, instruction}`. The kernel never calls a tracker: it validates the setting, offers `track` only while it is set, and stores the returned `issue`. `cr` and `pr-review` file the issue: `gh issue create` for GitHub, or the instruction for anything else, with whatever CLI or MCP server the user has. `/bdk:setup` proposes `github` when `gh auth status` succeeds and `origin` is on github.com.

Alternatives considered:

- **The kernel files the GitHub issue.** Rejected. It adds a network dependency and `gh` auth handling to a deterministic kernel, for one of two kinds.
- **A Jira or Monday kind each.** Rejected. Decision J chose `instruction` for every tracker but GitHub.

### R9. A finding says why it is worth fixing

The user asked for each entry in the report to say why fixing it is worth it (2026-10-04). The `reviewer` and `integration-reviewer` contracts write the body of every finding, observation and blocker as three labelled paragraphs: `Problem:`, `Why it matters:` and `Suggested fix:`. The `pr-reviewer` result block gains the field `why` next to `problem` and `fix`. The renderer shows a labelled body as three fields and any other body as written, so entries of other roles and of older Changes still render.

The labels live in the contracts, not in the kernel. The `verifier` contract has 16 bytes left of its 4 096-byte budget, and a `log add` that refuses unlabelled bodies would break every other writer. A contract test pins the labels in the three role bodies.

Alternatives considered:

- **New entry fields `why` and `fix`.** Rejected. It is a schema change for every writer, and the body already carries the text.
- **The renderer asks nothing and shows the body.** Rejected by the user: "why fix it" was missing in the simulation.

### R10. The integration reviewer writes one sentence per touched area

A list of files says what changed, not what it means. The user asked for "what really changed there and why" on each card (2026-10-04). The `integration-reviewer` already reads the whole range against the risks, so its report ends with a section `## Areas`: one line `- <risk-id>: <sentence>` per touched risk, at most 300 characters. The renderer takes the line for each risk from the latest such report, and also opens a card for a risk the summary names without a glob match. That covers semantic areas the globs miss.

Per file, the kernel adds the why and the what without a model: the plan tasks whose `Files:` declare the file, and the commits of the range that changed it (`git log --format='%h %s' <range> -- <file>`).

Alternatives considered:

- **A new entry type for area summaries.** Rejected. The text belongs to the round's report, and a new type adds a schema change and a lifecycle nobody needs.
- **No model text on the map.** Rejected by the user: the files and commits alone did not explain the change.

## Risks / Trade-offs

- **Every close now needs dispositions.** Close fixtures and the `stages` eval case `run-auto` change. → The E2E fixtures get `bdk log decide` calls. `run` records the defers itself. Re-probing `run-auto` waits for the user's approval of the cost.
- **Broad default globs over-tag files.** → The card lists files with their line counts, so noise is visible and cheap. Projects override `paths` by `id`.
- **The Lavish reply may omit ids.** → `cr` compares the submitted ids with the Decisions section and asks the missing ones in the terminal. `close` refuses anything still undecided.
- **A large Change gives a long page.** → Settled entries are collapsed, and Decisions holds only live entries. The diagram aggregates by module, not by file.
- **The HTML template is about 400 lines of TypeScript strings.** → A snapshot test of a fixed fixture pins the output, and every change to the page shows as a diff.
- **The area summary is model text.** It may differ between runs, and a later delta round may not repeat it. → The latest line per risk wins, and a card without a line still shows its files, tasks and commits.
- **Role bodies grow.** `integration-reviewer` is at 3 668 of 4 096 bytes. → The two new lines are short, and the size test fails before a body overflows.
- **`after` adds a field to attempt records.** Old records have none, so they read as the first round, which is what they were. No migration is needed.

## Migration Plan

- No document schema version bump: `disposition`, `issue` and `after` are optional fields added at version 1, as T42 added `level`, `group` and `head` (commit 791d198). Old documents validate unchanged.
- The index schema goes to version 8 (`kernel-state`, Rebuildable index), so every index rebuilds once from the committed files.
- The generated state and output schemas are rebuilt by `pnpm build` (T48).
- An active Change from before this Change closes only after its live entries are decided. `/bdk:cr --report` does that.

## Open Questions

None. The `--auto` behaviour, the source of the change map, the meaning of `fix`, the triage of execute entries (R3), the round boundary (R6), the area summaries (R10) and the finding body (R9) were decided by the user on 2026-10-04, after a simulated report (`.lavish/t42-review-report-sim.html`). The rest is decided above.
