# Design

## Context

Issue #293 lists eleven defects seen while running `/bdk:setup`, `/bdk:propose` and `/bdk:design` on this repository for #285. All of them live in skill text (ADR-0003: logic lives in skills), so every fix is a skill or agent text change plus an eval case; no `bdk` CLI change is needed.

What exists:

- `skills/setup/SKILL.md` step 3 asks only for a schema "other than `spec-driven` or `bdk`", and step 7.3 always sets `schema: bdk`. Every BDK skill that opens a Change passes `--schema bdk` explicitly (`skills/propose/SKILL.md` step 5), so the project's default schema matters only to Changes opened without BDK.
- `skills/setup/references/e2e.md` classifies web app, HTTP API, CLI and library; a Claude Code plugin falls through to `cli` (a `bin/`) or library.
- `skills/propose/SKILL.md` step 5 names a Change `<issue-number>-<slug>` and reads `rules.proposal` only later, through `openspec instructions proposal` in step 6.
- `skills/design/SKILL.md` says "wait for it" but never asks for a foreground `Agent` call; `execute`, `auto-review` and `pr-review` already name `run_in_background` explicitly.
- `skills/design-draft/SKILL.md` step 4 is "Ask, once"; the designer opens the Lavish page and blocks on `lavish-axi poll` itself. `lavish-axi poll --help` says feedback "remains queued until delivery", so a later poll picks it up.
- `skills/explore/SKILL.md` and `agents/explorer.md` allow only `git log`, `git show` and `ls`.

## Goals / Non-Goals

**Goals:** fix all eleven items in the skills, each changed behaviour shown by an eval case; resolve the two "To resolve in the spec" questions here.

**Non-Goals:** a settings key for question rounds; writing to GitHub from the design stage; changes to `triage`'s own Lavish flow (it has no hand-back problem reported).

## Decisions

### D1. `/bdk:setup` keeps a schema it did not write, unless the user agrees (item 1)

When `openspec/config.yaml` already exists and names a schema other than `bdk`, setup asks one question in its existing round: "Make `bdk` the default OpenSpec schema of this project?", recommended first "Keep `<schema>`; BDK opens its Changes with `--schema bdk`", second "Switch to `bdk`". Without a way to ask it keeps the schema and says so in the report. When setup itself ran `openspec init` (or wrote the layout), it sets `schema: bdk` without asking: that line is its own. The schema files are installed in every case.

Alternatives: always switch (the old behaviour) - silently changes a team's workflow and leaves `context:` text contradicting the schema line, the defect itself. Never switch and never ask - safe, but a team that wants `bdk` as default must edit the file by hand and the report has nothing to point at. Asking costs one question in a round that exists anyway, and the recommended answer is the safe one.

Answers the issue's question "asks before switching, or leaves it": it asks, and leaving it is the recommended and the unattended answer.

### D2. A Claude Code plugin is its own E2E kind (item 2)

Signal: `.claude-plugin/plugin.json` in the package (a `.claude-plugin/marketplace.json` alone points at plugins, each classified by its own directory). Item `plugin` (`plugin-<name>` for several), `driver: cli`, `start` the plugin's build command when it has one (its `dist/` is built), else `claude plugin validate <dir>`; `ready` `claude plugin validate <dir>`. The E2E tester's `cli` driver drives such an item as its user does: a session in a scratch directory, `claude -p "<what the user types>" --plugin-dir <abs dir>`, reading the reply and the files the session left.

Alternatives: a new driver `claude` - one more driver for the tester, the settings schema and docs, while a session is a command with an output, which the `cli` driver already handles. Keeping the `bin/` CLI item - it never starts the skills and hooks a user sees.

Hidden cost: every driven scenario is one model call on the user's account; the report line says so.

### D3. A removed ignore rule is its own report line (item 3)

The report gets `Removed <rule> from <file> (BDK v2 ignored all of .bdk/): .bdk/settings.yaml is now tracked; .bdk/runs/ and .bdk/settings.local.yaml stay ignored.` The behaviour stays; only the report changes. Alternative: ask first - the removal is required for the team to share settings, so a question would have one sane answer.

### D4. `/bdk:propose` reads the project's naming rule before it names (item 4)

