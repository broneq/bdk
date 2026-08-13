---
name: add-rule
description: Capture one lesson or convention as a properly-homed rule — routed to .claude/rules/, a doc comment, or a test signpost; dedupes and respects budgets. Use on "add a rule", "capture this as a rule", "remember this convention".
argument-hint: "[lesson or convention to capture]"
model: sonnet
---

# Add Rule

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

Capture ONE lesson as a rule that earns its context cost — or route it somewhere
better. This skill is the write-side counterpart of `/bdk:refine-rules`: refine-rules
cleans up accretion after the fact; add-rule prevents the accretion at the source.

The failure mode this skill exists to stop: post-incident "rules" written as incident
narratives, appended to whichever file is nearest, duplicating rules that already
exist, in files already over budget. That turns `.claude/rules/` into a changelog that
costs context every session and instructs nobody.

## Workflow

### 1. Distill the Rule

From `$ARGUMENTS` (or the conversation context that triggered this), answer:

> **What ONE imperative sentence would have prevented this mistake — or captures this
> convention?**

Write it as a present-tense, falsifiable MUST/NEVER claim. If no such sentence exists —
the incident was a one-off, or the "lesson" is not actionable — say so and stop.
Nothing is the correct output for a non-rule.

Never carry the incident story into the sentence. Record the consequence
("a drift between the two projections loses deletions"), not the narrative
("last Tuesday we noticed...").

### 2. Apply the Admission Test

Read `${CLAUDE_PLUGIN_ROOT}/skills/refine-rules/references/rule-admission.md` and apply
the three-part test (decision / visibility / derivability) to route the sentence:

| Verdict | Route |
|---|---|
| Passes all three | **Rule file** — continue to Step 3 |
| True but pull-based (trap visible at the code site) | **Doc comment** at the code site — Step 5b |
| A test/lint already enforces it | **Signpost** — one line naming the enforcer, only if a rule file section already covers the area; otherwise nothing |
| Fails the decision test | **Nothing** — report why and stop |

When the lesson warrants a guard test that doesn't exist yet, say so in the final
report — writing that test is separate work the user should schedule, not a silent
side effect of this skill.

### 3. Deduplicate Against Existing Rules

Search `.claude/rules/` for existing coverage of the same constraint (grep for the key
identifiers/terms in the distilled sentence). If an existing rule already covers it:

- **Sharpen that rule in place** (tighten wording, add the missing case) — never append
  a near-duplicate, and never append the newest violation's story to it.
- If the existing rule is in a different file than `paths:` would suggest, leave it
  where it is — one rule lives in one file.

### 4. Pick the Target and Check the Budget

Choose the rule file whose `paths:` frontmatter covers the code the rule governs
(create a new, narrowly-scoped file only when no existing file fits). Then check the
budget:

```
python3 ${CLAUDE_PLUGIN_ROOT}/skills/refine-rules/scripts/lint_rules.py .claude/rules/<target>.md
```

- Target under budget → proceed to Step 5.
- Target over budget (`budget:*` errors) → append the candidate to
  `.claude/rules/_inbox.md` instead (one bullet: the sentence + suggested target +
  date-free context), and recommend running `/bdk:refine-rules` — the over-budget file
  has a compaction duty before it may grow.

### 5. Confirm, Then Write

Present one `AskUserQuestion` with the verdict, target location, and the exact text to
be written. Options: "Approve" / "Adjust" / "Cancel". Skip the question only when the
invoking prompt already contained the explicit final text and target.

**5a. Rule file** — write in the uniform format
(`${CLAUDE_PLUGIN_ROOT}/skills/refine-rules/references/uniform-rule-format.md`):

```
- **<Imperative, falsifiable claim>.** <One-clause why, only if the rule otherwise
  looks arbitrary.> <Pointer to the source-of-truth file/test.>
```

Place it under the topical section it belongs to; if it is data-loss/divergence grade,
also add a one-liner to `## Critical Invariants`.

**5b. Doc comment** — write the comment at the code site (the function/module where
the trap lives), matching the file's existing comment style. If a rule file section
covers the same area, a one-line pointer there is optional — add it only when the
comment alone would not be found in time.

### 6. Lint and Report

Re-lint every rule file you touched — zero new errors is the exit criterion:

```
python3 ${CLAUDE_PLUGIN_ROOT}/skills/refine-rules/scripts/lint_rules.py .claude/rules/<touched>.md
```

Report: the distilled sentence, the verdict and why, what was written where (or why
nothing was), and any follow-up (missing guard test, over-budget file awaiting
`/bdk:refine-rules`).

## Quick Reference

### Checklist

- [ ] Distilled ONE imperative, falsifiable sentence (or stopped — non-rule)
- [ ] Applied admission test: rule file / doc comment / signpost / nothing
- [ ] Searched existing rules; sharpened in place instead of duplicating
- [ ] Picked target by `paths:` scope; budget-checked with lint_rules.py
- [ ] Over-budget target → `_inbox.md` + recommended `/bdk:refine-rules`
- [ ] Confirmed via AskUserQuestion before writing
- [ ] Wrote in uniform format (no incident narrative); re-lint shows zero new errors
