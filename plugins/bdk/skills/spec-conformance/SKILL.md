---
name: spec-conformance
description: 'Checks on the bdk:verifier agent that the spec deltas of an OpenSpec Change describe the product after the Change - against the code and the E2E results - and writes close/spec-conformance.md with a PASS or FAIL verdict; with --round it runs as a worker of a review round, writes the round''s report and logs each problem as a finding the review loop fixes. Use when a Change is about to be archived, when /bdk:close checks its specs, when a review round checks the specs, or when asked whether the specs still match what the product does.'
argument-hint: "[<change>] [--base <ref>] [--round <round dir>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git symbolic-ref *) Bash(git rev-parse *) Bash(openspec validate *) Read Grep Glob Write Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Spec conformance

`openspec archive` copies a Change's spec deltas into the main specs, the living documentation of the product. Check that every delta is true of the product after the Change, and that nothing a user can observe is missing from them. You read and report; you never fix the spec or the code, and you never run the product, its tests or a command that writes a project file. `openspec validate` only reads.

When the block above says `BDK not configured` or `BDK configuration invalid`, reply with that line and stop: write nothing. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 0. Run as `bdk:verifier`

This block runs on the `bdk:verifier` agent, whose instructions start with "You are `bdk:verifier`". The conversation that built the Change must not judge its own specs. When you are not that agent (a user typed the command, or `/bdk:close` invoked the skill in the main thread), do not check anything yourself: start the agent with the Agent tool in the foreground (`run_in_background: false`), `subagent_type: "bdk:verifier"`, prompt `Run the skill bdk:spec-conformance with the arguments: <the arguments above>`, `model` set to `models.verifier.model` and `effort` set to `models.verifier.effort`, each only when the configuration above sets it; wait for it, reply with its verdict line and report path, and stop. Keep its agent ID: after a fix, `SendMessage` to the same agent checks again.

Done when you are `bdk:verifier`, or the agent has answered.

## 1. Find the Change, the base and the report

