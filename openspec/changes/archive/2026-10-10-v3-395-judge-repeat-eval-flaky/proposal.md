# Proposal

## Why

Tracks #395. On 2026-10-10 one of 3 runs of `judge-previous-repeat` failed its `no-denied-call` grader while the other `judge-*` cases passed it in 18 runs; the aggregate keeps no trace, so the denied call was unknown. 52 further runs of the case (Claude Code 2.1.296, clean `HOME`, `--model sonnet --ablation none`, `-j 6` to `-j 8`) and 60 runs of the other `judge-*` cases did not reproduce it, and none of the 164 `findings level` calls in their traces was denied.

A direct probe found the one denial mode that the #376 rule leaves open: `claude -p` with the grant `Bash(*/bin/bdk *)` denies `"<root>/bin/bdk" ... "uses `amt` in code"` ("requires approval for `amt`: the backticks inside the double quotes are command substitution") and `"... $5 and $(date)"` ("A variable in this command can't be checked before it runs"), although the command starts with `bdk`. Plain parentheses, `<`, `>` and an apostrophe inside the quotes pass. The findings the judge reads quote code in backticks (the seeded evidence of `judge-previous-repeat` holds `parseEntries('2026-01-05,rent,7')`), and the judge's `--reason` is free text, so it sometimes copies a backtick into it. `review-group` even gives an evidence example with backticks. The skill text forbids shell variables but not substitution characters in the quoted text.

## What Changes

- `judge`, `review-group`, `review-integration`, `triage`: the free text of `--summary`, `--evidence` and `--reason` holds no backtick, `$` or backslash (the sentence sits next to the whole-command rule of #376). The `review-group` evidence example loses its backticks.
- Eval case `judge-previous-repeat`: the later finding's evidence quotes code in backticks too, so a judge that copies the quoting into `--reason` is denied and the grader shows it.
- `plugins/bdk/evals/README.md`: the probe, the runs and the host limit.

## Capabilities

### New Capabilities

### Modified Capabilities
- `review-blocks`: the requirement "Single-command bdk calls in the review blocks" also covers the text of a quoted argument.
- `triage-block`: the requirement "Single-command bdk calls in triage" the same.

## Impact

- `plugins/bdk/skills/{judge,review-group,review-integration,triage}/SKILL.md`, `plugins/bdk/evals/judge-previous-repeat/scaffold.sh`, `plugins/bdk/evals/README.md`; specs `review-blocks`, `triage-block`.
- Docs: no skill description, flow, command, settings key or file changes, so no Guide or Concepts page changes and no diagram is redrawn; `pnpm docs:reference` reports the Reference up to date. `Docs-impact: none - skill body wording only.`
