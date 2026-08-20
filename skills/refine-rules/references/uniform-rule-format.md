# Uniform Rule Format

Target shape for every file under `.claude/rules/` after refinement. Converge every file
on this shape — don't invent a different structure per file, and don't preserve a file's
original structure just because it was already there.

## Skeleton

```markdown
---
paths:
  - "some/glob/**"        ← keep verbatim if present; this is functional metadata
---                          (drives path-scoped drift detection), not prose to edit

# <Rule File Title>

<Optional 1-2 sentence orientation: what this file governs, where the real code lives.>

## Critical Invariants

1. <The 3-6 constraints whose violation means data loss, divergence, or silent
   corruption — one line each, with a pointer to the full rule below.>

## <Section Name>

- **<Rule stated as a present-tense, falsifiable claim>.** <Why it matters or what
  breaks if ignored — 1-3 sentences.> <Optional: concrete evidence anchor —
  a file:line, a real function name, or a short illustrative code fragment —
  only when it clarifies a banned/required pattern.>
```

Budgets (from `rule-admission.md`): 150 lines / 8 KB per file, ~5 lines per bullet.
The `## Critical Invariants` section is required for files over ~40 lines; a short
file whose whole body IS its critical list may skip it.

Frontmatter (`paths:`) is the one part of a rule file that is NOT prose — never
paraphrase, compact, or "uniform-ize" it. It is machine-read by the drift hook.

## The bullet is the unit of a rule

One bullet = one rule. Lead with a **bold, present-tense, falsifiable claim** —
something a reader could check against the code and find true or false today.
Follow with the reasoning. This mirrors how BDK's own `rules/architecture.md` and
`rules/languages/typescript.md` are written — study those two files as the reference
example of the target voice if you want calibration beyond this template.

Good:
> - **No `ctx.db` in an `action`.** Actions have no `ctx.db`. Read via
>   `ctx.runQuery(...)`, write via `ctx.runMutation(...)`.

Bad (buries the rule, no falsifiable claim up front):
> - We generally try to be careful about how actions touch the database, since
>   there have been issues in the past with this.

**Signpost form** — for a constraint a test or lint already fully enforces, one line
naming the enforcer replaces the explanation:

> - **Layer imports are one-directional.** Enforced by `lib/__tests__/layering.test.ts` —
>   when it fails, read the test, don't work around it.

**Pointer form** - one fact has exactly one home. When a second file genuinely needs
that fact, it gets a pointer, never a restatement:

> - **Cascade deletes are ordered.** See `.claude/rules/cascade.md` "Delete ordering".

**Deliberate-decision form** — for behavior that LOOKS like a bug but is intentional,
the rule is one line flagging it, and the full story lives in a doc comment at the
code site:

> - **`trailingBreak` is rendered, not hidden — deliberate, do not "fix".** Full
>   rationale in the doc comment at `renderer/trailing-break.ts`.

## What is a rule vs. what is noise

A **rule** describes a current invariant, convention, or gotcha about the code —
something that stays true until someone deliberately changes the system, and that a
reader needs to know before writing code in this area.

**Noise** — strip these on sight, regardless of how the original file phrased them:

| Pattern | Why it's noise | Example |
|---|---|---|
| Changelog / dated narration | Describes what changed, not what's true now | "2024-03: switched from the bash script to `execute.ts`" |
| "We used to… now we…" | The "used to" half is dead weight once the rule exists | "We used to validate in the mutation; now we validate in the action." |
| Authorship / session notes | Not a property of the code | "Added by the auth refactor PR", "per discussion with X" |
| Hedged, unverifiable language | If it's not confident enough to state as fact, it's not a rule yet | "I think we probably shouldn't...", "not 100% sure why but..." |
| TODO / future-work notes | A rule describes what IS, not what's planned | "TODO: revisit this once we migrate to v2" |
| Restated obvious framework behavior | Not project-specific, doesn't need to live here | "Functions in JS are first-class values" |

**Exception:** a version number or dated fact is NOT noise when the version *is* the
rule — e.g. "Convex version: `^1.17.x` — API shapes below match this major" tells the
reader why the documented behavior holds and when to distrust it. The test: delete the
date/version and see if the sentence still makes an actionable claim. If yes, keep it
(version-gated facts often *are* the rule). If the sentence only narrates a transition,
drop it.

## Verification, not transcription

Every rule file you touch was written by whichever agent or engineer was in the seat
that day, under whatever time pressure existed then. Treat every existing bullet as an
unverified claim, not a fact, until you've checked it against the actual code — see
`SKILL.md` Step 3 for how to scope and dispatch that verification. This reference file
only defines the *output* shape; it does not replace checking each claim.

## Worked example

**Before** (mixed history, narration, and unverified guesses):

```markdown
# Migrations

## History
We used to run migrations manually via a bash script. This caused problems in 2024
because it wasn't ordered and could double-apply. In March we moved to the new
execute.ts runner.

## Current approach
Migrations run through execute.ts I believe, and there's a registry somewhere. Not
totally sure if pre-phase migrations still work, might be dead code now.
```

**After** (verified against `convex/migrations/execute.ts` and `_registry.ts`, noise
removed, uniform bullet format applied):

```markdown
# Migrations

Forward-only, ordered Convex migration runner. Runtime in
`convex/migrations/execute.ts`; migrations in `convex/migrations/versions/`;
registry in `_registry.ts`.

## Adding a migration

- **File name is `NNNN_snake_case.ts`, `NNNN` the next integer.** Export `run` and a
  `migration: MigrationModule` descriptor; append it to `_registry.ts` and never
  reorder, rename, or edit a shipped entry — `name` is the dedup key in
  `appliedMigrations`.

## Phases

- **`post` runs after deploy, `pre` before it.** Use `pre` only when the new schema
  is incompatible with existing data; `npm run deploy` runs `pre` → `convex deploy` →
  `post` in that order.
```

Note what happened: the "History" section is gone entirely (it was 100% narration),
the hedged sentence ("I believe", "not totally sure") was either verified and stated
as fact or dropped, and both surviving rules now lead with a bold falsifiable claim.
