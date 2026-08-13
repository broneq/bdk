# Rule Admission — What Belongs in a Rule File at All

`uniform-rule-format.md` defines how a surviving rule is written. This file defines the
harder question: whether a piece of knowledge should live in `.claude/rules/` in the
first place. Content can be perfectly true, verified, and well-formatted — and still be
the wrong thing to inject into every session that touches its `paths:`.

## Push vs. pull

A rule is **push-based** instruction: it must change the agent's decision BEFORE the
agent reads the relevant code. Knowledge the agent will see anyway when it opens the
file it is editing is **pull-based** and belongs elsewhere — a doc comment at the code
site, a type signature, a test, or a design doc. Rule files are paid for at session
start by every task matching their `paths:`; pull-based knowledge is paid for only when
someone actually works on that code.

## Admission test — all three must pass

1. **Decision test.** Without this line, would an agent produce a wrong change? If no —
   it is not a rule.
2. **Visibility test.** Is the trap invisible at the site where the mistake would be
   made? A trap that a doc comment at the code site would surface in time belongs in
   that doc comment. Passes into rules: a semantic trap that can be written in a
   brand-new file far from the code that defines the invariant (no comment can warn in
   time). Fails: a subtlety local to one function, visible in the one file where it
   lives.
3. **Derivability test.** Can the agent infer this from code, types, or a failing test
   within the same task? If a test enforces the constraint, the rule is one line naming
   the test — the test is the enforcer, the rule is a signpost.

## Verdicts

Classify every candidate bullet with one of four verdicts:

| Verdict | Meaning | Action |
|---|---|---|
| **RULE** | Passes all three admission tests | Keep; write per `uniform-rule-format.md` |
| **SIGNPOST** | True constraint, but a test/lint already enforces it | Compress to one line naming the enforcer |
| **RELOCATE** | True and valuable, but pull-based (fails the visibility test) | Move to a doc comment at the code site (or design doc); rule keeps at most a one-line pointer |
| **NOISE** | History, narration, hedges, archaeology | Drop (see the noise table in `uniform-rule-format.md`) |

**RELOCATE ordering is load-bearing:** move the content to its new home FIRST, then cut
it from the rule file. Cutting without relocating destroys knowledge someone paid for —
often with a long debugging session.

## Where knowledge lives

| Knowledge | Home |
|---|---|
| Cross-file invariant; trap invisible at the error site | `.claude/rules/` |
| How a module/function works (API, protocol, shapes) | doc comment at the code site |
| Why a design was chosen; rejected alternatives | doc comment at the site, or a design doc / ADR |
| Constraint with a guard test | the test + a one-line SIGNPOST |
| Detail relevant to editing exactly one file | doc comment in that file |
| Deliberate decision that LOOKS like a bug | one-line RULE ("deliberate, do not 'fix'") + doc comment with the full story |

## Budgets

- **File budget: 150 lines / 8 KB.** A file over budget creates a compaction duty
  BEFORE anything new is appended — merge, sharpen, or relocate until it fits. If the
  content is genuinely all RULE-grade, split the file into narrower `paths:` scopes
  instead of accepting the overage.
- **Bullet budget: ~5 lines.** Overflow belongs in a doc comment at the code site, with
  the bullet pointing to it.
- **Every rule file starts with a `## Critical Invariants` section**: the 3–6
  constraints whose violation means data loss, divergence, or silent corruption.
  Everything else follows in topical sections.
- **One rule lives in one file.** Other files link to it
  (`see .claude/rules/<file>.md "<section>"`), never restate it.

## Mechanical enforcement

`scripts/lint_rules.py` (next to `list_rule_files.py`) checks budgets, `paths:`
frontmatter, the `## Critical Invariants` section, and narrative markers ("used to",
"an earlier attempt", "we tried", bug-ID patterns, …). A linter hit is a compaction
task, not a suppression task. `_inbox.md` — the staging file for uncurated rule
candidates — is exempt from all checks.
