# Rules hygiene

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

`.claude/rules/` costs context every single session. Left alone it turns into a changelog:
post-incident "rules" written as incident narratives, appended to whichever file was
nearest, duplicating rules that already exist, in files already over budget.

Two skills keep that from happening. `/bdk:add-rule` prevents accretion at the source;
`/bdk:refine-rules` cleans up what accumulated.

## Route before you write - capture conventions

This table is in every session already, from `STARTUP_INSTRUCTIONS.md`:

| The knowledge                                           | Where it goes                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| Cross-cutting invariant whose violation fails silently  | `.claude/rules/`, scoped by the narrowest `paths:` that covers it |
| Trap visible at the code site where the mistake happens | a doc comment there                                               |
| Something a test or lint already enforces               | one line naming the enforcer                                      |
| Anything else                                           | nothing                                                           |

A line that a rename or file move would force you to edit is a code mirror, not a rule.

!!! warning
**"Nothing" is the frequent, correct answer.** Never write something down just to have
written it. The worst outcome is not a badly-routed rule - it is a rule written at all
when none was warranted.

## Capture one lesson - `/bdk:add-rule`

```
/bdk:add-rule <lesson or convention to capture>
```

It distils one imperative, falsifiable MUST/NEVER sentence - never the incident story,
only the consequence - then applies a four-part admission test (durability, decision,
visibility, derivability) and routes the result:

| Verdict                                                         | Route                                       |
| --------------------------------------------------------------- | ------------------------------------------- |
| Passes all four, governs a broad surface                        | Rule file                                   |
| Passes all four, true only for a subset of files                | Narrow-glob rule file, created if none fits |
| Procedural how-to with a deterministic backstop, near-immutable | Project skill                               |
| True but pull-based - the trap is visible at the code site      | Doc comment there                           |
| A test or lint already enforces it                              | One-line signpost naming the enforcer       |
| Fails durability, or fails the decision test                    | Nothing, with a reason                      |

When several destinations fit, the preference order is
`narrow glob > wide glob > skill > doc comment > nothing`. Skills fail open and rules fail
closed, so an ambient constraint is never routed to a skill.

It then deduplicates: one fact has exactly one home. An existing rule covering the same
constraint is **sharpened in place**, never joined by a near-duplicate and never given the
newest violation's story as an appendix. A second file that genuinely needs the fact gets
a one-line pointer, not a copy.

Finally it checks the target's budget. Over budget means the candidate is staged in
`.claude/rules/_inbox.md` instead, with a recommendation to run `/bdk:refine-rules` - an
over-budget file has a compaction duty before it may grow. You approve the exact text and
location before anything is written, and every touched file is re-linted with zero new
errors as the exit criterion.

## Clean up what accumulated - `/bdk:refine-rules`

```
/bdk:refine-rules [rules-dir]
```

Defaults to `.claude/rules`. It rewrites the directory into rule files describing only the
current, verified state of the code, in one uniform voice.

The premise is worth stating plainly: **every existing sentence is an unverified claim,
not a fact.** Rule files were written by whichever agent or engineer was in the seat on a
given day. Prior wording earns no trust by having survived; it earns trust by matching the
code you actually read.

Six verdicts, one per bullet:

| Verdict     | Meaning                                                                         |
| ----------- | ------------------------------------------------------------------------------- |
| RULE        | Present-tense, falsifiable, passes all four admission tests                     |
| NARROW-GLOB | True, but only for a subset - moves to a file whose `paths:` names that subset  |
| SKILL       | Procedural how-to with a deterministic backstop - extracted to a project skill  |
| SIGNPOST    | Already enforced by a test or lint - compressed to one line naming the enforcer |
| RELOCATE    | True and valuable but pull-based - becomes a doc comment at the code site       |
| NOISE       | Changelog, history, narration, hedged guess, TODO - dropped outright            |

Surviving RULE claims are then **verified against real code**. Checkable claims (file
locations, exports, config settings, banned API patterns, "X calls Y") are dispatched to
exploration subagents briefed to default to skepticism: CONFIRMED only with positive
evidence, otherwise CONTRADICTED or UNVERIFIED. Contradicted claims are dropped, or
corrected only with positive evidence of the replacement. Unverified ones survive but are
flagged for you.

Budgets: 150 lines or 8 KB per file, roughly 5 lines per bullet. Genuinely RULE-grade
content that still exceeds them gets split into narrower `paths:` scopes, not an
exemption.

!!! warning
You approve the plan before anything is written, and the plan lists every target -
relocation doc comments, narrowed globs, extracted skills - so you see the full blast
radius. Relocation happens in the same change set, doc comments written **first**, rule
files overwritten second: cutting before relocating destroys knowledge if the run is
interrupted.

`paths:` frontmatter is preserved verbatim, because it is functional metadata read by the
host to decide when a rule loads, not prose.

## A working rhythm

| Moment                                                     | Command                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| You just learned something the hard way                    | `/bdk:add-rule` - and accept "nothing" as an answer          |
| A rule file crossed its budget, or `_inbox.md` has entries | `/bdk:refine-rules`                                          |
| Before a big refactor                                      | `/bdk:refine-rules`, so you refactor against verified claims |

## What you get

| Artifact                                  | Path                                                              |
| ----------------------------------------- | ----------------------------------------------------------------- |
| New or sharpened rules                    | `.claude/rules/<file>.md`, with `paths:` frontmatter              |
| Staged candidates for an over-budget file | `.claude/rules/_inbox.md`                                         |
| Relocated knowledge                       | doc comments at the code sites                                    |
| Lint status                               | zero errors from the rule linter, as the exit gate of both skills |

## Next step

Back to the [tier table](../index.md#how-you-work-with-it) for the next change - or
[Quality and language rules](../concepts/quality-and-language-rules.md) for the rule sets
BDK ships versus the ones your project owns.
