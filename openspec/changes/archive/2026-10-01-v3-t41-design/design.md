## Context

See proposal.md (Why, and the decisions taken with the user on 2026-10-01). Requirements: `specs/stage-skills`, `specs/kernel-pipeline`, `specs/skill-evals`.

State the design builds on:

- `pipeline/pipeline.yaml` orders the design stage as `design` (small) or `design-parts` then `design-index` (large), then `architecture`, then `gate:design`. No node needs a verdict, so the gate is ready right after the last document is done (probe in a scratch repository, 2026-10-01).
- The verdict machinery exists: `PlanVerifyKind` and `ReviewKind` share `verdictChecks` (latest `report` naming the node, passing status, no live blocker naming it, cited evidence). `artifactPaths` gives a verdict node's package the files of the node and of the nodes it requires. `attempt open verifier <target>` opens a ticket on any ready node; `dispatch build <target> design-verifier <ticket>` builds a package with the closed P8 categories.
- The latest report wins even when it is older than the artifact it verifies: `verdictChecks` never compares times.
- `attempt open` and `dispatch build` are orchestrator commands; `guard/subagent-kernel-command` denies them to every subagent except a lead on its own part. A role started through `Agent` needs its package path as the prompt (`guard/dispatch-prompt`), and an escalation ticket needs `Agent`'s `model` parameter (`guard/escalation-model`); a forked skill cannot set a model.
- The `ctx skill design` manifest entry exists (architecture, engineering-judgment, project rules, `decision` fragment). `fragments/decision/lavish.md` describes `lavish-axi` as a question router; the current `lavish-axi` (read with `npx -y lavish-axi --help` on 2026-10-01) is a review loop: write an HTML page under `.lavish/`, open it with `lavish-axi <file>`, wait with `lavish-axi poll <file>`, and never reopen a session the user ended.
- The v2 `skills/design/SKILL.md` (377 lines) holds the parts worth keeping: grounding before questions, two or more approaches with diagrams, the devil's-advocate checklist (`references/self-critique-checklist.md`), the schema-change gate and the warm-agent reuse rule. It writes to `.bdk/design/`, which v3 does not read.

## Goals / Non-Goals

**Goals:**

- A thin `design` that a user runs after `/bdk:change` and that leaves the Change at a ready `gate:design` with a passing verdict.
- A `verify-design` that gives the same verdict whether `design` or the user starts it, and that the graph cannot skip.
- One rule for when a question deserves a Lavish page, shared by every skill that asks.

**Non-Goals:**

- No MADR output (decision 3, T42).
- No change to how `run` passes `gate:design` (`v3-t41-close-run`).
- No measured eval series; only `--probe`.

## Decisions

### D1 `design-verify` as a verdict kind and node

A `DesignVerifyKind` beside `PlanVerifyKind`, using the same `verdictChecks`. Hash inputs: `design.md`, `architecture.md` and every file of `design/parts/`, those that exist, so any edit to the design makes the verdict stale. It writes nothing. Node:

```yaml
- id: design-verify
  kind: design-verify
  stage: design
  requires: [design, design-index, architecture]
  profiles: [small, large]
  kinds: [feature]
  budget: verifier
```

`gate:design` adds `design-verify` to its `requires`. A requirement that is skipped or absent in the variant (for example `architecture` under `architecture: false`, `design-index` on `small`) is already treated as satisfied by the graph, as for the gate today. The instruction template `pipeline/design-verify.md` names `/bdk:verify-design` and the report rule, like `pipeline/plan-verify.md`.

- Alternative: verification as `review: true` entries the gate lists. Lost: `run` with an automatic gate passes by them (decision 1).
- Alternative: a check inside `DesignKind`'s validator that a report exists. Lost: `bdk done design` would need a verdict on a file it is about to write; the verdict belongs to a later node, as with the plan.
- Alternative: make `gate:design` itself require a report. Lost: the gate checks provenance and timing only (`kernel-pipeline`, Gate); mixing a content verdict into it breaks that rule.

