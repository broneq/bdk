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

**"Nothing" is a frequent, correct output of this skill.** The worst outcome is not a
badly-routed rule - it is a rule written at all when none was warranted. Reporting
"this is not a rule, and here is why" is a complete, successful run. Never write
something just to have written something.

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
the four-part test (durability / decision / visibility / derivability) to route the
sentence:

| Verdict | Route |
|---|---|
| Passes all four, governs a broad surface | **Rule file** - continue to Step 3 |
| Passes all four, but true only for a narrow subset of files | **Narrow-glob rule file** - a file whose `paths:` names just that subset; create one if none fits - Step 3 |
| Procedural how-to behind an intent no glob expresses, AND a deterministic backstop (guard test / validator / deploy gate) catches a missed invocation, AND near-immutable | **Project skill** - extract it there; the rule file keeps nothing, or a one-line pointer |
| True but pull-based (trap visible at the code site) | **Doc comment** at the code site - Step 5b |
| A test/lint already enforces it | **Signpost** - one line naming the enforcer, only if a rule file section already covers the area; otherwise nothing |
| Fails durability (an inventory, or a line a rename would force you to edit) | **Nothing** - report why and stop |
| Fails the decision test | **Nothing** - report why and stop |

When several destinations fit, prefer in this order:
`narrow glob > wide glob > skill > doc comment > nothing`. Skills fail open and rules
fail closed - never route an ambient constraint to a skill. Never park the content in
`docs/`: content that fails admission goes to a code site or nowhere.

When the lesson warrants a guard test that doesn't exist yet, say so in the final
report — writing that test is separate work the user should schedule, not a silent
side effect of this skill.

### 3. Deduplicate Against Existing Rules

Search `.claude/rules/` for existing coverage of the same constraint (grep for the key
identifiers/terms in the distilled sentence). Per the `## Duplication policy` section of
`rule-admission.md`, one fact has exactly one home. If an existing rule already covers
it:

- **Sharpen that rule in place** (tighten wording, add the missing case) — never append
  a near-duplicate, and never append the newest violation's story to it.
- If the existing rule is in a different file than `paths:` would suggest, leave it
  where it is - one rule lives in one file. If another file genuinely needs the fact,
  it gets a one-line pointer (`see .claude/rules/<file>.md "<section>"`), not a copy.

### 4. Pick the Target and Check the Budget

Choose the **narrowest** `paths:` scope that still covers the code the rule governs. A
file scoped to the two or three globs the rule actually applies to beats appending to
one scoped at the whole directory tree: every session matching the wider glob pays for
a rule that does not apply to it. Creating a narrowly-scoped file is the preferred
outcome, not a last resort. Then check the budget:

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

If you created a new rule file, it MUST open with `paths:` frontmatter naming the narrow
glob set - that frontmatter is functional metadata read by the drift hook, and a file
without it is loaded by every session regardless of relevance.

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
- [ ] Applied the four-part admission test, durability first (would a rename force an
      edit to this line? then it is a code mirror, not a rule)
- [ ] Routed it: narrow-glob rule / wide rule / skill / doc comment / signpost / nothing
- [ ] Searched existing rules; sharpened in place instead of duplicating
- [ ] Picked the narrowest `paths:` scope that covers the code; budget-checked with
      lint_rules.py; wrote `paths:` frontmatter if the file is new
- [ ] Over-budget target → `_inbox.md` + recommended `/bdk:refine-rules`
- [ ] Confirmed via AskUserQuestion before writing
- [ ] Wrote in uniform format (no incident narrative); re-lint shows zero new errors
