## Context

The Concepts pages (`docs/concepts/`) draw the BDK flows as Mermaid diagrams. #338 fixed their layout (every diagram renders at 0.8 or more of its natural width at 1280 px, checked by `docs:diagram-fit`; no per-block Mermaid configuration, label lines at most 40 characters, checked by `pnpm check`). #317, #322 and the Playwright step of `/bdk:setup` changed the flows after the diagrams were drawn. Issue #340 lists the twelve mismatches with their source lines; each was re-checked against `plugins/bdk/skills/*/SKILL.md`, `plugins/bdk/src/slices.ts`, `plugins/bdk/src/run/domain/status.ts` and `plugins/bdk/src/hooks/use-cases/session-start.ts` before this design.

## Goals / Non-Goals

**Goals:**
- Every Concepts diagram matches the sources and the prose and tables next to it (issue items 1 to 12).
- `/bdk:diagnose-run` has its own section and diagram.
- The SDLC docs rule names diagrams, so the next Change that adds a step redraws its flow.
- Every changed diagram passes `docs:diagram-fit` and the `pnpm check` diagram rules, and reads well in light and dark at 1280 px and 390 px.

**Non-Goals:**
- The diagram error contrast of the theme (#333).
- `docs/design/` records: dated and approved, historical by intent.
- Any change to a skill, agent, hook or `bdk` command.

## Decisions

### D1. The SDLC docs rule names diagrams (issue "To resolve in the spec")

The rule in `CLAUDE.md` ("Docs") and the `tasks` rule of `openspec/config.yaml` say that a Change which adds, removes or reorders a step, exit, command, key, file or agent of a flow updates every diagram that draws it, and that the Docs task group names those diagrams. The `repo-sdlc` requirement carries the same text.

Alternatives considered:
- **Leave the rule at "pages".** Rejected: that wording is what let #317 and #322 update tables and leave diagrams; the mismatch this issue fixes would come back with the next step added.
- **A check that compares diagrams with the skills.** Rejected for now: a diagram is a drawing of steps, not a list of names, and the name check (`docs-names.test.ts`) already fails on a name that is gone. A structural check would have to parse skill prose; nothing measured yet justifies that machinery. The rule plus the Docs task group makes the author look at the diagram.

### D2. Keys per stage: full dotted paths, the fix pass as a labelled group

The `/bdk:auto-review` box lists every key its blocks read, by its full dotted path (the form the name check reads), with the keys of the fix pass (`/bdk:plan-fixes` and the execute lead) after a line `fix pass:`. The box gets tall but stays one column of lines under 40 characters, so the diagram width does not grow.

Alternatives considered:
- **Wildcards such as `models.*`, `plan.part.*`.** Rejected: the name check does not read a wildcard, so a renamed key would pass unnoticed; the key table under the diagram already uses full paths.
- **A second box for the fix pass.** Rejected: the stage is one row per orchestrator by design ("its blocks included"); a second box would read as a separate stage.

### D3. Run-status decision: widen the execute question, keep the spine

The question "every part done in state.json?" becomes "every part and every wave done in state.json?". The exit stays `execute`, as in `status.ts`, where both checks return stage 4.

Alternative considered: **a separate wave question node.** Rejected: both lead to the same exit and stage number; a second node lengthens the spine and the invisible exit chain for no extra information.

### D4. Execute sequence: the wave check after the merge, with its repair as an `opt`

After the part loop and the merge, the lead writes the wave's base into `state.json` at the start (`waves.N base`), runs `bdk check run wave-N` (`checks/wave-N.json`), and an `opt red wave check` block shows `/bdk:resolve-conflict --wave N` writing `execute/wave-N.md` and the lead committing it. The `state.json` messages name parts and waves. The diagram stays a `sequenceDiagram` with the same four participants, so its width changes only by message length.

### D5. `/bdk:diagnose-run` drawn as a flowchart of its steps

A `flowchart TB`: typed in the main thread, step 0 starts `bdk:analyst` (foreground) and waits; the analyst finds the run, runs `bdk diagnostics report` (exit 3: report from run files alone, `## Missing data`), reads the run files, judges each waste lead against its transcript lines, writes `R/diagnostics.md`. A flowchart rather than a sequence because the steps are one agent's, with one branch (exit 3) and a stop (several Changes, none chosen).

### D6. Who starts whom: the analyst under its block, not under the orchestrators

The orchestrators node keeps its `Agent` edge to explorer, designer, planner and verifier; `analyst` moves under a node `/bdk:diagnose-run` (main thread, step 0) with its own `Agent` edge. The prose under the diagram names which blocks start their own agent through step 0 when a user types them, and which run in the main thread (`/bdk:e2e-check`, `/bdk:review-group`, `/bdk:review-integration`, `/bdk:judge`, and the main-thread blocks of the Roles table).

Alternative considered: **one "blocks typed by a user" node starting every agent.** Rejected: it would duplicate every worker under a second parent and hide that the orchestrators start them in a normal run; only the analyst has no orchestrator.

### D7. Hooks: five lines, the first names the root

The hooks sequence says "five lines: the project root, stages, /bdk:run, resume, direct small edits", and the prose says the text is the same in every project except its first line, which names the project root.

## Risks / Trade-offs

- [A taller keys-per-stage diagram] → it stays within the column width; height costs scrolling, not legibility.
- [Mermaid layout shifts when a node is added] → every changed page is measured with `docs:diagram-fit` and screenshotted in light and dark at 1280 px and 390 px.
