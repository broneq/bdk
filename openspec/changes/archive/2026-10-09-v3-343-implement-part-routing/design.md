## Context

`/bdk:execute` (spec `bdk-execute`) is a thin orchestrator: it starts one `bdk:lead` running `execute-waves`, which builds every part of the plan in waves, commits and merges. `implement-part` (spec `bdk-execute-blocks`) builds one part test-first on `bdk:implementer` and leaves it uncommitted. Both descriptions matched the prompt "Implement part 01 of the plan of the change X": `/bdk:execute` claims "implement ... a Change or its plan", `implement-part` claims "implement ... a plan part (01, 02)". In 1 of 3 runs the main session picked `/bdk:execute` with the argument `add-csv-export 01`, and the lead blocked the stage (#343).

## Goals / Non-Goals

**Goals:** a prompt about one part reaches `implement-part`; `/bdk:execute` called for one part points at `implement-part` instead of running a lead that blocks.

**Non-Goals:** building a subset of parts through the lead (waves, commits, conform for one part). Nobody asked for it, and `execute-waves` already resumes from `state.json`.

## Decisions

### D1. `/bdk:execute` takes no part id; it names `implement-part`

Asked for one part, `/bdk:execute` starts nothing and replies with `/bdk:implement-part <change> <part-id>`, noting that it builds and checks the part without committing it, and that `/bdk:execute <change>` builds the whole plan.

Alternatives:
- *Take a part id and pass it to the lead* (`execute-waves --only 01`): adds a mode to the lead (state, waves, merge of a single part, what the wave check means) for a call nobody needs; the stage builds the plan, and `implement-part` already is the one-part block. Rejected: a second way to do the same job.
- *Invoke `implement-part` from `/bdk:execute`*: the orchestrator would hide which block runs and would need the `Skill` tool; the user loses the choice between one uncommitted part and the full stage. Rejected: naming the command is one line and keeps each block one job (CLAUDE.md "One block, one job").
- *Ignore the part id and build every part*: does work the user did not ask for and commits it. Rejected.

### D2. Fix the routing in the descriptions

The description of `/bdk:execute` says "builds every part of the plan" and "Not for one part: `implement-part` builds a single part"; the description of `implement-part` front-loads "one plan part" and says "not the whole plan, which is `/bdk:execute`". Descriptions are what the main session picks a skill by, so the fix belongs there. A hook or a CLI route was not considered: the skill-first rule (ADR-0003) allows them only after an eval shows the description cannot carry it.

### D3. Eval cases

`implement-part-csv` stays the routing case of the block, run 6 times for the acceptance signal (its `skill-fired` grader is a `tool_used: Skill` grader). A new orchestrator case `execute-one-part` types `/bdk:execute add-csv-export 01` on the `ledger-planned.sh` fixture and grades that the stage lists the plan parts (`tool_order`), starts no agent, writes nothing (a `writes-nothing` case with a trace regex), and that the reply names `/bdk:implement-part add-csv-export 01`. The part check sits after the plan check in step 1, so the stage names `implement-part` only for a part that exists and lists the parts otherwise.

## Risks / Trade-offs

- A user who wants one part built and committed has no single command: they run `implement-part`, then commit, or run the whole stage. Acceptable: the lead resumes from `state.json`, so running the stage loses nothing.