- Change: the first argument. Without one, take the only directory under `openspec/changes/` other than `archive/`; with none or several, name what you found and stop.
- Base: `--base <ref>` when given; else the branch `git symbolic-ref --short refs/remotes/origin/HEAD` names; else `main`.
- Round: `--round <round dir>` when given (a review round's lead passes it, `.bdk/runs/<change>/review/round-<N>`). It makes this a **round check**: the same check, run while the review loop can still fix what it finds, so close does not stop on it later. Its log is `<round dir>/findings.jsonl`.
- Report: `<round dir>/spec-conformance.md` in a round check; else `.bdk/runs/<change>/close/spec-conformance.md`. At close, when the report exists, read it first: its open IDs carry over (step 4). A round check starts a fresh report: the round's findings log carries what is open across rounds.

Done when you know the Change, the base, the round if any, and whether an earlier close report exists.

## 2. Read

1. `proposal.md` of the Change: the intent, used to say which side of a disagreement it supports.
2. Every `openspec/changes/<change>/specs/**/spec.md`. Note each requirement under `## ADDED`, `## MODIFIED`, `## REMOVED` and `## RENAMED Requirements`, and each `#### Scenario:` with its file, heading line, WHEN and THEN.
3. For each capability a delta modifies, removes or renames, its main spec `openspec/specs/<capability>/spec.md`: archive applies the delta to it, and the result is what must be right.
4. The code: `git diff --stat <base>...HEAD`, then the changed files and every file a scenario runs through from its entry point (a command's dispatch, a route, a page, a configuration loader).
5. The latest E2E results, when there are any (skip this in a round check: the round's E2E tester runs after you and logs its own failures): of `.bdk/runs/<change>/e2e/verdict.md` and `.bdk/runs/<change>/review/round-*/e2e/verdict.md`, the file modified last (Glob lists the newest first); read its verdict and every path file next to it (`<process>--<path>.md`) whose first line is not `Result: pass`.

6. In a round check, `design.md` of the Change, as intent only: it says where a fix goes (step 5), never what the code does.

Judge from the code and the E2E results only. What `design.md`, a plan part or a commit message says the code does is a claim, not evidence.

Done when every scenario of the deltas is on your list and you know the files that implement them.

## 3. Check

First run `openspec validate <change> --strict`, on its own, in every run, round check or close. It reports what `openspec archive` would refuse: each `✗ [ERROR]` line it prints (with exit 1) names a delta file and a requirement, such as `tally/spec.md: ADDED "Bad amount" must include at least one scenario`. Keep each error line for problem 7; `Change '<change>' is valid` goes to `Checked`. A command that does not run (not found, denied) is not a problem of the deltas: follow your agent instructions for a failed command.

For each scenario of an added or modified requirement, take its own WHEN, follow it from the entry point through the code, and compute the THEN value by value: the text printed, the exit code, the status and body, what the page shows, the file written. The question is whether the sentence is true of the product, not whether the code is good.

Then read each requirement's own text. A SHALL sentence promises every input it names, and a scenario shows only one example: when a requirement says "a path absolute or relative to the current directory" and its scenario uses `books/2026.json`, compute the absolute case too (`/tmp/ledger.json` joined to the current directory is `<cwd>/tmp/ledger.json`). Do the same for each class the sentence names: absolute and relative, empty and missing, one and many, "any" or "every" command.

These seven problems make the main specs wrong after archive, or stop archive. Each one is a `Must address` item:

1. **Contradicted scenario or requirement.** The code does not produce the THEN for the WHEN, no entry point reaches the scenario, or the code breaks a SHALL sentence for an input it names.
2. **E2E failure** (not in a round check). An E2E path file starts with `Result: fail`: the product breaks a promise of the proposal that the deltas are about to document. The item names the proposal line of its `Proposal:` line instead of a spec location.
3. **Removed but present.** A removed requirement's behaviour is still in the product.
4. **Dropped scenario.** A modified requirement leaves out a scenario of its main-spec version while the product still behaves that way: archive replaces the whole requirement, so that behaviour would lose its documentation.
5. **Undocumented behaviour.** The diff adds or changes something a user can observe - a command, an option, an output such as an error message, an exit code, an endpoint, a page, a configuration key - that no delta and no main-spec requirement describes. Internal code (a refactor, a helper, a test) never needs a delta.
6. **Contradiction after merge.** A delta, merged into its main spec, contradicts another requirement there.
7. **Delta OpenSpec refuses.** `openspec validate <change> --strict` reported an error: archive cannot merge the deltas, even when the product does what they say. One item per error line, naming the delta file and the requirement the error names; its `Evidence:` is the command and the error line. In a round check this is as much a `Must address` item as at close.

Everything else you notice goes to `Should consider`: wording a test cannot check, a scenario no user can observe, a class or function name inside a requirement. Not a problem: code quality, test coverage, style; reviews own those.

Done when every scenario has a verdict and the diff's user-visible behaviour is matched to a delta or listed.

## 4. Sort and write

Write the report of step 1 in the report body of your agent instructions:

```markdown
Verdict: FAIL

## Must address
- M1 specs/notes/spec.md "Export" / "Empty notebook": the scenario says `notes export` prints `[]` and exits 0; the code exits 3 when the notebook has no entries. The proposal asks for an empty export, so the code is the side that disagrees.
  Evidence: src/export.js:18 `if (entries.length === 0) process.exit(3)`
- M2 no delta describes `notes export --gzip`, which this Change adds (src/cli.js:41).
  Evidence: src/cli.js:41 parses `--gzip`; no requirement names it

## Should consider
- S1 specs/notes/spec.md "Export": the requirement names the function `serializeNotes`; a reader of the spec needs the command only.

## Checked
- "Export" / "Two notes": src/export.js:12 prints both notes as a JSON array, exit 0.
- E2E: `Verdict: PASS`, 2 processes, 7 paths (review/round-1/e2e/verdict.md).
- `openspec validate add-total --strict`: valid.
```

- Each `Must address` item names the spec location (file, requirement, scenario), what the spec says, what the product does, and, when the proposal settles it, which side disagrees with the intent. Its `Evidence:` line is a file and line with what the code does there, the E2E path file, or the `openspec validate` command with its error line.
- `Checked` lists each scenario that holds, with where it holds, and states the E2E input: the verdict read with the path of its file under `.bdk/runs/<change>/`, or `no E2E results` when no E2E verdict exists (a `SKIPPED` or `BLOCKED` verdict is stated the same way); in a round check, `E2E: not read (round check)`. It also states the validation: `openspec validate <change> --strict: valid` when it reported no error.
- `Verdict: FAIL` if and only if `Must address` holds an item. An empty section holds `- None.`
- IDs: at close, when step 1 found an earlier report, keep the ID of every problem still open, give a new problem the next unused number, and put `Closed: <IDs>` (or `Closed: none`) on the line under the verdict. Then replace the file: there is one report per Change, read by `bdk run status`. A first report has no `Closed:` line.

Change no other file; a round check also appends to its log (step 5).

Done when the report exists and its first line is the verdict.

## 5. Log the findings (round check only)

Skip this step at close. In a round check, the round's judge, triage and fix planning act only on what is in the log, so append one finding per `Must address` item, each command on its own:

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings add <round dir>/findings.jsonl --source spec-conformance --file <path> --line <n> --summary "<one line: what is wrong>" --evidence "<the item's ID (M1), its spec location, what the spec says, what the product does, and which side the proposal supports>"
```

`--file` is repository-relative. `--file` and `--line` are where the fix goes, because the fix planner plans a change there:

- The code breaks what the proposal asks for (a contradicted scenario, a broken requirement sentence, behaviour that is still there, behaviour the proposal does not ask for): the code line, as in the item's `Evidence:`.
- The delta misses or misstates behaviour the proposal or the design settles, and neither contradicts (an undocumented error message the design gives every command, a dropped scenario): the spec delta file of the capability, at the requirement it belongs to, else the line of its first `## ... Requirements` heading, else line 1 of the proposal.
- A contradiction after merge with the main spec: the delta.
- A delta OpenSpec refuses: the delta file the error names, at the heading of the requirement it names (else its first `## ... Requirements` heading); the fix is a delta edit, such as a scenario under that requirement, checked against the code like any other.
- The proposal settles neither side: the delta, and say so in the evidence; the fix planner leaves it to the user.

Then run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings list <round dir>/findings.jsonl` and check that each item has its finding with the source `spec-conformance`.

Done when every `Must address` item is in the log.

## 6. Reply

Reply with three lines at most: the verdict line, the report path, and the `Must address` IDs (in a round check, the ids of the findings you added).

At close, when continued after a fix, go back to step 1: read the report you wrote, check again, and replace it with the next one.
