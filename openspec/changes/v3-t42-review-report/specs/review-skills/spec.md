## MODIFIED Requirements

### Requirement: Review skill shape

`/bdk:cr` and `/bdk:pr-review` SHALL live at `skills/tools/cr/SKILL.md` and `skills/tools/pr-review/SKILL.md`, a directory the `skills` array of `.claude-plugin/plugin.json` lists. Each SHALL:

- start its body with the two context lines of `kernel-cli`, Output modes, naming its own skill;
- stay at or below 200 lines in `SKILL.md`;
- name BDK skills, roles and agents with the `/bdk:` and `bdk:` namespace;
- name no model;
- set `disallowed-tools: Edit Write NotebookEdit`.

`cr` SHALL write state only through kernel commands and SHALL write no file of its own: there is no `.bdk/cr/` report. The human report is the file `bdk review render` writes. Its `allowed-tools` SHALL be:

- the kernel pair of `kernel-cli`, Invocation;
- `Agent`, `SendMessage`, `Skill`, `Read`, and `Bash(git diff *)` and `Bash(git log *)` for reading the range;
- `AskUserQuestion`, `Bash(lavish-axi *)` and `Bash(gh issue create *)` for the report.

`pr-review` SHALL also allow `Bash(lavish-axi *)`. `cr` SHALL NOT set `disable-model-invocation`, so `/bdk:run` can start it through the `Skill` tool. Neither skill SHALL reference `scripts/bdk_run_state.py` or a v2 agent.

#### Scenario: cr writes no file

- **WHEN** the content test reads `skills/tools/cr/SKILL.md`
- **THEN** its frontmatter has `disallowed-tools: Edit Write NotebookEdit`, its `allowed-tools` holds no `Write(` grant, and its body names neither `.bdk/cr/` nor `bdk_run_state.py`

#### Scenario: no v2 agent named

- **WHEN** the content test reads every file under `skills/tools/cr/` and `skills/tools/pr-review/`
- **THEN** none names `bdk:code-reviewer`, `bdk:architecture-reviewer`, `bdk:duplicate-detector`, `bdk:dead-code-detector`, `bdk:static-analyse`, `bdk:test-runner` or `general-purpose`

#### Scenario: report tools granted

- **WHEN** the content test reads the frontmatter of both skills
- **THEN** `cr` allows `AskUserQuestion`, `Bash(lavish-axi *)` and `Bash(gh issue create *)`, and `pr-review` allows `Bash(lavish-axi *)`

### Requirement: cr reports from the kernel

`cr` SHALL run `bdk change checkpoint` before it reports, so no run leaves an uncommitted ledger. It SHALL end with a short report built from kernel output only:

- the Change and its kind, the rounds run and each one's outcome;
- the anchor kind and range;
- per level, the count and the ids of the entries;
- the blockers fixed and their commits;
- the verdicts of `tests-full` and `lint-full` and the diff coverage per test entry;
- the agents that failed;
- the path of the rendered report, and each entry's disposition (Requirement: cr ends with the human report);
- the next command from `bdk change status`: `/bdk:close` when `gate:review` is ready, or the resume command of a parked Change.

A partial round SHALL NOT be reported as complete.

#### Scenario: report after a passing round

- **WHEN** a round closes `ok` with one `should-fix` and one `nice-to-have` entry, and the user defers both in the report
- **THEN** the final reply names both entry ids under their levels with `defer`, the gate verdicts, the report path and `/bdk:close`

### Requirement: pr-review confirms before posting

`pr-review` SHALL parse each role result block and remove every worktree before any GitHub call. A PR whose role returned no result block SHALL be reported as failed and not posted.

**The decision step (Lavish).** Unless `--quick` is given, `pr-review` SHALL write the parsed results as JSON to stdin of `bdk review render --pr - --out <file>`, with a file under a temporary directory. It SHALL open that page with `lavish-axi` and wait for the reply. Per finding, the user decides `blocker`, `nice-to-have`, `tracker` or `drop`. The final verdict of a PR is `request-changes` when the user kept any blocker, and `approve` otherwise. A `tracker` finding is filed as the `tracker` setting says, and its issue is listed in the summary. A `drop` finding is not posted. Every finding id the page sent SHALL get one of these outcomes before posting.

**The confirmation step (terminal).** With `--quick`, or when `features.lavish` is off, `lavish-axi` fails or the reply does not parse, `pr-review` SHALL instead:

- show, per PR, the computed verdict, the full blocker list and the full nice-to-have list;
- ask the user to confirm or override each verdict with `AskUserQuestion`.

**Posting.** Only then SHALL `pr-review` post one review per PR, rendered only from `references/comment-templates.md`. On the user's own PR the event SHALL be `COMMENT`. `--verify` SHALL classify the previous review's threads and resolve only the threads it posted and found fixed.

#### Scenario: nothing posted before confirmation

- **WHEN** `/bdk:pr-review <url> --quick` runs, the role returns a `request-changes` result and the user overrides it to approve
- **THEN** exactly one review is posted for that PR, with event `APPROVE`, and its summary carries the override note

#### Scenario: failed reviewer

- **WHEN** the forked role returns no result block for one of two PRs
- **THEN** that PR is reported as failed, nothing is posted for it, and the other PR is decided and posted

#### Scenario: user demotes the only blocker

- **WHEN** the Lavish reply marks the only blocking finding of a PR `nice-to-have`
- **THEN** the review is posted with event `APPROVE`, no inline comment, and that finding in the summary's nice-to-have section

