---
name: refine-rules
description: Compact and verify .claude/rules/*.md against real code — admission test, relocation into doc comments, budgets, uniform format. Use on "clean up rules", "refine .claude/rules", or stale/bloated rule files.
model: sonnet
user-invocable: true
disable-model-invocation: true
argument-hint: "[rules-dir]"
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

# Refine Rules

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

Rewrite `.claude/rules/` (or the directory at `$ARGUMENTS`) into rule files that describe
only the current, verified state of the code — no history, no changelog, no guesses —
in one uniform voice across every file.

The core problem this solves: rule files in a long-lived project were written by
whichever agent or engineer was in the seat on a given day, across many sessions, often
under time pressure. Wording accumulates — some of it stays true, some goes stale the
moment the code it described changed, and some was never verified in the first place.
Treat every existing sentence as an **unverified claim**, not a fact. Prior wording earns
no trust just by being there; it earns trust by matching the code you actually read.

## Workflow

### 1. Discover Rule Files

Run the discovery script instead of hand-parsing with Read/Glob:

```
python3 ${CLAUDE_SKILL_DIR}/scripts/list_rule_files.py $ARGUMENTS
```

Defaults to `.claude/rules` when no argument is given. Returns, per file: `frontmatter_paths`
(the `paths:` glob list, if any), `headings`, `line_count`, `char_count`.

Then run the mechanical linter for a budget/narrative baseline (same argument handling):

```
python3 ${CLAUDE_SKILL_DIR}/scripts/lint_rules.py $ARGUMENTS
```

Its findings (over-budget files, narrative-marker lines) tell you where the worst
accretion is before you read a single file. `_inbox.md` is exempt by design — it stages
uncurated candidates.

Skip any file whose frontmatter or header explicitly marks it as auto-generated — treat
those like `CHANGELOG.md`, never rewrite them.

### 2. Classify Content: Verdict per Bullet

Read `references/rule-admission.md` (the admission test — decision / visibility /
derivability) and `references/uniform-rule-format.md` (the "What is a rule vs. what is
noise" table with worked examples). For each file, go bullet-by-bullet (or
paragraph-by-paragraph for prose sections) and tag each with one of four verdicts:

- **RULE** — a present-tense, falsifiable claim that passes all three admission tests
- **SIGNPOST** — a true constraint a test/lint already enforces — compress to one line
  naming the enforcer
- **RELOCATE** — true and valuable but pull-based (the trap is visible at the code
  site): API/protocol description, single-file subtleties, design history worth
  keeping — belongs in a doc comment at the code site, with at most a one-line pointer
  left in the rule file
- **NOISE** — changelog/history/narration/hedged guess/TODO — drop these outright, no
  matter how confidently the original file phrased them

This is a fast text-judgment pass — do it in main context, no code access needed yet.

### 3. Verify Every Surviving RULE Claim Against Real Code

This is the step that makes the output trustworthy. Do not skip it because a claim
"sounds right" — that's exactly the failure mode this skill exists to catch.

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json`

**3.1 — Split checkable vs. non-checkable claims.**

- **Checkable** (has ground truth in the repo): file/dir locations, exports, config
  settings, exclusion lists, banned/required API patterns, index names, version pins,
  "X calls Y" relationships.
- **Non-checkable** (process/preference statements): "ask before assuming",
  "prefer composition over inheritance", team workflow conventions. Grep can't confirm
  or refute a preference — don't force verification on these, just sanity-check they
  still make sense given what step 1–2 surfaced.

**3.2 — Dispatch verification.**

For each rule file with `paths:` frontmatter, scope the search to those globs — that's
the surface the rule claims to govern. For files with many checkable claims or broad
path scope, dispatch to one or more `Explore`-type subagents rather than verifying
serially in the main context — verification means reading real source across
potentially many files, and doing that inline for every rule file burns context fast.
Small rule sets (a handful of files, a few claims each) can be verified inline instead.

Brief each subagent explicitly to default to skepticism: a claim is CONFIRMED only with
positive evidence found in code. Otherwise it's CONTRADICTED (found evidence it's
false) or UNVERIFIED (no evidence either way — e.g. the code is too dynamic to grep, or
the claim describes intent rather than a checkable artifact).

**3.3 — Resolve each verdict.**

| Verdict | Action |
|---|---|
| CONFIRMED | Keep, rewrite into uniform format (Step 4) |
| CONTRADICTED | Drop — or correct, only if you have positive evidence of the replacement; never invent one |
| UNVERIFIED | Keep, but flag it in the plan (Step 5) for the user to confirm |
| NOISE (from Step 2) | Drop, regardless of verdict — noise doesn't get verified, it gets removed |

RELOCATE and SIGNPOST candidates from Step 2 go through the same verification (a claim
must be true before it earns a doc comment; an "Enforced by" clause must name a test
that exists).

### 4. Rewrite Into Uniform Format

Use `references/uniform-rule-format.md` as the template for every file: same bullet
shape (`**bold falsifiable claim.** why it matters`), same tone, `paths:` frontmatter
preserved verbatim. Converge ALL files onto this one shape — including files that were
already reasonably well-written — so the whole directory reads as one voice instead of
one style per author.

Apply the structure and budgets from `references/rule-admission.md`:

- Each file opens with `## Critical Invariants` — the 3–6 constraints whose violation
  means data loss, divergence, or silent corruption.
- File budget 150 lines / 8 KB, bullet budget ~5 lines. If genuinely all RULE-grade
  content still exceeds the budget, plan a split into narrower `paths:` scopes rather
  than accepting the overage.
- For each RELOCATE item, draft the doc comment (target file, insertion point, text)
  alongside the rule-file rewrite — relocation happens in the SAME change set, move
  first, cut second. Match the target file's existing comment style.

### 5. Present the Plan, Get Approval

Rewriting hand-maintained docs is destructive to whatever the user or prior agents
wrote — confirm before touching disk. Use a single `AskUserQuestion` call listing, per
file:

```
<file>: KEEP unchanged / COMPACTED (N noise lines removed) /
        RELOCATED (N items → doc comments, with target files) /
        SIGNPOSTED (N bullets compressed to enforcer pointers) /
        CONTRADICTED (N claims removed, with evidence) /
        FLAGGED (N unverified claims to confirm) / REFORMATTED (structure only)
```

RELOCATED items modify source files, not just rule files — list every target file in
the plan so the user sees the full blast radius before approving.

Options: "Approve" / "Approve with changes" / "Cancel". For CONTRADICTED items, show
the evidence (file:line or a short quote from the source) so the user can check your
verdict rather than just trust it — the whole point of this skill is not asking anyone
to trust unverified claims, including yours.

Only proceed to Step 6 after approval. On "Approve with changes", incorporate the
feedback before writing.

### 6. Write

Order matters: **write the RELOCATE doc comments into their target source files first,
then overwrite the rule files** — cutting before relocating destroys knowledge if the
run is interrupted. Preserve `paths:` frontmatter exactly — it's functional metadata
read by the drift-detection hook, not prose. Before writing, check `git status` on the
target directory; if it's not clean or not tracked, tell the user and suggest
committing first so the rewrite stays trivially reversible.

### 7. Lint Gate & Report

Re-run the linter over the rewritten directory:

```
python3 ${CLAUDE_SKILL_DIR}/scripts/lint_rules.py $ARGUMENTS
```

Zero errors is the exit criterion — a remaining budget error means Step 4 under-planned
a split; a remaining narrative marker means a NOISE item slipped through. Fix and
re-lint; never ship a rewrite that fails its own contract.

Then summarize: files touched, total noise lines removed, items relocated (target file
each), claims contradicted (one-line evidence each), claims flagged unverified for
follow-up, final lint status.

## Resources

### references/rule-admission.md

What belongs in a rule file at all: push vs. pull, the three-part admission test, the
four verdicts (RULE/SIGNPOST/RELOCATE/NOISE), where each kind of knowledge lives, and
the file/bullet budgets. Read before Step 2.

### references/uniform-rule-format.md

Template, the rule-vs-noise table, and a full before/after worked example. Skim it
before Step 2 for noise calibration; use it directly while rewriting in Step 4.

### scripts/lint_rules.py

Mechanical enforcement of the admission contract: budgets, `paths:` frontmatter,
`## Critical Invariants` presence, narrative markers. Run at discovery (Step 1 baseline)
and as the exit gate (Step 7). Also used standalone by `/bdk:add-rule`.

## Quick Reference

### Checklist

- [ ] Ran discovery script + linter, got file list, budgets, narrative baseline
- [ ] Classified every bullet/paragraph as RULE / SIGNPOST / RELOCATE / NOISE
- [ ] Split checkable vs. non-checkable claims
- [ ] Verified checkable claims against real code (subagents for large scope), skeptical default
- [ ] Rewrote all files: uniform bullets, Critical Invariants section, budgets, frontmatter preserved
- [ ] Drafted doc comments for every RELOCATE item (move first, cut second)
- [ ] Presented plan via single AskUserQuestion — including relocation targets — got approval
- [ ] Checked git status / suggested a commit before writing if uncommitted
- [ ] Wrote doc comments, then rule files; linter exit gate passes with zero errors
- [ ] Reported noise/relocation/contradiction/flag counts + lint status
