## Context

See proposal.md for why. What this Change builds on:

- Architecture (`docs/design/2026-10-07-v3-architecture.md`): the catalog row "`/bdk:close` | main thread | `spec-conformance`, `openspec archive`, `commit`, PR | PR"; the autopilot flow "Skill close: spec-conformance, archive, commit, PR"; row 9 of "Autopilot continuation" ("no spec-conformance report, or the Change not archived, or no PR: close, from its first missing step"); principles "one block, one job" and "plain skill first".
- D9 of `docs/design/2026-10-07-v3-skills-decisions.md`: every Change has its own branch from the base branch and its own PR into it; nothing in BDK rebases or force-pushes a branch with an open PR; queue order belongs to `/bdk:run`.
- Spec `bdk-cli/run` (#188): row 9 reads `close/spec-conformance.md` (passes when its first verdict line is `Verdict: PASS`), whether the Change sits under `openspec/changes/archive/`, and whether `close/pr.md` exists (`plugins/bdk/src/run/domain/status.ts:168-171`, `plugins/bdk/src/run/store/status.ts:186`). These three files are the contract close fills; no CLI change is needed.
- `spec-conformance` (#196): runs on `bdk:verifier`, takes `[<change>] [--base <ref>]`, reads `git diff <base>...HEAD`, replaces one report per Change and carries IDs over. Its design names close as the owner of what follows a `FAIL`.
- `commit` (#206): stages by path, finds the project's convention, takes arguments that name paths and grouping ("one commit for the archived Change" is its own argument example).
- `/bdk:design` (#198, merged in #240): the pattern for an orchestrator - compose blocks, one line per block to the user, a resume table from files, stop instead of doing a block's work, `tool_order` plus `file_exists` graders in its orchestrator cases (enforced by `plugins/bdk/tests/evals.test.ts`).
- OpenSpec 1.13.2 `openspec archive <change> --yes` merges the deltas, moves the Change to `archive/<date>-<change>/`, honours `skip_specs: true` without a flag, and validates the deltas first (checked in a scratch project from `fixtures/tally-change.sh`).
- Inputs read, not copied: draft 1 `skills/stages/close` (a kernel `bdk change close` doing archive and commit in one call, the PR left to the user); the B1 findings (the archived Change was 570 files of run records, and nobody checked the merged spec).

## Goals / Non-Goals

**Goals:**

- One command ends a reviewed Change: checked specs, merged living documentation, one archive commit, a pushed branch and a PR into the base branch.
- Wrong documentation never reaches the main specs: a failing spec-conformance report stops the archive.
- A close that broke halfway (no remote, `gh` not logged in, a crash) continues from its first missing step without repeating the paid check.
- `bdk run status` sees the result through the files it already reads.

**Non-Goals:**

- Fixing what spec-conformance reports (see D3).
- Ordering the queue and waiting on unmerged blockers (`/bdk:run`, #203).
- Merging the PR, rebasing, or keeping a branch up to date with its base (D9).

## Decisions

### D1. A plain orchestrator skill in the main thread

`plugins/bdk/skills/close/SKILL.md` composes the steps; it does no block's work. It starts the verifier with the `Agent` tool directly (prompt `Run the skill bdk:spec-conformance with the arguments: <change> --base <base>`), as `/bdk:design` starts `verify-design`, instead of calling `Skill bdk:spec-conformance` and letting that skill hand off: one hop less, and the Agent call is the step the eval orders. `commit` runs through the `Skill` tool in the main thread, because it is a tool skill without an agent. Archive, push and `gh` are single commands.

Why: the catalog places close in the main thread; nothing in it needs a lead. Alternatives: a `bdk change close` command doing archive, commit and PR - lost, it repeats draft 1's root cause (process in the CLI) and no eval shows a problem a helper would solve. A lead agent - lost, close runs a handful of commands and one verifier; a lead adds a cold start.

### D2. Order: commit the work, check, archive, commit the archive, push, PR

The verifier reads `git diff <base>...HEAD`, so work left in the tree would be invisible to it. Close therefore commits pending work first (through `commit`, which picks files and keeps secrets out), then checks. The archive gets its own commit, limited to `openspec/`, so the PR shows the living-documentation change apart from the code. Push and PR come last because they are the only outward-facing steps; everything before them is local and can be redone.

Alternatives: one commit with work and archive together - lost, the check would run on an incomplete diff, or the archive would precede the check. Committing nothing and leaving the PR to the user (draft 1) - lost, the architecture's close writes a PR and row 9 waits for `close/pr.md`.

### D3. A failing report stops the close; close fixes nothing

On `Verdict: FAIL` (or no report) close stops before the archive and reports the report path, the `Must address` IDs, and that the fix goes to the side the report names; `/bdk:close <change>` runs again after the fix, and the same verifier logic carries the IDs over. Close never edits a delta, a main spec or code.

Why: close runs after review. A code fix at this point is new code without review: it belongs to `/bdk:execute` and a review round on its scope (#200, #201). A spec fix by close's main thread is the conversation that built the Change rewriting its own documentation to pass its own check, which is what moving the check to `bdk:verifier` was meant to prevent; the spec author is `design-draft` (#190, #198). `/bdk:run` (#203) routes a failed close inside a run. This narrows #196's design remark that close "owns that loop": close owns the stop and the hand-off, not the fix.

Alternatives: close fixes spec-side items itself and re-checks - lost, author and orchestrator in one block, and self-confirmation of the Change's account. Close calls `design-draft` for spec-side items - lost for now, `design-draft`'s fix mode reads `design/verify-N.md`, not the close report; adding a mode is #198/#203 ground and no measurement asks for it yet. A retry budget inside close - lost, without a fixer a retry checks the same code.

### D4. Base branch and branch

Base: `--base`, else `origin/HEAD`, else `main` - the rule `spec-conformance` and `review-integration` already use, so the verifier and the PR agree on the base. `/bdk:run` passes `--base` with the branch it started on (D9's "base branch the run started on"); run.json has no base field today, and adding one is #203's call.

When close finds itself on the base branch (or a detached `HEAD`), it creates the branch `<change>` at `HEAD` before its first commit. It never moves the base branch back: commits an earlier stage made on the local base stay there, and the PR, which compares against the remote base, still holds them. Resetting the base would destroy work and is not close's to do.

The verifier diffs against `origin/<base>` when it exists: the pull request compares with the remote base, and a local base that already holds the Change's commits would give an empty diff (measured: the close from `main` below). A branch `<change>` that exists already stops the close, because switching to it or reusing its name would mix two lines of work.

Alternatives: refuse to close on the base branch - lost, a user who worked on `main` locally would have no way to close. Read the base from `gh repo view` - lost, a network call for what `origin/HEAD` already says, and it fails offline.

### D5. Stage check only through `run.json`

With a run file that queues the Change, close asks `bdk run status --json` and stops when the stage is earlier than close, naming that stage's command; at `done` it only reports the recorded PR. Without a run file the typed command is the consent: a user may close a Change made by hand, without a review round, and the PR body then says "no review round ran".

Alternatives: reimplement the review checks (open blockers, `fix` decisions) in the skill - lost, `bdk run status` owns that derivation and needs `run.json`. Refuse without a run - lost, the manual commands must work alone.

### D6. Resume and the close record

Close starts at its first missing step: archived Change - skip check and archive; uncommitted changes under `openspec/` - commit them; open PR of the branch - reuse it. A Change not archived is checked again even after a passing report, because the code may have changed since; the cost is one verifier pass (about 45 s and $0.44, #196 measurements).

`close/pr.md` (first lines `PR:`, `Base:`, `Branch:`, then the body) is written last, after the PR exists, because `bdk run status` reads its existence as "PR opened". The body is written first to `close/pr-body.md` and passed with `--body-file`, so a body with quotes or newlines never goes through a shell argument. Both files are under `.bdk/runs/`, outside git (setup ignores it), so the archive commit holds only the Change and the specs - the 570-file problem of B1 does not return.

Alternatives: write `pr.md` before `gh pr create` and use it as the body file - lost, a failed `gh` would leave the Change looking done. Skip the check when a report passes - lost, a stale PASS could archive specs the code no longer matches.

### D7. The PR body

What the Change does (from `proposal.md`), `Resolves #<n>` when the issue is known (run.json `issue`, else the issue the proposal's first line under Why names), the capabilities whose main specs changed, the spec-conformance verdict, the E2E verdict, the review rounds, and every decision taken without the user. Closing keywords fire only into a default branch; `Resolves #n` is still the right link for the reader, and a base that is not the default is the user's to link.

Why: the PR is where the user reviews an autopilot run; the architecture's run report promises "PRs and every decision taken without the user", and the PR is the durable place for both. Alternatives: a fixed template file in the plugin - lost, a list of what to include is enough and the model fills it from the run files.

### D8. Eval: two orchestrator cases on one fixture with a local remote

The shared fixture `fixtures/tally-reviewed.sh` builds on `tally-change.sh` (Change `add-total` on its branch, code conforming): a bare repository `.git/bdk-eval/remote.git` as `origin` with `main` pushed and `origin/HEAD` set, a passing review round (`review/round-1/report.md`, an empty `findings.jsonl`), an E2E `Verdict: PASS` with its scenario files, and the `gh` stand-in copied to `.git/bdk-eval/bin/gh`. A run reaches the remote through the file system inside its workspace, so `git push` works offline.

| Case | Scaffold on top | Graders |
|---|---|---|
| `close-reviewed-change` | nothing | `tool_order` Skill close before verifier Agent; `regex` trace: verifier Agent, then `openspec archive`, then `gh pr create`; `file_exists` `close/spec-conformance.md`, `close/pr.md`, the archived `proposal.md`, `.git/bdk-eval/prs/1.json`; `regex` on the PR file: base `main`, head `add-total`, a body naming `tally` and `PASS`; `regex` on `close/pr.md`: its first three lines; `regex` on the remote's `refs/heads/add-total`; `regex` trace: no `git push --force`; `llm` reply names the PR URL; `tool_used` Skill close |
| `close-conformance-fail` | `tally total` exits 1 on an empty ledger, committed | `tool_order` Skill close before verifier Agent; `file_exists` `close/spec-conformance.md`; `regex` on the report: `Verdict: FAIL`; `regex` trace: no `openspec archive`, no `gh pr create` or `git push`; `regex` on the final result: the report path and `M1`; `tool_used` Skill close |

Orchestrator cases run with `--ablation none` (spec `skill-evals`); the acceptance signal is that they pass.

The stand-in learns `gh pr create` and `gh pr view` (spec `skill-evals`), the commands close runs; its tests in `plugins/bdk/tests/evals.test.ts` come first. This is eval infrastructure, not a CLI helper of the product: a run has no GitHub credential.

### D9. No CLI helper

Every step is one existing command, one block, or one Write. No measurement asks for a helper; the acceptance runs below record what the skill text had to answer.

## Risks / Trade-offs

- [The `commit` skill splits pending work into several commits, or picks files the user meant to keep out] -> it reports what it left out; close passes it the scope (the work of the Change, then `openspec/` only), and the user reviews the PR.
- [A FAIL stops autopilot at close with no automatic fix] -> deliberate (D3); the reply names the side and the next command, and `/bdk:run` (#203) routes it.
- [Base branch guessed wrong when `origin/HEAD` is unset and the default is not `main`] -> `--base` overrides; `/bdk:run` passes it; the base is named in the reply and in `pr.md`.
- [Pushing is outward-facing] -> the typed `/bdk:close` or the run that reached close is the consent; close never force-pushes and never merges.
- [Assumption: earlier stages commit their code (execute merges parts back)] -> close commits leftovers itself before the check, so a manual flow with uncommitted work still closes correctly.
- [Cost: one opus verifier pass per close, repeated on resume before archive] -> about $0.44 per pass (#196); skipped once archived.

## Measurements

Acceptance runs (`claude -p "/bdk:close add-total" --plugin-dir plugins/bdk --permission-mode auto`, Claude Code 2.1.292, projects scaffolded from the cases in a scratch directory outside this repository, the `gh` stand-in first on `PATH`):

| Project | Outcome | Turns | Time | Cost |
|---|---|---|---|---|
| reviewed | `Verdict: PASS`; one commit `chore(openspec): archive add-total change`; `add-total` pushed to the bare remote; PR 1 into `main` with title `feat: tally total`; `close/pr.md` with `PR:`, `Base:`, `Branch:` and the body (capability `tally`, both verdicts, 1 review round, no decisions) | 27 | 98 s | $0.66 |
| contradicted | `Verdict: FAIL`, M1 (Empty ledger, either side) and M2 (refusal undocumented); Change not archived, no push, no PR | 9 | 57 s | $0.48 |
| reviewed, no `origin` | archived and committed (`docs: archive add-total change into tally spec`), push error quoted, no `pr.md` | 19 | 87 s | $0.55 |
| same, `origin` restored | no verifier, no archive: push and PR 1 only | 15 | 51 s | $0.36 |
| closed, with `run.json` | `bdk run status` says `done`; close replies with the recorded PR and runs nothing | 8 | 22 s | $0.24 |
| on `main` holding the Change's commits, no branch `add-total` | branch `add-total` created at `HEAD`, archived, pushed, PR 1 into `main`; the verifier, given local `main` as base, saw an empty diff and passed on the code it read (fixed afterwards: `origin/<base>` is the diff base) | 30 | 152 s | $0.73 |
| same, after the fix | verifier started with `--base origin/main`, diff `bin/tally.js` +5 -1, `Verdict: PASS` from the code; PR 1 into `main` | 32 | 121 s | $0.68 |
| on `main`, branch `add-total` exists | stops, names the branch, changes nothing | 6 | 13 s | $0.24 |
| `run.json`, no review round | stops at stage `auto-review` naming `/bdk:auto-review add-total`, runs nothing | 7 | 18 s | $0.06 |

`bdk run status` on the closed project reported row 9 step `pr` without `close/pr.md` and `done` with it.

One observation, not acted on: the PR body ended with Claude Code's own PR attribution line. That line comes from the host's attribution setting, which is the user's to configure; the `commit` skill already keeps such trailers out of commits unless the project uses them.

Eval suite, `--ablation none --runs 3`, Claude Code 2.1.292 (clean `HOME`, `CLAUDE_CODE_SHELL_PREFIX` per "Host limits"):

| Case | Score | Pass | Cost |
|---|---|---|---|
| `close-reviewed-change` | 1.00 | 3 of 3 | $1.54 |
| `close-conformance-fail` | 1.00 | 3 of 3 | $1.12 |

112 s wall time with `-j 6`, on the final skill text (after the `origin/<base>` diff base). Problems the eval showed, and their fixes:

- On a Mac without Homebrew git, `git push` to the local remote failed in the sandbox: `git-receive-pack`, and the `git` that `pack-objects` and the receiving side start by name, resolved to the `xcrun` shim. The fixture sets `remote.origin.receivepack` to the real binary, and `macos-git-prefix.sh`, copied as `bin/git` next to itself, puts the real `git` first on `PATH` for the processes git starts.
- A `tool_order` grader on Bash calls cannot load under the free check's grants (`Write Edit`), so the order verifier, archive, PR is one `regex` on the trace.
- A `no --force` grader matched the skill text in the trace; it now matches only a `command`.
- The `llm` rubric of the failing case split (2 of 3 runs FAIL) on correct replies that state the stop by negation ("nothing was archived"); a `regex` on the final result (report path and `M1`) replaced it.

None of these asked for a change to the skill or a CLI helper (D9).

## Open Questions

None.