### D2 The `fresh` check of every verdict kind

`verdictChecks` gains a check `fresh`: the latest report's `at` is not earlier than the latest `done` transition of any node the verdict node requires, both truncated to the second like the gate's ready time. A failing check names the report and the newer `done` entry, and its `instead` tells the caller to run the verifier again. It applies to `design-verify`, `plan-verify` and `review` (decision 4).

- Alternative: only for `design-verify`. Lost: `plan-verify` and `review` keep the same hole, and the next T41 Change would add the same code.
- Alternative: compare the report against the input hash recorded at `done`. Lost: a report does not record the hash it judged, so this needs a new report field and a role-contract change; the `done` times already exist in the ledger.

### D3 `verify-design` runs in the main thread and starts the role through `Agent`

The skill body, in the main thread: `bdk attempt open verifier design-verify` (the refusal `policy/not-ready` ends it with the `instead`), `bdk dispatch build design-verify design-verifier <ticket>`, then `Agent` with `subagent_type: bdk:reader`, the package path as the whole prompt and, when the build output carries a `model`, that model; foreground, since the skill waits for the verdict. After the agent returns: a missing or refused report gets one `SendMessage` resume naming the cause; then `bdk attempt close <ticket> ok|fail --envelope <report>`; on a passing report with no live blocker, `bdk done design-verify`. On `fail` the skill renders the blockers and the `next.action` of `attempt close` (`retry`, `escalate`, `parked`).

- Alternative: `context: fork` with `agent: bdk:reader` on `verify-design` itself, as the T41 plan sketched. Lost: the forked skill runs as a subagent, so `guard/subagent-kernel-command` denies it the `attempt open` and `dispatch build` it needs.
- Alternative: invoke the forked role skill `bdk:design-verifier` with the package path as its argument. Lost: a forked skill cannot take the escalation model, so the escalation ticket would need a second path; one `Agent` path covers both.

The fresh context comes from the role agent, which knows only its package; the skill that orchestrates it stays in the conversation that wrote the design, which is what lets `design` revise and verify again.

### D4 `design` follows `next`, the conversation decides the content

The skill loops on `bdk next --json`: write the artifact at the named path with the named frontmatter, `bdk done <id>`, until `next` names `design-verify`, which it hands to `/bdk:verify-design`, and then the gate. After the verdict the user reviews the written design and the verdict together (user decision 2026-10-01, Lavish review page): verification runs first, so the review shows the verifier's points next to the text. A change requested there is written, marked done and verified again before the next review; the gate is rendered only after the user accepts a design with a passing verdict.

- Alternative: the user reviews the draft before `bdk done design` and verification runs on the accepted text. Lost (user choice): one more review round per design, and the user judges the draft without the verifier's findings. Before the first write it does the conversation of v2 that the kernel cannot do: grounding, the approaches, the user's choice, the schema gate.

After a verdict the coordinator (`design` in the main thread) acts before the review (user decisions 2026-10-01):

- `false-code-claim` blockers: corrected without a question, because the code is the authority; the correction is listed in the review. A correction that would change a recorded decision is not a fact fix and is asked.
- Blockers of the other categories: one question with every blocker and a proposed fix.
- Findings of `done-with-concerns`: the coordinator decides per finding "fix before planning" or "goes to planning", fixes the first kind, and shows each finding with its decision and reason in the review.

Every fix is written, marked done and verified again before the review, so the review always shows a verdict as new as the text.

- Alternative: ask about every blocker, `false-code-claim` included. Lost (user choice): a question whose answer the code already gives.
- Alternative: findings pass unjudged to the review. Lost (user choice): the user would triage what the coordinator can judge, and a finding worth fixing would reach planning.

Body of `SKILL.md` (under 200 lines): ground, ask (the tier rule of D6), write, record decisions, verify, review with the user, render. Two references, both linked from `SKILL.md`:

- `references/approaches.md`: the shape of an approach (essence, components, data flow, tradeoff axes, diagram per `/bdk:mermaid-drawer`), the self-critique checklist carried over from v2, and the split rule.
- `references/schema-gate.md`: the v2 schema-change gate, with approval recorded as a `decision` entry.

Grounding reads the code from the main thread or with the host's own read-only search agent. `bdk:scout` is not used: from the main thread it needs a dispatch package and ticket, which no design-stage loop provides.

- Alternative: keep the v2 phase structure (classify product / architecture / combined first). Lost: the kernel already decides what is written (`architecture: false` for product-only), so a separate classification question asks what the design conversation finds anyway.
- Alternative: a `design` reference with a full document template. Lost: the kernel fixes the frontmatter and the decisions go to the ledger; a long template pulls content back into the file that belongs in entries.

### D5 The `large` path follows the graph

The T41 plan says "`architecture.md` first, then one design part per group". The graph orders the parts before `architecture` (`architecture` requires `design-index`), and T21 made the graph the authority. The skill settles the split and the module boundaries in the conversation, writes the parts, lets `bdk done design` raise the profile, follows `next` through the parts and the index, and then writes `architecture.md`, which records the boundaries the parts already use.

- Alternative: reorder the pipeline so `architecture` precedes the parts on `large`. Lost: `architecture` would need different `requires` per profile, which the node fields cannot express, and the conversation already fixes the boundaries before any file is written.

### D6 Two tiers in the `decision` fragment

`fragments/decision/lavish.md` and `fragments/decision/ask-user.md` both start with the tier rule: a simple decision (label plus one sentence per option) always goes to `AskUserQuestion`; a rich decision (diagram, side-by-side comparison, schema delta, annotated draft) goes to Lavish in the Lavish fragment, and is printed before `AskUserQuestion` in the ask-user fragment. The Lavish procedure follows the current CLI: read `lavish-axi --help` and the playbooks it lists for comparison and input once per session, write the page under `.lavish/`, open it, wait with `poll` in the foreground, read the selections, fall back to `AskUserQuestion` on any failure, never reopen a session the user ended. No flag beyond what `--help` prints is written into the fragment.

What the terminal fallback loses, stated in the ask-user fragment: rendered diagrams, a side-by-side layout and annotation on the draft; it keeps every option, the recommendation and the tradeoffs.

- Alternative: a Lavish procedure only inside `design` (rejected by the user, decision 2).
- Alternative: a per-question tier flag in settings. Lost: the question's shape decides the tier, and a setting cannot see the question.

### D7 Layout, manifest and removal

- `skills/stages/design/` and `skills/stages/verify-design/`; the v2 `skills/design/` is deleted in the same commit, so `/bdk:design` resolves to one skill (`stage-skills`, Stage skill shape). Neither sets `disable-model-invocation` (decision 5).
- Manifest: `design` keeps its parts; `verify-design: []` keeps its context lines for the `BDK STOP` line, as `change` does.
- `skills/create-adr/` and v2 skills that name `/bdk:design` (`create-plan`) stay until their own Changes; their handoff text still resolves.

### D8 Eval cases

`evals/suites/stages/cases/design.yaml` and `verify-design.yaml`; `STAGE_SKILLS` gains both. Every case's `prepare` sets `features.lavish false` through `bdk config set`, because a Lavish page would wait for a browser that the eval session does not have.

- `design/small-feature`: prepare opens a `small` feature Change on the fixture; the command is `/bdk:design`; answers take the first option; expects `design` and `design-verify` done and `gate:design` ready.
- `design/no-change`: no Change; expects no Change directory and a reply naming `/bdk:change`.
- `verify-design/clean`: prepare writes and marks done a small `design.md` and `architecture.md` that agree with the fixture; expects `design-verify` done.
- `verify-design/false-claim`: the same with a `design.md` naming a file the fixture lacks; expects a live blocker naming `design-verify` and the node not done.
- `verify-design/not-ready`: prepare opens the Change only; expects no ticket and a reply naming `/bdk:design`.

