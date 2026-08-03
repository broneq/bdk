---
name: refine-rules
description: Compact and verify .claude/rules/*.md documentation against the real codebase — strips changelog/history/narration, verifies every checkable claim against current code instead of trusting prior wording, and rewrites every rule file into one uniform format. Use when the user asks to "clean up rules", "compact/refine .claude/rules", "audit our rule docs", says rule files are stale, bloated, or inconsistent, or after many sessions/agents have accreted conflicting or narrative content into .claude/rules/.
model: sonnet
user-invocable: true
disable-model-invocation: true
argument-hint: "[rules-dir]"
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

Skip any file whose frontmatter or header explicitly marks it as auto-generated — treat
those like `CHANGELOG.md`, never rewrite them.

### 2. Classify Content: Rule vs. Noise

Read `references/uniform-rule-format.md`, specifically the "What is a rule vs. what is
noise" table — it defines the criteria and gives worked before/after examples. For each
file, go bullet-by-bullet (or paragraph-by-paragraph for prose sections) and tag each as:

- **RULE** — a present-tense, falsifiable claim about the code
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

### 4. Rewrite Into Uniform Format

Use `references/uniform-rule-format.md` as the template for every file: same bullet
shape (`**bold falsifiable claim.** why it matters`), same tone, `paths:` frontmatter
preserved verbatim. Converge ALL files onto this one shape — including files that were
already reasonably well-written — so the whole directory reads as one voice instead of
one style per author.

### 5. Present the Plan, Get Approval

Rewriting hand-maintained docs is destructive to whatever the user or prior agents
wrote — confirm before touching disk. Use a single `AskUserQuestion` call listing, per
file:

```
<file>: KEEP unchanged / COMPACTED (N noise lines removed) /
        CONTRADICTED (N claims removed, with evidence) /
        FLAGGED (N unverified claims to confirm) / REFORMATTED (structure only)
```

Options: "Approve" / "Approve with changes" / "Cancel". For CONTRADICTED items, show
the evidence (file:line or a short quote from the source) so the user can check your
verdict rather than just trust it — the whole point of this skill is not asking anyone
to trust unverified claims, including yours.

Only proceed to Step 6 after approval. On "Approve with changes", incorporate the
feedback before writing.

### 6. Write

Overwrite each rule file in place. Preserve `paths:` frontmatter exactly — it's
functional metadata read by the drift-detection hook, not prose. Before writing, check
`git status` on the target directory; if it's not clean or not tracked, tell the user
and suggest committing first so the rewrite stays trivially reversible.

### 7. Report

Summarize: files touched, total noise lines removed, claims contradicted (one-line
evidence each), claims flagged unverified for follow-up.

## Resources

### references/uniform-rule-format.md

Template, the rule-vs-noise table, and a full before/after worked example. Skim it
before Step 2 for noise calibration; use it directly while rewriting in Step 4.

## Quick Reference

### Checklist

- [ ] Ran discovery script, got file list + frontmatter + headings
- [ ] Classified every bullet/paragraph as RULE or NOISE
- [ ] Split checkable vs. non-checkable claims
- [ ] Verified checkable claims against real code (subagents for large scope), skeptical default
- [ ] Rewrote all files into the uniform bullet format, frontmatter preserved
- [ ] Presented plan via single AskUserQuestion, got approval
- [ ] Checked git status / suggested a commit before writing if uncommitted
- [ ] Wrote files, reported noise/contradiction/flag counts