#### Scenario: finding sent to the tracker

- **WHEN** `tracker` is `{kind: github}` and the reply marks a finding `tracker`
- **THEN** one `gh issue create` call files it, the finding is not posted as a comment, and the summary lists the issue URL

#### Scenario: Lavish unavailable

- **WHEN** `lavish-axi` exits non-zero
- **THEN** `pr-review` falls back to the confirmation step with `AskUserQuestion`, and posts nothing before the answer

### Requirement: cr triages every entry of the round

When every agent of the round has returned, `cr` SHALL triage the round in the main thread.

- Every live `finding`, `blocker` and `observation` written under the round's ticket gets one level through `bdk log triage <id> <level>`.
- So does every other live `finding`, `blocker` and `observation` of the Change that has no level yet, whichever stage wrote it, such as the entries the verifier or an implementer wrote during execute. The human then decides only entries the orchestrator has judged, and an entry that is noise leaves the report as `not-a-problem` with its reason. The level is judged against the intent, the accepted decisions, the configured `review.risks` and the category the reviewer gave.
- A `blocker` is an entry that must be fixed before the gate and names a P8 category.
- An entry that repeats another of the round is triaged `not-a-problem`, with `--reason` naming the entry it repeats.
- `cr` SHALL NOT change an entry's text, type or refs.

Then `cr` SHALL store the merged review with `bdk log ingest --ticket <ticket>@merge`, before it closes the ticket: the kernel refuses an `ok` or `fail` close of a `review-fix` ticket without it (`kernel-cli/attempt`, bdk attempt close). The report's `entries` name every entry written under the round's ticket; entries of earlier rounds it fixed are named in its body. Its body lists, per level, each entry's id and summary, then the gate's verdicts and diff coverage. `cr` SHALL then run `bdk log add report "<counts per level>" --ticket <ticket>@merge`.

#### Scenario: every entry triaged

- **WHEN** a round's reviewers wrote three findings and one observation, one finding repeating another
- **THEN** each of the four entries holds a `level`, the repeated one `not-a-problem` with a reason naming the other, and the round's `merge` report names all four

#### Scenario: execute entries are triaged in the round

- **WHEN** the verifier of part 02 wrote a live observation during execute, and the first review round closes
- **THEN** the observation holds a `level`, as the round's own entries do, and the report lists it under that level, not as untriaged

## ADDED Requirements

### Requirement: cr ends with the human report

After `bdk done review` passes, `cr` SHALL run `bdk review render` and present the report. With `--report`, `cr` SHALL first triage every live entry of the Change that has no level, as a round does (Requirement: cr triages every entry of the round).

- **Lavish path.** With `features.lavish` on and `lavish-axi` available, `cr` SHALL open the HTML file with `lavish-axi` and wait for the reply. The reply's `items` give one disposition per entry, and every submitted id SHALL be accounted for.
- **Fallback path.** Otherwise `cr` SHALL render `--format md`, print its summary, change map and gate, and ask the dispositions with `AskUserQuestion`. Each question covers one entry, at most four per call. The current disposition, or `defer` when there is none, is the first option, marked `(Recommended)`.

For each answer `cr` SHALL record the disposition with `bdk log decide`:

- `defer` and `reject` (with the user's reason) directly;
- `track` only after it has filed the issue:
  - for `{kind: github}` with `gh issue create`, the title from the entry's summary and the body from its refs and body plus the Change id;
  - for `{kind: instruction}` by following the instruction;
  - the filed issue's URL or key becomes `--issue`;
- `fix` directly, and then `cr` SHALL start a new round. That round fixes the entry first, as for any blocking entry, reviews the delta, and ends with the report again.

`cr` SHALL end only when no entry is decided `fix` and not fixed. `/bdk:cr --report` SHALL skip the rounds and go straight to the report, so the user can change the dispositions. Inside `/bdk:run`, `cr` SHALL ask nothing: it renders the report and records `bdk log decide <id> defer --review` for every entry without a disposition (`stage-skills`, run decides instead of asking).

#### Scenario: fix starts a round

- **WHEN** the user marks a `should-fix` finding `fix` in the report
- **THEN** the ledger shows it decided `fix`, a new `review-fix` ticket's implementer package embeds it, the round closes `ok` with the finding resolved, and the report is rendered again without it in Decisions

#### Scenario: track files the issue first

- **WHEN** `tracker` is `{kind: github}` and the user marks a finding `track`
- **THEN** `gh issue create` runs once for it, and `bdk log decide <id> track --issue <url>` records the URL it printed

#### Scenario: Markdown fallback

- **WHEN** `features.lavish` is `false` and the review leaves two undecided entries
- **THEN** no `lavish-axi` call is made, the report is rendered with `--format md`, and one `AskUserQuestion` call holds one question for each entry, `defer` first

#### Scenario: report only

- **WHEN** the user types `/bdk:cr --report` on a Change whose `review` node is done and that holds one live untriaged observation
- **THEN** no ticket is opened and no agent starts, the observation is triaged, the report is rendered, and the user's answers are recorded with `bdk log decide`

#### Scenario: inside a run

- **WHEN** `/bdk:run --auto` reaches the report with one undecided `nice-to-have` entry
- **THEN** no `AskUserQuestion` or `lavish-axi` call is made, the entry holds `disposition: defer` and `review: true`, and the run goes on to `/bdk:close`
