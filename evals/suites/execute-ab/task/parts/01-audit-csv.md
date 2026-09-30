---
schema: 1
id: "01"
title: Audit CSV helpers
goal: Pure helpers that turn audit rows into CSV text and name the exported file.
success-measure: The helpers' unit tests pass and `tsc -b` and `eslint` are clean.
do-not-touch: ["src/api/**", "package.json", "package-lock.json"]
depends-on: []
spec-impact: none
---

## 01-1 Audit rows as CSV text

Add `toAuditCsv(entries: readonly AuditLog[]): string` to a new module `src/operator/auditCsv.ts` (`AuditLog` from `src/api/operator.ts`).

- The first line is the header `id,createdAt,targetType,targetId,action,actorLogin,summary`; then one line per entry, in input order, with the fields in header order.
- Every line, the last one included, ends with `\r\n`. No entries give the header line only.
- A missing field is an empty value; numbers are written in decimal.
- A text field that starts with `=`, `+`, `-` or `@` gets a leading `'`, so a spreadsheet does not run it as a formula.
- A value that contains a comma, a double quote, `\r` or `\n` is wrapped in double quotes, with each double quote inside doubled.

**Files:**

- `src/operator/auditCsv.ts`
- `src/operator/auditCsv.test.ts`

**Test cases:**

- header line only for no entries
- one line per entry in header order, each ending with CRLF
- missing fields are empty values
- values with a comma, a double quote or a line break are quoted, inner quotes doubled
- a summary starting with `=` gets a leading single quote

## 01-2 File name of the export

Add `auditCsvFilename(filters: AuditCsvFilters, now: Date): string` and the exported type `AuditCsvFilters = { targetType?: string; action?: string; actorLogin?: string; page: number }` to `src/operator/auditCsv.ts`.

- The name is `audit-log-<YYYY-MM-DD>`, the UTC date of `now`, followed by `-<targetType>` and `-<action>` in lower case when set, then `-<actor>` when `actorLogin` gives a non-empty slug, then `-page-<page + 1>` and `.csv`. `page` is zero-based.
- The actor slug is `actorLogin` in lower case with every run of characters outside `a-z` and `0-9` replaced by one `-`, and leading and trailing `-` removed.
- Empty strings count as unset.

**Files:**

- `src/operator/auditCsv.ts`
- `src/operator/auditCsv.test.ts`

**Test cases:**

- no filters on page 0 gives `audit-log-2026-03-04-page-1.csv` for 2026-03-04
- the date is the UTC date near midnight
- target type and action are added in lower case, in that order
- the actor login is slugged; a login with no letters or digits is left out
