---
name: docs
description: Writes architecture documentation for a code module, or refreshes an existing document against the current code, with Mermaid diagrams and prototype examples. Use when the user asks to explain or document code, or to sync docs with the code.
argument-hint: "<code path to document | existing .md document to refresh>"
allowed-tools: Bash(bdk *) Bash(echo *) Read Grep Glob Write Edit AskUserQuestion Bash(git ls-files *) Bash(git log *)
---

!`bdk ctx skill docs 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: docs" heading appears above, run `bdk ctx skill docs` first and apply its output; on a `BDK STOP` line, stop and report it.

# Docs

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context.

Write or refresh one architecture document. Every document has the shape in [references/document-shape.md](references/document-shape.md); read it before you write. Done when the one document is saved and has every item of the shape's "Done when" list, and you have reported its path. You write nothing but that document.

The argument picks the mode:

- an existing Markdown file: **Refresh** it against the code it describes;
- anything else is a code path: **Create** a document for it.

Without an argument, ask which module to document or which document to refresh.

## Refresh

1. **Read the document.** Split it by `##` sections. Collect the module root and the file list from its file tree, the symbols it names, and each `mermaid` block with the heading above it. When the document names no module root, ask which code path it covers.
2. **Read the code.** List the files under the module root (`git ls-files <root>`) and compare them with the file tree. Read each file the document describes, and the new ones. For every section and every diagram, classify it:
   - **accurate**: everything it says still holds;
   - **outdated**: a symbol it names changed or is gone, the file tree differs, or a diagram shows a node or edge that no longer exists;
   - **missing**: a component, rule or flow the code has and the document lacks, including a new subsystem without a diagram.
3. **Ask before writing.** Show the plan in one `AskUserQuestion`: keep (accurate sections), update (each outdated section with its reason), add, remove, and the diagrams to update, add or keep. Options: approve, approve with changes, cancel. Write nothing before the user approves, and apply the changes they ask for.
4. **Rewrite.** Copy accurate sections word for word, so the user's prose stays. Rewrite outdated sections in the shape, insert missing content where it belongs, and drop what no longer exists without a note. Leave an accurate diagram alone even when it predates the diagram rules: a refresh changes content, not style.
5. **Save** to the same path. The result reads as one document: no changelog, no "updated on" note, no diff or "removed" marker.

## Create

1. **Scope.** Take the code path from the argument. Ask what the reader needs only when the argument leaves it open: onboarding, debugging, or an external audience. When the path holds more than about 30 source files, propose documenting one sub-module at a time, and name the split.
2. **Read the code.** Find the module's entry points and the symbols most of it depends on. For each key component, read its body and find its callers. Find its tests. Note the non-obvious rules: invariants, ordering, error handling that a reader would get wrong.
3. **Write** every section of the shape from what you read. Examples use prototype code only, never copied implementation. Draw at least one diagram, following the diagram rules of the shape.
4. **Save** to the path the user names, or else to `docs/architecture/<module>.md`, with `<module>` the last directory of the code path in kebab-case. Never write under `.bdk/`: it holds BDK state, not documentation. When the file already exists, switch to **Refresh**.

## Finish

Report the path, the mode, and for a refresh the sections kept, updated, added and removed.
