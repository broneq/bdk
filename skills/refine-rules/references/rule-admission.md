# Rule Admission — What Belongs in a Rule File at All

`uniform-rule-format.md` defines how a surviving rule is written. This file defines the
harder question: whether a piece of knowledge should live in `.claude/rules/` in the
first place. Content can be perfectly true, verified, and well-formatted — and still be
the wrong thing to inject into every session that touches its `paths:`.

## Prime directive

**"Nothing" is the expected, frequent output of every capture path.** The failure mode
this file exists to stop is not a badly-routed rule - it is a rule written at all when
none was warranted. The admission test, the routing table, and the linter exist to
legitimize deletion and non-capture as first-class outcomes, not to help more text get
written. Reporting "this is not a rule, and here is why" is a complete, successful
result.

## What a rule file stores

A rule file stores ONLY:

1. **Cross-cutting invariants with silent failure.** Violation compiles, passes tests,
   and looks correct; the damage appears later or somewhere else.
2. **Anti-instinct constraints.** The default LLM/dev instinct produces the wrong
   change: relational FK modeling on a document store, raising a timeout to "fix"
   flake, `?? ""` on a tri-state value.
3. **One-line signposts** for constraints a test or lint already enforces: name the
   enforcer, state "deliberate, do not fix", nothing more.

Everything else is out of scope for a rule file:

| Content | Home |
|---|---|
| How a module works, API shapes, collaborator inventories, file lists, method enumerations | doc comment at the code site |
| Why this design; what was rejected | doc comment at the site, or the guard test's comment |
| Step-by-step procedure behind an intent trigger | a skill |
| History, incident narrative, a ticket id as the sole rationale | drop |

## Push vs. pull

A rule is **push-based** instruction: it must change the agent's decision BEFORE the
agent reads the relevant code. Knowledge the agent will see anyway when it opens the
file it is editing is **pull-based** and belongs elsewhere — a doc comment at the code
site, a type signature, or a test. Rule files are paid for at session start by every
task matching their `paths:`; pull-based knowledge is paid for only when someone
actually works on that code.

## Admission test - all four must pass

0. **Durability test.** Does the sentence survive a refactor that changes no decision?
   Litmus: if renaming or moving a file forces an edit to this rule, it is a code mirror
   and fails admission. Enumerations that must stay complete (lists of files, methods,
   collaborators) fail by definition; the only allowed enumeration is one pinned by a
   test that fails when it drifts.
1. **Decision test.** Without this line, would an agent produce a wrong change? If no —
   it is not a rule.
2. **Visibility test.** Is the trap invisible at the site where the mistake would be
   made? A trap that a doc comment at the code site would surface in time belongs in
   that doc comment. Passes into rules: a semantic trap that can be written in a
   brand-new file far from the code that defines the invariant (no comment can warn in
   time). Fails: a subtlety local to one function, visible in the one file where it
   lives.
3. **Derivability test.** Can the agent infer this from code, types, the code graph, or
   a failing test within the same task? If a test enforces the constraint, the rule is
   one line naming the test - the test is the enforcer, the rule is a signpost.

## Verdicts

Classify every candidate bullet with one of six verdicts:

| Verdict | Meaning | Action |
|---|---|---|
| **RULE** | Passes all four admission tests | Keep; write per `uniform-rule-format.md` |
| **NARROW-GLOB** | A true rule, but relevant only to a subset of the current `paths:` | Move or keep it in a file whose `paths:` names the narrow set (e.g. `convex/schema.ts` + `convex/cascade*`, not `convex/**`). Prefer this over SKILL: same on-demand loading, deterministic trigger |
| **SKILL** | ALL of: (a) the trigger is an intent no glob expresses, (b) the content is procedural - a how-to, not an ambient constraint, (c) a deterministic backstop (guard test, validator, deploy gate) catches a missed invocation, (d) the content is near-immutable | Extract to a project skill; the rule file keeps nothing, or a one-line pointer |
| **SIGNPOST** | True constraint, but a test/lint already enforces it | Compress to one line naming the enforcer |
| **RELOCATE** | True and valuable, but pull-based (fails the visibility test) | Move to a doc comment at the code site; the rule keeps at most a one-line pointer |
| **NOISE** | History, narration, hedges, archaeology | Drop (see the noise table in `uniform-rule-format.md`) |

**Skills fail open, rules fail closed.** A skill only helps if something invokes it;
a rule attaches whether or not anyone thought to ask. Never route an ambient constraint
to SKILL - that is what criterion (c) is for.

**Priority when several destinations fit:**
`narrow glob > wide glob > skill > doc comment > nothing`.

**Never `docs/` as a parking lot.** Content that fails admission is deleted or relocated
to a code site - not archived somewhere it will rot unread. (Writing an ADR is a
deliberate act of its own; it is not a destination for rules that failed admission.)

**RELOCATE ordering is load-bearing:** move the content to its new home FIRST, then cut
it from the rule file. Cutting without relocating destroys knowledge someone paid for —
often with a long debugging session.

**Doc-comment bar.** A relocated comment must state a constraint the code itself cannot
show: an invisible trap, or a "why" the names and types do not carry. A comment that
paraphrases the signature ("fetches an image" on `getImage()`) fails the same admission
test and is written nowhere.

## Where knowledge lives

| Knowledge | Home |
|---|---|
| Cross-file invariant; trap invisible at the error site | `.claude/rules/` |
| Invariant true only for a subset of a wide `paths:` scope | a rule file with a narrower `paths:` |
| Procedure behind an intent trigger, with a deterministic backstop | a project skill |
| How a module/function works (API, protocol, shapes) | doc comment at the code site |
| Why a design was chosen; rejected alternatives | doc comment at the site, or the guard test's comment |
| Constraint with a guard test | the test + a one-line SIGNPOST |
| Detail relevant to editing exactly one file | doc comment in that file |
| Deliberate decision that LOOKS like a bug | one-line RULE ("deliberate, do not 'fix'") + doc comment with the full story |

## Duplication policy

**One fact has exactly one home.** Every other file that needs it keeps a one-line
pointer to that home (`see .claude/rules/<file>.md "<section>"`), never a restatement.

- **add-rule**, on finding existing coverage: sharpen the existing rule in place. Never
  append a near-duplicate, and never append the newest violation's story to it.
- **refine-rules**, on finding the same fact in two files: keep it in the file whose
  `paths:` matches the governing code, and reduce the others to pointers.

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

## Mechanical enforcement

`scripts/lint_rules.py` (next to `list_rule_files.py`) checks budgets, `paths:`
frontmatter, the `## Critical Invariants` section, narrative markers ("used to",
"an earlier attempt", "we tried", bug-ID patterns, …), and two admission checks:

- `admission:code-mirror` - a bullet enumerating 3+ file paths from one directory, with
  no pinning test cited. The mechanical arm of admission test #0.
- `admission:ticket-only-rationale` - a bullet whose only justification is an
  issue-tracker id. State the consequence inline ("a drift between the two projections
  loses deletions"); the ticket id is an addendum, never the reason.

A linter hit is a compaction task, not a suppression task. `_inbox.md` - the staging
file for uncurated rule candidates - is exempt from all checks.