The `large` path is covered by kernel tests (profile raise, parts, index), not by an eval case: a model choosing to split is not a stable expectation.

### D9 Documentation

`docs/guide/reference/skills.md` (`/bdk:design`, `/bdk:verify-design`), `reference/artifacts.md` (the design files, `design-verify`), the workflow pages that describe the design stage, README's skill table. `V3_PAGES` of the banner test gains every page rewritten for v3.

### D10 The verifier records its verdict with `log add report`

A verdict kind reads the latest `report` entry naming its node, and the write map assigns that entry to `log add`, but `log add` had no way to set the entry's required `report` field and `log ingest` writes no entries by contract; the kernel's tests wrote the entry as a fixture, so no test noticed (found by the probe of task 1.5, user decision 8, 2026-10-01). `log add report` now requires `--ticket`, fills `report` with the active package's report path (relative to the Change directory), refuses with `input/not-found` while `log ingest` has stored nothing there, adds the ticket's target to the refs, and never deduplicates, since each round is its own report. The role writes it right after `log ingest`, as it writes every other entry of its ticket; `verify-design` checks after the agent returns that the entry exists and resumes the agent once when it does not, under the single-resume rule.

- Alternative: `attempt close` writes the entry for a `verifier` ticket. Lost: a second writer of ledger entries for role output, against T23-D14 (entries come from `log add`), and the report would not be recorded on a ticket the orchestrator never closes.
- Alternative: a `--report <path>` flag on `log add`. Lost: the caller would pass a path the kernel already knows from the package, and a wrong path is easy to give.

## Risks / Trade-offs

- [The `fresh` check breaks kernel tests whose fixtures write a report before the verified node's `done`] → update those fixtures in the same task; the check's own unit tests come first.
- [A design session is long, so the `design` eval case costs more than the setup cases] → probe one run per case; the full series is T43's.
- [The design-verifier blocks on wording the verdict list does not cover] → the P8 list and the "not a FAIL" list in the package already bound it; a non-category blocker is downgraded by the kernel.
- [`verify-design` waits in the foreground for one agent] → one verifier per ticket is the contract (`role-contracts`, Role-to-adapter map: `design-verifier` count one); parallelism has nothing to gain.
- [Lavish fragment drifts from the CLI again] → the fragment names commands only and points to `--help` and the playbooks for everything else.

## Migration Plan

No user state migrates. v3 is not released, so only Changes opened while building it are affected. A Change with `design` done and `gate:design` not passed gets a ready `design-verify` node on the next graph read and needs `/bdk:verify-design` before the gate. A Change already past `gate:design` loses the gate's ready time until `design-verify` is done, because the gate's requirements are no longer all done; it needs a verdict and a new pass of the gate. v2 designs under `.bdk/design/` are not read; `/bdk:setup` already deletes them.

### D11 A blocker raised under a ticket names the ticket's target

The probe of task 5.3 (2026-10-01) showed the `design-verifier` raising its blockers with `--ref design.md`, as its contract allows, while the verdict check and `verify-design` count only live blockers that name `design-verify`; a verdict with live blockers could then be marked done. `log add blocker --ticket` now appends the active package's `target` to the refs, as `log add report` does (D10), so every blocker of a round names the node it blocks and stays counted until it is resolved, across later rounds. `log list` summaries carry `category`, since `verify-design` and `design` sort blockers by category and read only summaries. The same probe showed `attempt close` returning `next.action: narrow`, which `verify-design` now reports as a retry whose next round checks only the scope it names.

- Alternative: the verdict check counts the live blockers written under the report's ticket. Lost: a blocker of round 1 that nobody resolved stops counting once round 2 opens a new ticket.
- Alternative: the role contract tells the verifier to add `--ref <target>`. Lost: a rule the model can forget, which the probe showed it does.