Step 5 reads `openspec/config.yaml` (Read) and, when a `rules.proposal` entry says how a Change is named, follows it (`v3-<N>-<slug>`); otherwise the default stays. `--name` still wins. Alternative: run `openspec instructions proposal` first - it needs an existing Change, which is the thing being named.

### D5. `design-draft` asks in rounds, at most three (item 6)

"Ask, once" becomes "Ask in rounds". Round 1 asks every open decision. After the answers, a decision the answers opened (a free note that asks for something new, drops a capability or contradicts a rule, D7) is asked in a follow-up round; an answered decision is never asked again. At most three rounds in all; a decision still open after the third takes the recommended answer with a `Decided without the user:` line. Each Lavish round is a new page `.lavish/design-<change>-<round>.html` (round 1 keeps `design-<change>.html`), because a session the user ended with Send & End must not be reopened uninvited.

Alternatives: unlimited rounds - can loop; one round and record everything else - a user note like "add a settings override" then never reaches the user. A settings key (`policy.budgets.question-rounds`) - configurability without a run that needed it; the fixed number can become a key when one does (Out of scope).

### D6. `design-draft` owns `proposal.md` edits on a scope change (item 7)

When an answer adds, drops or narrows a capability or a "What Changes" bullet, the designer edits `proposal.md` (What Changes, Capabilities, Out of scope) to match before it writes the spec deltas, and records it in `design.md` under the decision as `Scope changed by the user: <what>`. In a revision, a spec delta of a dropped capability is deleted with `rm`. The verifier already checks proposal and specs agree.

Alternatives: send the Change back to `/bdk:propose` - it stops on an existing `proposal.md` by design, and re-running it would lose the issue's carried scope. Let the orchestrator edit it - the orchestrator only composes blocks (spec `bdk-design`). The designer holds the answer, so it owns the edit; "one block, one job" stays: its job is the Change's design artifacts, now including the scope they agree on.

### D7. A decision against the acceptance signal or a project rule is confirmed and recorded, not written to GitHub (item 8)

When an answer contradicts the issue's acceptance signal (as carried into `proposal.md`) or a project rule (`CLAUDE.md`, `.claude/rules/`, `openspec/config.yaml` rules), the designer asks it once more in the next round, naming the rule and quoting it: keep the deviation, or follow the rule (recommended). A kept deviation is recorded under its decision as `Deviation: <rule or acceptance signal, with its source> - <what the user chose and why>`, and `proposal.md` moves the dropped part to Out of scope. `/bdk:design` lists every `Deviation:` line in the gate question and in its report, with the note that the tracking issue's acceptance signal needs the same change.

Alternative: have `/bdk:design` edit the issue with `gh` - no design-stage block writes outside the repository today; an outward write belongs with the user or `/bdk:close`. Under `decide-and-record` there are no user answers, and recommended answers never deviate, so the case does not arise.

### D8. The designer opens the page and hands back; the caller polls (item 9)

The designer writes and opens the page, then ends its turn with `Page open: <path>` and the open decisions (the same list as the no-Lavish path). The thread that started it - `/bdk:design` step 3, or `design-draft` step 0 for a typed command - runs `npx -y lavish-axi poll <path>` in the foreground, as Lavish asks, and sends the feedback to the same designer with `SendMessage`. When the poll is interrupted or the user asks to stop waiting, the thread does not poll again: it replies with what the user asked (for example a summary), the page path and the open decisions, and ends its turn. A later `/bdk:design <change>` (or the user saying to continue) finds the page without `design.md`, polls it again, and the queued feedback arrives.

Alternatives: a background poll - Lavish allows it only through a tracked job that resumes the same agent, and the designer would have to stay alive; the issue's run showed that background waits end the turn. Keep the poll in the designer - a subagent blocked on a poll cannot be interrupted by the user's message, the defect itself.

```mermaid
sequenceDiagram
  participant M as /bdk:design (main thread)
  participant D as bdk:designer
  participant L as Lavish page
  M->>D: Agent: design-draft <change>
  D->>L: write + open page
  D-->>M: Page open: <path>, open decisions
  M->>L: poll (foreground)
  alt feedback
    L-->>M: answers
    M->>D: SendMessage Answers: ...
    D-->>M: files written, or next round
  else user stops the wait
    M-->>M: reply: page path, open decisions; end turn
    Note over M,L: feedback stays queued; /bdk:design <change> polls again
  end
```

