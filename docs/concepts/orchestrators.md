# Orchestrators - what each BDK command runs, in which order

Each orchestrator composes blocks and agents; the diagrams show the order, the parallel work, the loops, the budgets, the retries and the model escalation.

Notation in the diagrams: see the [glossary](./glossary.md#notation-in-the-diagrams).

Every orchestrator runs in the main thread, starts with a `!` block that runs `bdk config show`, and stops with "BDK not configured: run /bdk:setup" when there is no configuration. Each one writes only its own gate or result file; the blocks write everything else.

## `/bdk:setup`

```mermaid
flowchart TB
  S1["read the state: bdk config show"] --> S2["detect the stack and the E2E entry<br/>from manifests and scripts"]
  S2 --> S3(["ask only open questions<br/>AskUserQuestion, at most 4"])
  S3 --> S4["write .bdk/settings.yaml"]
  S4 --> S5["bdk config check until exit 0"]
  S5 --> S6["permission allow rules<br/>.claude/settings.json"]
  S6 --> S7["openspec init, bdk openspec install,<br/>the project schema, or schema: bdk"]
  S7 --> S8["gitignore .bdk/runs/<br/>and settings.local.yaml"]
  S8 --> S9["bdk config show, npx -y lavish-axi --version,<br/>report with the decision surface"]
```

A re-run keeps every value a layer sets and fills only what is missing; an argument such as "add the e2e entry" limits the run to that change.

## `/bdk:propose`

```mermaid
flowchart TB
  P1{{"configured?"}} --> P2["input: gh issue view, or the intent text"]
  P2 --> P3["openspec list --specs<br/>read the touched main specs"]
  P3 --> P4(["open questions<br/>policy.questions"])
  P4 --> P5["name by the naming rule of openspec/config.yaml<br/>openspec new change &lt;name&gt; --schema bdk"]
  P5 --> P6["openspec instructions proposal<br/>write C/proposal.md"]
  P6 --> P7["openspec status, report<br/>next: /bdk:design"]
```

It never commits, branches or writes to GitHub. A Change of no behaviour sets `skip_specs: true` in `.openspec.yaml`.

## `/bdk:design`

Three blocks and a gate. The verifier is one agent continued with `SendMessage` across passes, so it keeps the context of what it checked.

```mermaid
flowchart TB
  EX["/bdk:explore<br/>Agent bdk:explorer, haiku"] -->|"R/design/explore.md"| DR
  DR["/bdk:design-draft<br/>bdk:designer"] -.->|"open decisions"| Q(["questions to the user<br/>policy.questions"])
  DR -->|"C/specs, C/design.md"| VER
  VER["/bdk:verify-design<br/>Agent bdk:verifier, opus"] -->|"R/design/verify-N.md"| V{{"verdict"}}
  V -->|"FAIL,<br/>budget left"| FIX["/bdk:design-draft<br/>fixes Must address"]
  FIX -->|"SendMessage to<br/>the same verifier"| VER
  V -->|"FAIL,<br/>budget spent"| STOPB["stop,<br/>no gate"]
  V -->|"PASS"| GATE(["design gate<br/>policy.gates.design"])
  GATE -->|"request<br/>changes"| REV["/bdk:design-draft<br/>with the request"] --> VER
  GATE -->|"auto, or<br/>approve"| GF["R/design/gate.md<br/>Gate: approved"]
```

Every block runs in the foreground: `/bdk:design` waits for each one before the next step.

Questions come in rounds, at most three. The designer writes the round's Lavish page, opens it and hands back; `/bdk:design` waits on the page (`lavish-axi poll`) and passes your answers to the same designer. A note on the page that asks for something new opens a decision for the next round; an answered decision is never asked again. When you stop the wait (for a summary, say), the answers you give on the page stay queued, and `/bdk:design <change>` picks them up. Without Lavish the questions come through `AskUserQuestion`, or in the reply.

An answer that adds or drops a capability changes `proposal.md` too: the designer owns that edit and records it in `design.md` as `Scope changed by the user:`. An answer against the issue's acceptance signal or a project rule (`CLAUDE.md`, `.claude/rules/`, the rules of `openspec/config.yaml`) is asked once more, quoting the rule; when you keep it, `design.md` records a `Deviation:` line, which the gate and the report name so you update the issue. BDK does not edit the issue.

The manual gate ends on exactly one question: approve, or say what to change.

The verifier budget is `policy.budgets.verifier` (default 3) passes per run. On a new start, `/bdk:design` skips every step whose file exists:

| Files found | Starts at |
|---|---|
| `gate.md` approved for the last report | nothing: reports the approved design |
| no `explore.md`, no `design.md` | explore |
| no `design.md` | `/bdk:design-draft` |
| no `verify-N.md` | `/bdk:verify-design` |
| last `verify-N.md` is `FAIL` | `/bdk:design-draft` fix, then `/bdk:verify-design` |
| last `verify-N.md` is `PASS` | the gate |

## `/bdk:plan`

```mermaid
flowchart TB
  L0{{"design finished?"}} -->|"no"| LS0["stop: /bdk:design first"]
  L0 -->|"yes"| DRAFT["/bdk:plan-draft<br/>bdk:planner"]
  DRAFT -->|"C/plan/parts/NN.md"| CHECK["bdk plan check<br/>waves, sizes, overlaps"]
  DRAFT -.->|"a gap of the design"| LS1["stop: answer it<br/>in /bdk:design"]
  CHECK -->|"exit 1, first time"| DRAFT
  CHECK -->|"exit 1 again"| LS2["stop: limits are<br/>plan.part.max-tasks,<br/>plan.part.max-files,<br/>plan.part.max-bytes"]
  CHECK -->|"exit 0"| VP["/bdk:verify-plan<br/>Agent bdk:verifier, opus"]
  VP -->|"R/plan/verify-N.md"| V{{"verdict"}}
  V -->|"FAIL, budget left"| FIXP["/bdk:plan-draft fixes<br/>Must address"] --> CHECK
  V -->|"FAIL, budget spent"| LS3["stop"]
  V -->|"PASS"| DONE["next: /bdk:execute"]
```

"Design finished" means `proposal.md`, at least one spec delta and `design.md` exist, and the last `design/verify-N.md`, when there is one, passes. A later pass continues the same verifier with `SendMessage`. The verifier runs each `bdk` call as a Bash command of its own, so your permission rule for `bdk` covers it; when a call it needs is still denied, it writes no report, and `/bdk:plan` stops and shows the denied command instead of a verdict. On a new start, `/bdk:plan` starts at the draft (no part), the check (parts, no report), the fix (last report `FAIL`) or the report (last report `PASS`).

A gap of the design is a choice about what the product does that the specs and the design leave open: a case a new requirement reaches counts even when no scenario names it, when its answers differ in a way you would care about, such as whether `--out <path>` overwrites a file that already exists. Ordinary input handling that the Change's error rules settle by analogy is the planner's choice, not a gap. `/bdk:plan-draft` names each gap in its reply and decides none; `/bdk:plan` then stops before any verifier pass, quotes the gaps and names `/bdk:design <change>`. Behaviour no requirement of the Change touches is not a gap and stays as the code has it.

## `/bdk:execute` and the `/bdk:execute-waves` lead

`/bdk:execute` is thin: it starts one `bdk:lead` with the stage skill `/bdk:execute-waves` and passes the result on. The lead is the only writer of `state.json` and the only agent that commits and merges.

```mermaid
sequenceDiagram
  actor U as user
  participant M as /bdk:execute
  participant L as bdk:lead
  U->>M: /bdk:execute change
  M->>M: plan parts exist?<br/>bdk run status
  M-)L: Agent: /bdk:execute-waves<br/>(background)
  Note over M: ends its turn, waits
  L->>L: waves: implement,<br/>conform, commit, merge
  L--)M: R/execute/result.md
  alt Status: done
    M->>U: next: /bdk:auto-review
  else blocked,<br/>decide-and-record
    M->>U: blockers, no retry
  else blocked,<br/>questions: stop
    M->>U: retry the blocked<br/>parts?
    U-->>M: retry
    M->>L: SendMessage: run again
  end
```

Inside the lead, waves run in order and the parts of a wave run in parallel batches of `execution.max-parallel` (default 10):

```mermaid
flowchart TB
  W0["bdk plan check parts --json<br/>waves and isolation"] --> W1{{"wave: null, or<br/>shared-not-alone?"}}
  W1 -->|"yes"| BL0["blocked: fix the plan"]
  W1 -->|"no"| W2["clean tree (or the earlier work<br/>of the next main-checkout part),<br/>Change branch, merge parts<br/>left unmerged by a break"]
  W2 --> W3["take the next wave<br/>with a part or its check not done,<br/>record its base in state.json"]
  W3 --> W4["a work directory per part<br/>main checkout: shared, or alone<br/>in its wave with no worktree yet<br/>else: R/worktrees/NN"]
  W4 --> W5["run the parts in batches<br/>of execution.max-parallel<br/>(next diagram)"]
  W5 --> W6["merge the done parts that ran<br/>in worktrees, in part order<br/>(git merge --no-ff)"]
  W6 --> WC["wave check<br/>bdk check run wave-N<br/>--at wave --changed base<br/>red: /bdk:resolve-conflict --wave,<br/>lead commits the repair"]
  WC --> NW{{"a part or the<br/>wave blocked?"}}
  NW -->|"no, waves left"| W3
  NW -->|"yes, or no wave left"| RES["write R/execute/result.md<br/>Status: done or blocked"]
```

A worktree isolates parts that run at the same time, so only a wave with two or more parts to run uses them. A part that is the only one not done in its wave runs in the main checkout, whatever its `isolation` says: no checkout to make, the project's installed dependencies and warm tool caches, and its commit lands on the Change branch with no merge commit. A part whose worktree or `bdk/<change>/part-NN` branch is left from an earlier run keeps running there, so its earlier work is kept. A part that ran in the main checkout and did not finish leaves its files uncommitted there; the next `/bdk:execute` continues from them, and stops only on changes outside that part's `files`.

Each part of a batch goes through these attempts; the implementers of a batch start in one message, then its conformers. The checks each worker runs are in the boxes; [Where execute runs your checks](#where-execute-runs-your-checks) has the details:

```mermaid
flowchart TB
  IMP["Agent bdk:implementer<br/>/bdk:implement-part<br/>attempts + 1<br/>in state.json"]
  IMP --> RED["acceptance tests,<br/>written first<br/>bdk check run NN-red<br/>--at part --kind test<br/>each red for<br/>the right reason"]
  RED --> BUILD["build the tasks"]
  BUILD --> PC["part checks<br/>bdk check run NN<br/>--at part --changed HEAD<br/>red: fix, run again<br/>3 runs in all"]
  PC -->|"R/execute/part-NN.md"| RI{{"part report"}}
  RI -->|"plan-defect or environment"| PB["part blocked"]
  RI -->|"other: checks still red,<br/>or no report"| RETRY
  RI -->|"done: checks green"| CONF["Agent bdk:conformer<br/>/bdk:conform-part<br/>fixes what keeps behaviour"]
  CONF --> CC["conform checks, only<br/>after an edit<br/>bdk check run conform-NN<br/>--at part --changed HEAD<br/>red after a fix:<br/>that fix undone"]
  CC -->|"R/execute/conform-NN.md"| RC{{"conform verdict"}}
  RC -->|"FAIL: a check red, a task<br/>left, or no report"| RETRY{{"attempts left?<br/>policy.budgets.part-attempts,<br/>default 3"}}
  RETRY -->|"yes (the last one on<br/>policy.escalation.model<br/>and .effort)"| IMP
  RETRY -->|"no"| PB
  RC -->|"PASS"| COM["lead commits the part,<br/>state.json: done"]
```

Merging a part that ran in a worktree into the Change branch:

```mermaid
flowchart TB
  MER["git merge --no-ff bdk/&lt;change&gt;/part-NN"]
  MER -->|"clean: no check runs"| MC["remove the worktree<br/>and the part branch"]
  MER -->|"conflict"| RC["Agent bdk:implementer<br/>/bdk:resolve-conflict<br/>resolves, then checks:<br/>bdk check run merge-NN --at part<br/>red: fix, 3 runs in all<br/>writes<br/>R/execute/merge-NN.md"]
  RC -->|"Status: done,<br/>no markers"| CM["lead: git add, git commit"] --> MC
  RC -->|"failed"| RC2["/bdk:resolve-conflict again<br/>on policy.escalation.model<br/>and .effort"]
  RC2 -->|"resolved"| CM
  RC2 -->|"failed"| AB["git merge --abort<br/>part blocked, worktree kept"]
```

One part, step by step inside its two worker agents:

```mermaid
sequenceDiagram
  participant L as bdk:lead
  participant I as implementer
  participant F as conformer
  participant B as bdk CLI
  L->>I: part NN,<br/>--run-dir, --workdir
  I->>B: bdk rules for --stage execute
  I->>I: check the task contracts<br/>(a plan defect stops here)
  I->>B: bdk check run NN-red<br/>--at part --kind test
  Note over I,B: acceptance tests must be red
  I->>I: build the tasks
  I->>B: bdk check run NN --at part<br/>--changed HEAD (up to 3 runs)
  I-->>L: R/execute/part-NN.md
  L->>F: part NN, --run-dir, --workdir
  F->>B: bdk rules for<br/>--stage execute
  F->>F: fix what keeps behaviour,<br/>leave the rest
  F->>B: bdk check run<br/>conform-NN (only<br/>after an edit)
  F-->>L: R/execute/conform-NN.md
  L->>L: git add -A, git commit
```

### Where execute runs your checks

Every check of the execute stage is a `bdk check run`, which runs your `tools.test`, `tools.lint` and `tools.build` commands (the [`tools`](/reference/bdk/settings#tools) items) and writes their output and the result under `R/checks/`. No agent runs a test, linter or build command itself. Each run names its check point with `--at`, and runs only the items whose `when` holds that point, plus the items without `when` ([check points](/guide/configuration#a-web-app-with-a-browser-e2e-check)). Five runs, in this order:

| Run | Who, when | Point, files | When it is red |
|---|---|---|---|
| `NN-red`<br/>test only | `bdk:implementer`, [`/bdk:implement-part`](/reference/bdk/skills#implement-part) step 4, before any code | `part`, the new acceptance tests | expected: each test must fail because the behaviour is missing, its own failure seen, in the output file when the last 20 lines printed under the red check do not show it; a broken test is fixed and run again. No `tools.test` item at `part` for these files blocks the part (`environment`) |
| `NN` | `bdk:implementer`, step 6, once the tasks are built | `part`, the files changed against `HEAD` | fix and run again, three runs in all; still red, the run ends as a blocker (`other`) and the lead retries the part. No `Status: done` without a green run |
| `conform-NN` | `bdk:conformer`, [`/bdk:conform-part`](/reference/bdk/skills#conform-part) step 5, only when it edited a file | `part`, the files changed against `HEAD` | a fix that broke it is undone; still red, the verdict is `FAIL` and the lead retries the part. With no edit it runs nothing and names `NN` unchanged |
| `merge-NN` | `bdk:implementer`, [`/bdk:resolve-conflict`](/reference/bdk/skills#resolve-conflict), only after a merge conflict | `part`, the conflicted files and the `files` of each part behind them | fix and run again, three runs in all; still red, one more resolve on `policy.escalation.model`, then the merge is aborted and the part blocked |
| `wave-N` | `bdk:lead`, [`/bdk:execute-waves`](/reference/bdk/skills#execute-waves) step 7, once every part of the wave is on the Change branch | `wave`, the files changed since the wave's base | `/bdk:resolve-conflict --wave N` repairs what two parts broke together and the lead commits it; still red, one more repair on `policy.escalation.model`, then the wave is blocked and no later wave starts |

**Which files a run covers.** `--changed <ref>` hands the run the files git reports changed against `<ref>`, untracked ones included. An item whose `command` holds `{files}` gets the changed files its `paths` match, and is skipped when none matches; an item with `paths` and no `{files}` runs its whole command only when one of its files changed; any other item runs its whole command ([configuration](/guide/configuration#examples)). A part that runs in a worktree runs its checks there, on the Change branch as it was when the wave started plus this part; the wave check is the first run on all the parts of a wave together.

**Where a slow suite runs.** Keep the fast checks of the changed files at `part`, the main test suite and the type check at `wave`, and the slow suites, a whole Playwright suite and the build at `review`: the first round of [`/bdk:auto-review`](#bdk-auto-review) runs them (`bdk check run round-N --at review`), where a red check is a `blocker` finding. A Change you take from `/bdk:execute` straight to a pull request has passed its part and wave checks only.

## `/bdk:auto-review`

Rounds and fix passes each run in a fresh `bdk:lead`; triage and fix planning run in the main thread. Round 1 reviews the whole Change, a later round only the fix commits of the round before.

```mermaid
flowchart TB
  RND["/bdk:review-round N<br/>Agent bdk:lead"] -->|"round-N/review.md"| TRI
  TRI(["/bdk:triage<br/>Skill, main thread<br/>policy.gates.review"])
  TRI -->|"a finding left<br/>undecided"| WAITU["stop until<br/>the user decides"]
  TRI --> FIX{{"a fix decision?"}}
  FIX -->|"yes"| PF["/bdk:plan-fixes<br/>Skill, main thread"]
  FIX -->|"no"| OK["review/result.md<br/>Status: done"]
  FIX -->|"yes, N at<br/>the budget"| BLK["review/result.md<br/>Status: blocked"]
  PF -->|"a finding<br/>Not planned"| BLK
  PF -->|"fixes/parts/NN.md"| FP["/bdk:execute-waves<br/>on the fix parts<br/>Agent bdk:lead"]
  FP -->|"fixes/result.md<br/>blocked"| BLK
  FP -->|"fixes/result.md<br/>done"| NEXT["N + 1: review only<br/>the fix commits"]
  NEXT --> RND
```

The budget is `policy.budgets.review-rounds` (default 3); at the last round triage runs with `--last-round`.

On a new start, `/bdk:auto-review` finds its place from the files of the last round: no round or a round without `review.md` runs the round, an undecided finding runs triage, a round without `fixes/index.md` plans the fixes, and an unfinished `fixes/result.md` runs the fix pass again.

Triage policy, which decides in auto mode and is the preselected recommendation in manual mode:

| Level (set by the judge) | Decision | With `--last-round` |
|---|---|---|
| `blocker` | `fix` | `fix` |
| `should-fix` | `fix` | `defer` |
| `nice-to-have` | `defer` | `defer` |
| `not-a-problem` | `accept` | `accept` |

## `/bdk:review-round` (lead skill)

```mermaid
sequenceDiagram
  participant L as bdk:lead
  participant R as reviewer x N
  participant E as e2e-tester
  participant I as integration<br/>reviewer
  participant J as judge
  L->>L: bdk git groups<br/>--record round-N:<br/>groups.json
  par batches of execution.max-parallel
    L->>R: /bdk:review-group<br/>per group
    R->>R: bdk findings add
  and
    L->>L: bdk check run round-N<br/>--at review<br/>--changed base<br/>--round N
    Note over L: appends red checks
  end
  par after the check run
    L->>E: /bdk:e2e-check
    E->>E: bdk findings add
  and
    L->>I: /bdk:review-integration
    I->>I: bdk findings add
  end
  L->>J: /bdk:judge
  J->>J: bdk findings level,<br/>bdk findings report
  J-->>L: round-N/review.md
  L->>L: write<br/>round-N/round.md
```

`bdk git groups` gets `--rounds R/review`, so a later round covers only what changed since the round before, and `--plan` with the plan parts (round 1) or the fix parts of the round before, so each group is one part. Every finding lands in `round-N/findings.jsonl`. The E2E tester starts only after the check run has ended, so your suites and the started product never compete for the same ports or browsers. A worker that fails is started once more with the same prompt; a second failure goes under `Gaps` in `round.md`.

## `/bdk:close`

```mermaid
flowchart TB
  C0{{"Change archived?<br/>archive committed?"}}
  C0 -->|"not archived"| C1
  C0 -->|"archived, openspec/ uncommitted"| C4
  C0 -->|"archived and<br/>committed"| C5
  C1["tree dirty?<br/>Skill /bdk:commit"] --> C2
  C2["Agent bdk:verifier (opus)<br/>/bdk:spec-conformance<br/>--base origin/&lt;base&gt;<br/>writes R/close/<br/>spec-conformance.md"]
  C2 -->|"FAIL"| CS["stop: archive nothing,<br/>name which side to fix"]
  C2 -->|"PASS"| C3["openspec archive<br/>&lt;change&gt; --yes<br/>deltas merged into<br/>openspec/specs/"]
  C3 --> C4["Skill /bdk:commit:<br/>only openspec/"]
  C4 --> C5["git push -u origin &lt;branch&gt;<br/>never forced"]
  C5 -->|"fails"| CP["stop: archived and<br/>committed locally"]
  C5 --> C6["gh pr view, or<br/>gh pr create, body from<br/>R/close/pr-body.md"]
  C6 --> C7["write R/close/pr.md last<br/>(bdk run status<br/>reads it as done)"]
```

## `/bdk:pr-review` and the `/bdk:pr-review-round` lead

Reviews any open pull request in a detached worktree. It runs no checks and no E2E; nothing reaches GitHub before the user confirms.

```mermaid
sequenceDiagram
  actor U as user
  participant M as /bdk:pr-review
  participant L as bdk:lead
  participant W as review<br/>workers
  participant G as GitHub
  U->>M: /bdk:pr-review 7
  M->>G: gh pr view
  M->>M: write pr-7/pr.md<br/>(brief)
  M-)L: Agent:<br/>/bdk:pr-review-round
  L->>G: git ls-remote,<br/>git fetch pull/7/head
  L->>L: detached worktree,<br/>find the Change,<br/>bdk git groups
  L->>W: reviewers,<br/>integration,<br/>judge
  W-->>L: findings.jsonl,<br/>review.md
  L->>L: remove worktree,<br/>result.md
  L--)M: Status line
  M->>U: verdict and every<br/>finding to post
  U-->>M: post, other<br/>verdict,<br/>comment only,<br/>or skip
  M->>G: gh api POST review.json
  M->>M: write posted.md
```

The workers get `--workdir`, `--change` (or `none`) and `--intent pr.md`. The question is skipped under `policy.questions: decide-and-record` or when the request says to post without asking; on your own pull request the review is posted as `COMMENT`.

Several pull requests (`/bdk:pr-review 7 8`) start one lead each in one message, at most `execution.max-parallel`; the reviews are shown when every lead has returned, and one question covers all of them. A lead checks the head with `git ls-remote` and fetches without `FETCH_HEAD`, so leads in one repository do not read each other's head.

`--verify` re-checks your previous review and reviews only the commits added since it:

```mermaid
sequenceDiagram
  actor U as user
  participant M as /bdk:pr-review
  participant L as bdk:lead
  participant R as reviewers<br/>and judge
  participant G as GitHub
  U->>M: /bdk:pr-review<br/>--verify 7
  M->>G: gh api graphql (reviews, threads)
  M->>M: write pr-7/previous.json<br/>(your open blocker and<br/>should-fix findings)
  M-)L: Agent:<br/>/bdk:pr-review-round<br/>--verify --since<br/>(previous head)
  L->>L: worktree at<br/>the new head,<br/>bdk findings add<br/>each previous<br/>finding
  L->>L: bdk git groups<br/>(previous head)<br/>(origin/base after<br/>a force-push)
  L->>R: review the<br/>new commits,<br/>then judge the<br/>whole round
  R-->>L: findings,<br/>levels,<br/>review.md
  L--)M: Status line
  M->>U: fixed<br/>(not-a-problem),<br/>left and new<br/>findings
  U-->>M: post, other<br/>verdict,<br/>comment only,<br/>or skip
  M->>G: gh api POST review.json<br/>(inline comments on new findings)
  M->>G: resolveReviewThread<br/>for each fixed finding
```

The previous findings go into the round's log before any reviewer starts, and the reviewers, the integration reviewer and the judge then run on the range from the previous review's head to the new head; after a force-push (the previous head is no longer an ancestor) they review the whole pull request. The judge levels the previous and the new findings together, and of two findings that repeat each other it keeps the earlier one. A previous finding the judge now levels `not-a-problem` is fixed; any other level is left. New `blocker` and `should-fix` findings inside the diff become inline comments, as in a review. A left or new `blocker` requests changes. Only threads you opened are resolved, and only after the review is posted.

## `/bdk:debug`

```mermaid
flowchart TB
  G0{{"clean tree for<br/>a new report?"}} -->|"no"| GS["stop: commit or<br/>stash first"]
  G0 -->|"yes"| G1
  G1["Skill /bdk:diagnose-bug<br/>reproduce as a user<br/>(tools.e2e or public interface)<br/>writes R/debug/reproduction.md,<br/>diagnosis.md and the fix Change:<br/>proposal, spec delta, design,<br/>plan/parts/01.md"]
  G1 -->|"too-large"| GL["stop: continue with<br/>/bdk:design &lt;change&gt;"]
  G1 -->|"ready"| G2(["fix gate<br/>policy.gates.design"])
  G1 -->|"not-reproduced<br/>or blocked"| GX["stop, nothing<br/>changed"]
  G2 -->|"fix"| G3["write R/debug/gate.md<br/>git switch -c &lt;change&gt;<br/>when on the base<br/>Skill /bdk:commit<br/>the Change"]
  G2 -->|"stop"| GT["leave the Change<br/>for review"]
  G3 --> G4["Skill /bdk:execute<br/>reproduction test red,<br/>fix, green, conform"]
  G4 -->|"done"| G5["Skill /bdk:auto-review"]
  G4 -->|"blocked"| G6
  G5 --> G6["write R/debug/result.md<br/>next: /bdk:close"]
```

## Sources

- `plugins/bdk/skills/{setup,propose,design,plan,execute,execute-waves,implement-part,conform-part,resolve-conflict,auto-review,review-round,triage,plan-fixes,close,pr-review,pr-review-round,debug,diagnose-bug}/SKILL.md`
- `plugins/bdk/agents/*.md`
