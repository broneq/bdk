# Task shape

A task tells the worker what must be true when it is done, never how to write it. The worker reads only its own task, the decisions and blockers the package names, and the code, so everything it needs to build the right thing is in the task text.

## A worked part

```markdown
---
schema: 1
id: "01"
title: Audit CSV helpers
goal: Pure helpers that turn audit rows into CSV text and name the exported file.
success-measure: The helpers' unit tests pass and the type check and lint are clean.
do-not-touch: ["src/api/**", "package.json", "package-lock.json"]
depends-on: []
spec-impact: none
---

## 01-1 Audit rows as CSV text

Add `toAuditCsv(entries: readonly AuditLog[]): string` to a new module `src/operator/auditCsv.ts` (`AuditLog` from `src/api/operator.ts`).

- The first line is the header `id,createdAt,targetType,targetId,action,actorLogin,summary`; then one line per entry, in input order, with the fields in header order.
- Every line, the last one included, ends with `\r\n`. No entries give the header line only.
- A missing field is an empty value.
- A text field that starts with `=`, `+`, `-` or `@` gets a leading `'`, so a spreadsheet does not run it as a formula.
- A value that contains a comma, a double quote, `\r` or `\n` is wrapped in double quotes, each inner double quote doubled.

**Files:**

- Create: `src/operator/auditCsv.ts`
- Create: `src/operator/auditCsv.test.ts`

**Test cases:**

- no entries give exactly `id,createdAt,targetType,targetId,action,actorLogin,summary\r\n`
- two entries give three lines in input order, each ending with `\r\n`
- an entry without `summary` ends its line with `,\r\n`
- a summary `a,"b"` is written as `"a,""b"""`
- a summary `=SUM(A1)` is written as `'=SUM(A1)`

**Stop rule:** stop and return `blocked` if `AuditLog` lacks one of the header fields.
```

What makes it work:

- The signature, the module path and the exact output format are fixed, because another task (the export button) consumes them.
- Each behaviour sentence has a test case, and each case names an input and the exact result.
- No function body: the worker chooses how to build the string.

## Test cases that name topics

These leave the result to the worker, so two workers write two different behaviours and both pass:

- test the header
- test quoting
- handle missing fields

Rewrite each as an input and the result it must give, as in the part above.

## Code in a task

A fenced block is right only for an exact external format that words would describe ambiguously: a JSON payload on the wire, a file layout, a command line. A function body in a task goes stale as soon as an earlier task turns out differently, and it invites a test written to fit it.
