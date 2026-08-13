---
name: update-docs
description: Use when existing architecture documentation needs refreshing after code changes, when running periodic doc maintenance, or when user asks to "update docs", "refresh documentation", or "sync docs with code".
model: sonnet
user-invocable: true
disable-model-invocation: true
argument-hint: "[doc_path]"
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
hooks:
  Stop:
    - hooks:
        - type: prompt
          prompt: "Verify documentation update completeness: $ARGUMENTS\n\nRequired checks:\n1. File saved to original doc_path location\n2. Contains Overview section (2-3 sentences)\n3. Contains Core Architecture with file tree\n4. Contains at least ONE Graphviz diagram compiled to SVG (no raw ```dot or ```graphviz blocks remain — all replaced with ![...](*.svg) image references)\n5. Contains Critical Rules section with examples\n6. Contains Live Examples with PROTOTYPE code (not actual implementation)\n7. Contains Core Classes section\n8. Contains Testing Coverage section describing existing tests\n9. Updated sections read as uniform text — no changelog markers, no 'updated on' annotations, no diff markers\n\nReview the conversation and tool outputs. If ANY required section is missing or incomplete, respond: {\"ok\": false, \"reason\": \"Missing: [list specific items]\"}\n\nIf all sections present and complete, respond: {\"ok\": true}"
          timeout: 30
---

# Update Docs

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/explore.chain.json`

Refresh existing architecture documentation by comparing it against current code, merging updates while preserving accurate manual prose. The result is uniform text — no changelog, no diff markers, no "updated on" annotations.

## Workflow

### 1. Parse Existing Doc

Read the documentation file at `$ARGUMENTS` and extract:

- **Sections**: Split by `##` headers into top-level sections
- **Module root**: From the file tree code block (e.g., `src/data_migrator/processors/loaders/xml/`)
- **Code references**: Class/function names from `### Class:` patterns and code blocks
- **File list**: Parse file tree to get documented files
- **Diagram references**: Collect ALL diagram assets:
  - `![...](*.svg)` image links → note the SVG path
  - `Source: [...](*.dot)` links → note the `.dot` source path
  - Inline ` ```dot ` / ` ```graphviz ` blocks → note content

Do this in main context — no subagent needed. Use regex and string matching.

**Fallback**: If the doc lacks a clear file tree or module root, ask the user which code path the doc covers.

### 2. Explore Current Code

**Step 2.1 — Discover Current State**

```python
mcp__plugin_bdk_serena__list_dir(relative_path="<module_root>", recursive=True)
mcp__plugin_bdk_serena__get_symbols_overview(relative_path="<key_files>")
```

Compare actual file list against the doc's file tree. Note added/removed/renamed files immediately.

**Step 2.2 — Check Diagram References**

For each diagram reference found in step 1:

1. **Read the `.dot` source file** (from `Source: [...](.dot)` links or extracted `.dot` files)
2. **Compare diagram content against current code**: Do the nodes, edges, labels, and relationships in the diagram still match the actual classes, modules, and data flows?
3. **Flag stale diagrams**: If a diagram references renamed/removed symbols, missing components, or outdated relationships, mark it as OUTDATED
4. **Flag missing diagrams**: If new subsystems or major flows were added that have no diagram, mark as MISSING

Include diagram findings alongside code findings for subagents.

**Step 2.3 — Partition into Logical Blocks**

Same rules as `/bdk:explain-complex-code`:

| Files Count | Subagent Count |
|-------------|----------------|
| 1-2 files   | 1 subagent     |
| 3-5 files   | 1-2 subagents  |
| 6-10 files  | 2-3 subagents  |
| 10+ files   | 3-4 subagents  |

**Step 2.4 — Launch Comparison-Aware Subagents**

**CRITICAL**: Launch all subagents in a SINGLE message with multiple Task tool calls.

Each subagent receives existing doc claims alongside files to explore:

**Subagent Instructions Template**:
```
Explore these files: [FILE_LIST]

The existing documentation claims:
[EXTRACTED_CLAIMS_PER_FILE]

The following diagrams reference these files:
[DIAGRAM_REFERENCES_FOR_THIS_BLOCK]

For EACH file, report:
1. What's ACCURATE in the existing docs
2. What's OUTDATED (changed signatures, renamed classes, different logic)
3. What's NEW (undocumented classes, methods, rules)
4. What's GONE (documented things that no longer exist)

For EACH referenced diagram, report:
1. Which nodes/edges still match the code
2. Which nodes/edges are stale (renamed, removed, restructured)
3. What new components should be added to the diagram

Also report: purpose, components, dependencies, key algorithms,
data structures, edge cases.

Format as:
## Block: [block name]
### Comparison Results:
- ACCURATE: [list]
- OUTDATED: [list with details of what changed]
- NEW: [list with details]
- GONE: [list]

### Diagram Results:
- [diagram name]: ACCURATE / OUTDATED (details) / MISSING new diagram needed

### Current State:
For each file:
#### File: [name]
- Purpose: [brief]
- Components: [list with descriptions]
- Dependencies: [list]
- Key Rules: [list]
- Special Cases: [list]
```

### 3. Confirm Update Plan

After subagents return, classify each section by content matching — no hardcoded section mapping.

**Classification logic** (generic, works with any template):
- Section mentions symbol X → subagent says X changed → **OUTDATED**
- Section has file tree → actual files differ → **OUTDATED**
- Subagent reports new symbol not mentioned anywhere → **MISSING**
- Section references symbol Y → subagent says Y no longer exists → **OUTDATED**
- Diagram references stale symbols or missing components → **DIAGRAM OUTDATED**
- New subsystem has no diagram → **DIAGRAM MISSING**
- No discrepancies found in section → **ACCURATE** (keep as-is)

**Present the update plan and ask for confirmation in a single `AskUserQuestion` call:**

Use `AskUserQuestion` with a single question. Put the full update plan in the question text:

```
Update plan for [doc_path]:

  KEEP:     [list of accurate sections]
  UPDATE:   [list of outdated sections with brief reason]
  ADD:      [new content to add]
  REMOVE:   [orphaned references to clean up]
  DIAGRAMS: [list of diagrams to update/add/keep with brief reason]

Approve this update plan?
```

Options: "Approve" / "Approve with changes" / "Cancel"

**Only proceed to step 4 after user approves.** If "Approve with changes", incorporate user feedback.

### 4. Write Updates

Reconstruct the document:

1. **Copy** unchanged sections verbatim (preserves manual prose, formatting, wording)
2. **Rewrite** outdated sections using patterns from `/bdk:explain-complex-code` references
3. **Insert** new content where it fits logically within existing structure
4. **Remove** orphaned references cleanly — no "removed" comments, just omit
5. **Update diagrams**:
   - Rewrite outdated `.dot` blocks / source files to reflect current code structure
   - Add new diagrams for undocumented subsystems
   - Keep accurate diagrams unchanged
   - Ensure `![...](*.svg)` and `Source: [...](.dot)` references stay consistent

The final file reads as one uniform document. No markers indicating which parts were updated.

**Prototype code rules** (same as `/bdk:explain-complex-code`):
- Use placeholder names: `process()`, `transform()`, `calculate()`
- Show control flow clearly, include comments for key steps
- Keep under 20 lines per example
- Never copy actual implementation

### 5. Save and Compile Diagrams

Save to the same path as the input `$ARGUMENTS`.

After saving, invoke `/bdk:graphviz-docs-compiler` to extract `.dot` files and compile to SVG.

## Resources

### Documentation Template

Use `/bdk:explain-complex-code` references for section structure when rewriting outdated sections. Do not load unless rewriting sections.

## Quick Reference

### Update Classification

| Signal | Classification |
|--------|---------------|
| Symbol changed/renamed | Section OUTDATED |
| File added/removed | File tree OUTDATED |
| New undocumented symbol | Content MISSING |
| Referenced symbol gone | Section OUTDATED |
| Diagram references stale symbols | Diagram OUTDATED |
| New subsystem without diagram | Diagram MISSING |
| No discrepancies | Section ACCURATE |

### Checklist

- [ ] Parsed existing doc, extracted module root and diagram references
- [ ] Explored current code with comparison-aware subagents (including diagram checks)
- [ ] Classified each section and diagram (accurate/outdated/missing)
- [ ] Presented update plan and got user confirmation via single AskUserQuestion
- [ ] Wrote updates preserving accurate sections verbatim
- [ ] Updated/added/kept diagrams as approved
- [ ] Invoked `/bdk:graphviz-docs-compiler` to compile diagrams to SVG
- [ ] Final document reads as uniform text (no update markers)