### D9. Blocks run in the foreground (item 5)

Every `Agent` call of `/bdk:design` sets `run_in_background: false`; the next step reads the block's file. When an agent still runs in the background (a harness that forces it), the orchestrator ends its turn with one line naming the block, and resumes from the run files (step 2) when it is notified. Alternative: rely on the notification always - the orchestrator then ends its turn while a block runs, which the dogfood run showed as a stall.

### D10. A CLI's options are settled with its help command (item 10)

`explore` may run a read-only help command of a tool the proposal names (`<tool> --help`, `<tool> <sub> --help`, `<tool> --version`) and records the answer with the command as evidence. When it cannot run it, the `Unsure` bullet names the exact command. `verify-design` runs that command itself before raising a doubt about the tool's options. The explorer agent's command list gains these forms. No skill pre-approves `Bash(* --help)`: a wildcard ahead of `--help` matches any command, so permission stays with the user's mode.

### D11. The gate ends on exactly one question (item 11)

The manual gate is one `AskUserQuestion` call and nothing after it; the summary (files, report, decisions, deviations) goes into the question text, not a reply before it. Without `AskUserQuestion`, the reply ends with one line: `Approve the design of <change>? Reply "approve", or say what to change.` The same "end on one question" rule applies to the open-questions relay of step 3.

## Risks / Trade-offs

- [Bottleneck] A plugin E2E scenario is a full model session (tens of seconds and a few cents each) -> the setup report names it, and `e2e-check` drives only scenarios a session shows.
- [Failure mode] The user interrupts the poll and never resumes -> the page path and open decisions are in the reply, and `/bdk:design <change>` resumes at row 3 because `design.md` is missing.
- [Hidden cost] `proposal.md` now has two writers (`propose`, `design-draft`) -> the second edits only on a recorded scope answer, and `verify-design` checks the proposal against the specs on every pass.
- [Unconfirmed assumption] A naming rule in `rules.proposal` is written so a model can read the pattern (`v3-<N>-<slug>`) -> when no rule names a pattern, the default stays.
- [Unconfirmed assumption] `claude plugin validate <dir>` exits 0 for a valid plugin (checked on `plugins/bdk-craft`, Claude Code of this repository).

## Eval results

One run per case, `claude plugin eval --ablation none --runs 1`, with the grants of `plugins/bdk/evals/README.md`. "Before" is the same case run against the skills of `f2bf4184` (the base of this Change).

| Case | Before | After |
|---|---|---|
| `setup-existing-openspec` | 0.57 | 1.00 |
| `setup-claude-plugin` | - | 1.00 |
| `propose-naming-rule` | 0.80 | 1.00 |
| `explore-cli-options` | 0.60 | 1.00 |
| `design-fresh-auto-gate` | - | 1.00 |
| `design-manual-gate-no-ask` | 0.89 | 1.00 |
| `design-draft-lavish` | - | 1.00 |
| `design-draft-follow-up-round` | - | 1.00 |
| `design-draft-scope-narrowed` | - | 1.00 |
| `design-draft-rules` (from #272, after the rebase) | - | 1.00 |

Fixes the runs drove: the main thread polled the open page only when told to always poll and never ask the page's questions in its reply; it paraphrased the user's note until told to relay the poll output verbatim; the designer missed the `CLAUDE.md` rule until step 2 read the project rules; the manual gate added a line after the question until the skill said nothing follows it. The two checks of a round-2 page (`second-page-only-new`, `deviation-asked`) started as `llm` graders; the judge does not see the page the designer wrote, so they are regexes on the `Write` of that page, checked against the kept traces of the last runs. After the rebase onto the project rules of #272, `design-draft-follow-up-round`, `design-draft-scope-narrowed` and `design-draft-rules` ran again on the merged `design-draft` text.

## Migration Plan

None: skill text only. A project already switched to `schema: bdk` by an earlier setup keeps it.

## Open Questions

None.
