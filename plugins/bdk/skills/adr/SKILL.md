---
name: adr
description: Records one architecture decision as an ADR file - in the project's ADR directory and format when it has one, MADR under docs/adr/ otherwise - from a free-form description or from a numbered decision (D1, D2, ...) of an OpenSpec Change, and marks the record it replaces as superseded. Use whenever the user asks to write, record or document an ADR, an architecture decision or a decision record.
argument-hint: "<the decision, its options and reasons | <change>/D<N>>"
allowed-tools: Read Glob Grep Write Edit AskUserQuestion
---

Arguments: $ARGUMENTS

# ADR

Done when one new record is saved in the project's ADR directory, the record it replaces (if any) says it is superseded, and you have reported the path, title and status and the `{TBD}` fields left for the user. Write nothing else and commit nothing.

## 1. Take the decision

The input is one of:

- **A decision of an OpenSpec Change**: `<change>/D<N>`, or words naming both ("decision D2 of add-export"). Read `openspec/changes/<change>/design.md`, or for an archived Change the `openspec/changes/archive/*-<change>/design.md`, and take its `### D<N>.` section: the choice is the outcome, each alternative is another considered option, and the reason it lost is its con. Take the problem from the design's Context and the Change's `proposal.md`. Link the `design.md` under "More Information". When the Change or the section does not exist, say so and stop.
- **Free-form text**: take the problem, the options, the drivers and the choice from it.
- **Nothing**: ask for the decision.

Status: the one the input states. Otherwise `accepted` for a decision of an archived Change (it shipped) and `proposed` for one of an active Change. Otherwise ask.

Take everything the input gives before asking. Ask only for what is still missing (the status; the options when the input names only the choice), all in one `AskUserQuestion`. When you cannot ask, write `proposed` for a missing status, and in the report name each value you chose this way.

Done when you have the problem, at least two options with the chosen one marked, the reasons, and the status.

## 2. Find the project's ADR home and format

Glob for existing records: an `.adr-dir` file (adr-tools) names the directory; otherwise look in `docs/adr/`, `doc/adr/`, `docs/decisions/`, `docs/architecture/decisions/`, `doc/architecture/decisions/`, `adr/`, and for any other directory holding numbered records (`NNNN-*.md`).

- **Records exist:** read the highest-numbered one and one older one. Use their directory, file naming, number width, title line, status style and sections. Their format wins over MADR.
- **No records:** use `docs/adr/` and the MADR shape in [references/madr-template.md](references/madr-template.md).

The number is one above the highest existing number, `1` when there is none.

Done when you know the path of the new record and the shape to write.

## 3. Check for a record it replaces

Read the titles of the existing records. The new decision replaces one when the input says so, or when an accepted record decides the same question the other way (polling replaced by server-sent events, one database replaced by another). Read that record before deciding.

Done when you know which record, if any, is replaced.

## 4. Write

Write the new record with Write, in the shape from step 2.

- Every considered option gets its pros and cons, the chosen one included.
- People the input does not name are `{TBD}` (MADR) or left out (a house format without people fields).
- When it replaces a record, say "Supersedes" with that record's number and link under "More Information" (or the house format's place for links).
- Add a diagram only when the options differ in structure or data flow: one `mermaid` block of at most 15 nodes, with labelled edges and no colours, so it reads in any renderer.

When it replaces a record, change only that record's status, with Edit, to say it is superseded by the new record (`superseded by ADR-0008`, or in the house style, such as `Superseded by 8. Use server-sent events` with a link to the new file). Change nothing else in it.

Done when the new file exists and the replaced record's status names it.

## Report

The new record's path, title and status; the record it supersedes; the values you chose without asking; the `{TBD}` fields left for the user.
