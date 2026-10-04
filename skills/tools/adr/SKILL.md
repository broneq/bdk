---
name: adr
description: Records one architecture decision as a MADR file under docs/adr/, from a free-form description or from a decision entry of a BDK Change. Use when the user asks to write an ADR or to document a decision.
argument-hint: "<decision context, options and choice | decision entry id L-... or <changeId>/L-...>"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *) Read Glob Write AskUserQuestion Bash(ls *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill adr 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: adr" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill adr` first and apply its output; on a `BDK STOP` line, stop and report it.

# ADR

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context.

Write one Architecture Decision Record in the form of [references/madr-template.md](references/madr-template.md). Apply the `Rules: architecture` section of the context above when you weigh the options and their consequences. Done when the record is saved under `docs/adr/` and you have reported its path and title. You write nothing but that one file, and you commit nothing.

## Input

The argument is one of two things:

- **A decision entry**: an id `L-...` of the active Change, or `<changeId>/L-...` of any Change, archived ones included. Run `bdk log show <id> --json`, with `bdk` meaning `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs"`. The entry must have `type: decision`; otherwise say what it is and stop. Its summary is the title, its body gives the context, the options and the reasons, and its refs and the Change id go under "More Information". A refusal of `log show` (no such entry, no active Change for a bare id) is reported with its `why`.
- **A free-form decision**: take the problem, the options, the drivers and the choice from the text.

Without an argument, ask for the decision.

## Write

1. Take everything the input gives before asking. Then ask, in one `AskUserQuestion`, only for what is missing: always the status (proposed, accepted, rejected, deprecated); the options or the drivers only when the input names none. Leave the decision-makers, consulted and informed as `{TBD}` unless the input names them.
2. Number the record: list `docs/adr/` and take one above the highest `NNNN-*.md`, or `0001` when there is none.
3. Write `docs/adr/NNNN-<slug>.md` following the template and its formatting rules. Every option gets its pros and cons, the chosen one included.

Report the path, the title and the status, and name the `{TBD}` fields left for the user.
