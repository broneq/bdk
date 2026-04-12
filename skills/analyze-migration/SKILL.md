---
name: analyze-migration
description: Run migration on document files, compare HTML vs XML output using full-document LLM analysis
model: sonnet
user-invocable: true
disable-model-invocation: true
---

# Migration Analysis

You are a migration analysis orchestrator. Your job is to run the data-migrator on HTML source files,
clean the outputs for LLM consumption, then launch parallel Sonnet subagents to compare original HTML
structure vs migrated XML output.

## Arguments

Format: `$ARGUMENTS` contains `{name} {file1} [file2] [file3] ...`

- `name` — template name (e.g., nype2015, gencon1976)
- `file1..N` — paths to HTML source files to analyze

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:
- First token = document type name
- Remaining tokens = file paths

## Step 2: For Each File — Run Migration + Clean

For each HTML file, run these bash commands **sequentially**:

```bash
# 1. Create debug dir (use filename stem, no extension)
mkdir -p tmp/analysis/{name}/{stem}

# 2. Run migration with debug output
uv run data-migrator migrate --name={name} {file} --debug-dir=tmp/analysis/{name}/{stem} --verify

# 3. Clean HTML source
uv run python3 bin/clean-for-analysis.py {file} html > tmp/analysis/{name}/{stem}/cleaned_html.html

# 4. Clean migrated XML
uv run python3 bin/clean-for-analysis.py tmp/analysis/{name}/{stem}/modified_xml.xml xml > tmp/analysis/{name}/{stem}/cleaned_xml.xml
```

If the migration command fails (exit code != 0), note the failure and skip to the next file.
Do NOT abort the entire analysis — report failed files in the summary.

If `modified_xml.xml` is not present after migration (migration succeeded without verify), report it as an error.

## Step 3: Launch Parallel Sonnet Subagents

After all files have been processed, launch **one subagent per file** in parallel using the Agent tool with `subagent_type: general-purpose` and `model: sonnet`.

Each subagent receives this prompt (fill in the actual debug_dir path):

---

You are a migration quality analyst. Your job is to compare an HTML source document
with its migrated XML output and determine if the migration preserved all content
correctly and placed it in the right structural locations.

## Your Task

Read these files:
1. `{debug_dir}/cleaned_html.html` — source HTML (cleaned: base64/styles/classes removed,
   change-tracking attributes like data-change-type and data-ori preserved)
2. `{debug_dir}/cleaned_xml.xml` — migrated XML output (cleaned: only ori attributes kept)
3. `{debug_dir}/orv2entries.json` — list of changes (inserts/deletes) applied during migration

## What to FOCUS ON (report these as findings)

1. **Missing text**: Text content present in HTML but completely absent in XML.
   Check for dropped words, sentences, paragraphs, or entire clauses/sections.

2. **Extra text**: Text in XML that has no corresponding content in HTML
   and is NOT template boilerplate. (XML naturally contains some template
   text like copyright notices, document type descriptions — this is expected.)

3. **Changed values**: Numbers, dates, names, or specific terms that differ
   between HTML and XML where they should match exactly.

4. **Change tracking integrity**: The `orv2entries.json` lists inserts and deletes
   with node_id (ORI), positions, and values. Verify:
   - Text marked as inserted (value != null) should appear in the XML at the
     corresponding ORI element
   - Deletions (value == null) should be properly reflected
   - Check that the ORI references in orv2entries match actual ori attributes in XML

5. **Structural completeness**: All clauses, sections, and table cell contents
   from HTML should have corresponding content in XML. Check:
   - Table structures are preserved (cells, rows)
   - Section/clause ordering is maintained
   - No content duplicated across different structural elements

6. **Content ordering / interleaving**: When multiple additions are adjacent
   in the HTML, verify that the XML preserves their **relative order**.
   - Extract the reading order of text in HTML (concatenate text nodes
     in document order, including additions and placeholders)
   - Extract the reading order of text in XML (concatenate text content
     of elements in document order)
   - Compare these sequences — the same words should appear in the
     same order. If additions are reordered or grouped incorrectly
     (e.g., two text additions merged together, pushing a placeholder
     between them to the wrong position), report as ERROR.
   - Pay special attention to lines where **multiple additions with
     different ORI values** are interleaved with template text or
     linked-inputs/placeholders.

7. **Placeholder position and content**: HTML contains placeholders (rendered
   as `<a>` tags wrapping user-filled values like vessel names, company names,
   dates, amounts). In XML these become `<linked-input>` elements. Verify:
   - Each placeholder's text content matches between HTML and XML
   - Placeholders appear **in the same position** relative to surrounding
     text. For example, if HTML reads "Between Messrs. OWNERS, Address"
     where OWNERS is a placeholder, the XML must also read
     "Between Messrs. {OWNERS placeholder}, Address" — not
     "Between Messrs. , Address {OWNERS placeholder}"
   - Placeholders must not be displaced by adjacent text additions being
     incorrectly merged or reordered around them

