# Trivial changes

One or two files, and the correct edit is obvious before you start. No plan, no executor,
no design doc:

```
Claude Code built-in plan mode  ->  edit  ->  /bdk:cr --inline
```

This is the tier you will use most often, and the one that invokes no BDK skill until the
very last step. That is deliberate, and the next section explains why it is still safe.

## Why it is safe without a skill

BDK's SessionStart hook runs `scripts/render_startup.py`, which renders
`STARTUP_INSTRUCTIONS.md` - chain markers expanded against your project's feature flags -
and returns it into the session. A plain session, one where you type a request and nothing
else, therefore already carries:

| Section | What it gives the session |
|---|---|
| **Tool Tier System** | The best available tooling for exploration and architecture, symbol search and tracing, and impact analysis - resolved per your enabled features, so the session reaches for `code-review-graph`, then Serena, then grep. |
| **Agents** | The BDK subagent fleet with models and selection criteria, plus the `SendMessage` rules for continuing a spawned agent instead of respawning it. |
| **Verification Proportionality** | The rule that verification matches what changed: content-only edits get no tests and no typecheck, source files get scoped tests and lint plus an incremental typecheck, build-feeding config counts as source, and the full suite runs only on request or at a pipeline's end-of-plan gate. |
| **Quality Rules** | The language-agnostic `code-quality`, `architecture`, `design-patterns`, and `security` rule sets, and how your project overrides them. |
| **Capture Conventions** | Where a lesson goes before you write it down anywhere - and that "nothing" is the frequent, correct answer. |

So the same tool preferences, the same proportionality rule, and the same quality bar that
a skill would carry are already in context. The skills add *workflow* - a plan, a
coordinator, a review fan-out - not the standards. See
[The shared foundation](../concepts/shared-foundation.md) and
[Tool tiers](../concepts/tool-tiers.md).

!!! note
    If the session did not start with BDK's foundation, you are not in this tier - you are
    in an unconfigured session. The first session in a project is blocked until
    `/bdk:setup` has run; see [Setup](../getting-started/setup.md).

## Step 1 - Built-in plan mode

Use Claude Code's own plan mode for the change. You are not writing a BDK plan file: you
want the edit described and agreed before it happens, which is all a two-file change
needs.

Say what you want, read the proposed edit, and accept it. The proportionality rule already
in context means you should expect scoped verification, not a suite run.

## Step 2 - Edit

Let the session make the change. Keep it inside the tier's own boundary:

- One or two files.
- No new module boundary, no schema movement.
- Tests that already exist cover it, or you add the one test the change deserves.

The moment any of those stops being true, stop and escalate to
[the standard workflow](standard.md). Escalating costs one command.

## Step 3 - Review inline

```
/bdk:cr --inline
```

`--inline` runs every reviewer cohort sequentially **in this session**, spawning nothing.
The Step 2 terminal line reads `Dispatching inline (no agents)` instead of an agent count.

For a change this size the engine classifies the range as `tiny` (under 50 changed lines),
where the architecture, duplicate, and dead-code checks fold into the single layer
reviewer rather than getting their own agents - at that size the dispatch overhead exceeds
the work.

The review is still read-only by construction, not by promise: `/bdk:cr` declares
`disallowed-tools: Edit NotebookEdit`, so those tools are removed from the pool while it
is active, and `Write` is bounded to `.bdk/cr/**`.

!!! warning
    `--inline` trades wall-clock and reviewer independence for the ability to run inside a
    single session. Use it for a trivial change, or inside a subagent that cannot spawn
    agents. Do not pick it just to save tokens when the fan-out is available.

## When trivial stops being trivial

| Signal | Escalate to |
|---|---|
| The edit grew past two files | [Standard workflow](standard.md) |
| You found yourself choosing between two shapes | [Full pipeline](full-pipeline.md) |
| The change touches the schema | [Full pipeline](full-pipeline.md) - the Schema-Change Gate exists for exactly this |
| You are chasing a bug, not making a change | [Debugging](debugging.md) |

## What you get

| Artifact | Path |
|---|---|
| The edit itself | your working tree |
| Review report | `.bdk/cr/<stamp>-<branch-slug>-delta.md` |

No plan file, no run manifest, no design doc. Nothing under `.bdk/` except the review.

## Next step

[Code review](code-review.md) - and remember `/bdk:cr --full` before the pull request,
however small the individual edits were.
