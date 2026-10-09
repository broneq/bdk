---
name: spec-conformance
description: 'Checks on the bdk:verifier agent that the spec deltas of an OpenSpec Change describe the product after the Change - against the code and the E2E results - and writes the run file close/spec-conformance.md with a PASS or FAIL verdict. Use when a Change is about to be archived, when /bdk:close checks its specs, or when asked whether the specs still match what the product does.'
argument-hint: "[<change>] [--base <ref>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git symbolic-ref *) Bash(git rev-parse *) Read Grep Glob Write Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Spec conformance

`openspec archive` copies a Change's spec deltas into the main specs, the living documentation of the product. Check that every delta is true of the product after the Change, and that nothing a user can observe is missing from them. You read and report; you never fix the spec or the code, and you never run the product, its tests or a command that writes.

When the block above says `BDK not configured` or `BDK configuration invalid`, reply with that line and stop: write nothing. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 0. Run as `bdk:verifier`

This block runs on the `bdk:verifier` agent, whose instructions start with "You are `bdk:verifier`". The conversation that built the Change must not judge its own specs. When you are not that agent (a user typed the command, or `/bdk:close` invoked the skill in the main thread), do not check anything yourself: start the agent with the Agent tool, `subagent_type: "bdk:verifier"`, prompt `Run the skill bdk:spec-conformance with the arguments: <the arguments above>`, and `model` set to `models.verifier` when the configuration above sets it; wait for it, reply with its verdict line and report path, and stop. Keep its agent ID: after a fix, `SendMessage` to the same agent checks again.

Done when you are `bdk:verifier`, or the agent has answered.

## 1. Find the Change, the base and the report

- Change: the first argument. Without one, take the only directory under `openspec/changes/` other than `archive/`; with none or several, name what you found and stop.
- Base: `--base <ref>` when given; else the branch `git symbolic-ref --short refs/remotes/origin/HEAD` names; else `main`.
- Report: `.bdk/runs/<change>/close/spec-conformance.md`. When it exists, read it first: its open IDs carry over (step 5).

Done when you know the Change, the base and whether an earlier report exists.

## 2. Read

1. `proposal.md` of the Change: the intent, used to say which side of a disagreement it supports.
2. Every `openspec/changes/<change>/specs/**/spec.md`. Note each requirement under `## ADDED`, `## MODIFIED`, `## REMOVED` and `## RENAMED Requirements`, and each `#### Scenario:` with its file, heading line, WHEN and THEN.
3. For each capability a delta modifies, removes or renames, its main spec `openspec/specs/<capability>/spec.md`: archive applies the delta to it, and the result is what must be right.
4. The code: `git diff --stat <base>...HEAD`, then the changed files and every file a scenario runs through from its entry point (a command's dispatch, a route, a page, a configuration loader).
5. The latest E2E results, when there are any: of `.bdk/runs/<change>/e2e/verdict.md` and `.bdk/runs/<change>/review/round-*/e2e/verdict.md`, the file modified last (Glob lists the newest first); read its verdict and every scenario file next to it whose first line is not `Result: pass`.

Judge from the code and the E2E results only. What `design.md`, a plan part or a commit message says the code does is a claim, not evidence.

Done when every scenario of the deltas is on your list and you know the files that implement them.

## 3. Check

For each scenario of an added or modified requirement, take its own WHEN, follow it from the entry point through the code, and compute the THEN value by value: the text printed, the exit code, the status and body, what the page shows, the file written. The question is whether the sentence is true of the product, not whether the code is good.

These six problems make the main specs wrong after archive. Each one is a `Must address` item:

1. **Contradicted scenario.** The code does not produce the THEN for the WHEN, or no entry point reaches the scenario.
2. **E2E failure.** An E2E scenario file starts with `Result: fail`.
3. **Removed but present.** A removed requirement's behaviour is still in the product.
4. **Dropped scenario.** A modified requirement leaves out a scenario of its main-spec version while the product still behaves that way: archive replaces the whole requirement, so that behaviour would lose its documentation.
5. **Undocumented behaviour.** The diff adds or changes something a user can observe - a command, an option, an output, an exit code, an endpoint, a page, a configuration key - that no delta and no main-spec requirement describes. Internal code (a refactor, a helper, a test) never needs a delta.
6. **Contradiction after merge.** A delta, merged into its main spec, contradicts another requirement there.

Everything else you notice goes to `Should consider`: wording a test cannot check, a scenario no user can observe, a class or function name inside a requirement. Not a problem: code quality, test coverage, style; reviews own those.

Done when every scenario has a verdict and the diff's user-visible behaviour is matched to a delta or listed.

## 4. Sort and write

Write `.bdk/runs/<change>/close/spec-conformance.md` in the report body of your agent instructions:

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
- E2E: `Verdict: PASS`, 3 scenarios (review/round-1/e2e/verdict.md).
```

- Each `Must address` item names the spec location (file, requirement, scenario), what the spec says, what the product does, and, when the proposal settles it, which side disagrees with the intent. Its `Evidence:` line is a file and line with what the code does there, or the E2E scenario file.
- `Checked` lists each scenario that holds, with where it holds, and states the E2E input: the verdict read with the path of its file under `.bdk/runs/<change>/`, or `no E2E results` when no E2E verdict exists (a `SKIPPED` or `BLOCKED` verdict is stated the same way).
- `Verdict: FAIL` if and only if `Must address` holds an item. An empty section holds `- None.`
- IDs: when step 1 found an earlier report, keep the ID of every problem still open, give a new problem the next unused number, and put `Closed: <IDs>` (or `Closed: none`) on the line under the verdict. Then replace the file: there is one report per Change, read by `bdk run status`. A first report has no `Closed:` line.

Change no other file.

Done when the report exists and its first line is the verdict.

## 5. Reply

Reply with three lines at most: the verdict line, the report path, and the `Must address` IDs.

When continued after a fix, go back to step 1: read the report you wrote, check again, and replace it with the next one.