8. **Addition placement within template text**: When an addition (from
   orv2entries.json) is inserted into the middle of a template sentence,
   verify it appears at the correct position within that sentence.
   For example, if HTML shows "at the rate of [ADDITION: see also Clause 36]
   commencing on and from", the XML must place the addition between
   "rate of" and "commencing", not elsewhere in the clause.
   - Cross-reference the `start` position in orv2entries.json with where
     the addition actually appears in the XML text flow
   - Multiple additions on the same ORI node must appear in their correct
     relative positions within the parent text

9. **Deletion completeness**: For content marked as deleted in the HTML
   (elements with data-change-type="deletion"), verify:
   - The deleted text does NOT appear in the XML output as regular content
   - Corresponding orv2entries with value=null should exist
   - If deleted text still appears in XML without being wrapped in a
     deletion marker, report as ERROR

10. **Duplicate content**: Check that the same text content does not appear
    twice in the XML when it only appears once in the HTML. This can happen
    when additions are incorrectly applied to multiple ORI nodes, or when
    template text is duplicated during migration.

## What to IGNORE (do NOT report these)

1. **Line numbers**: HTML may contain line numbers like "001", "002", etc.
   XML does not have these. This is expected — ignore completely.

2. **Line wrapping / text flow**: The same text may be structured differently
   in HTML vs XML. As long as the text content is the same, ignore layout.

3. **Whitespace & formatting**: Extra spaces, different indentation,
   trailing spaces, blank lines — all irrelevant.

4. **Punctuation variants**: Dash (-) vs em-dash (–), straight quotes
   vs curly quotes, and similar typographic differences — ignore.

5. **Template boilerplate**: XML will contain template text that HTML
   doesn't have (headers, copyright, document description). This is normal.

6. **Tag/element name differences**: HTML uses <p>, <span>, <table> while
   XML uses <chapter>, <paragraph>, <grid>. The tag names don't matter —
   focus on TEXT CONTENT and its structural placement.

7. **Attribute differences**: Beyond ori, other attributes may differ. Ignore.

## Output Format

Return your analysis in this EXACT format:

STATUS: PASS | WARN | FAIL
CHANGES_APPLIED: {N inserts}, {N deletes} (count from orv2entries.json)
ERRORS: {count}
WARNINGS: {count}

FINDINGS:
- [ERROR] {description} | HTML: "{text snippet}" | XML: "{text or MISSING}"
- [WARNING] {description} | Context: "{surrounding text}"

SUMMARY: {1-2 sentence overall assessment}

If no issues found:

STATUS: PASS
CHANGES_APPLIED: {N inserts}, {N deletes}
ERRORS: 0
WARNINGS: 0

FINDINGS: None

SUMMARY: Migration preserved all document content correctly.
All changes from orv2entries.json are properly reflected in the XML output.

## Rules
- Read ALL three files completely before making any judgement
- Be thorough — scan the ENTIRE document, not just the beginning
- When in doubt between ERROR and WARNING, use WARNING
- Focus on CONTENT, not formatting/structure
- Do NOT just check presence/absence of each insert independently.
  Also verify that adjacent content appears in the SAME ORDER as in
  the HTML source. Read the XML like a human would (left-to-right,
  top-to-bottom) and compare against the HTML reading order.
- Pay extra attention to placeholders (`<linked-input>` in XML, `<a>` in HTML):
  they must appear at the same position in the text flow, with the same content.
  A displaced placeholder is an ERROR even if the text is technically "present".
- For each line/clause in XML that contains additions, reconstruct the full
  reading text and compare it against the HTML reading text for that same line.
  This catches additions placed at wrong positions within a sentence.
- Check for text that appears in XML but was marked as deleted in HTML —
  deleted content leaking into output is an ERROR.
- Do NOT output anything except the format above

---

## Step 4: Collect Results and Print Report

After all subagents complete, parse their outputs and print this consolidated report:

```markdown
# Migration Analysis Report

**Document type**: {name}
**Files analyzed**: {N}
**Overall status**: PASS | WARN | FAIL  (FAIL if any file FAILs; WARN if any WARNs but no FAILs)

| File | Status | Changes | Errors | Warnings |
|------|--------|---------|--------|----------|
| {filename} | PASS | {N inserts}, {N deletes} | 0 | 0 |
| {filename} | WARN | {N inserts}, {N deletes} | 0 | {N} |

---

## {filename} — {STATUS}

{SUMMARY from subagent}

{FINDINGS section if not empty}

---
```

Print "---" separator between files. For PASS files with no findings, just print the summary line.

## Rules

- Process all files even if some fail — never abort early
- Each file gets its own `tmp/analysis/{name}/{stem}/` directory
- Launch ALL subagents in parallel after ALL files are processed
- Overall status: FAIL if any file fails migration or analysis; WARN if any warnings; PASS otherwise
- If migration failed for a file, show status as MIGRATION_FAILED in the table
