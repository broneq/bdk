---
schema: 1
id: "02"
title: Export button on the operator page
goal: Operators download the current audit page as CSV from the operator page.
success-measure: The operator page tests pass, and `tsc -b` and `eslint` are clean.
do-not-touch: ["src/api/**", "package.json", "package-lock.json"]
depends-on: ["01"]
spec-impact: none
---

## 02-1 Export CSV button

Add a button with the accessible name `Export CSV` to the audit table controls of `OperatorPage` (the toolbar labelled `Audit table controls`). Its label comes from a new message key `ui.operator.export-csv` with the default text `Export CSV` in `UI_MESSAGES`, rendered with `t()`.

- The button is disabled while the audit rows load, when they failed to load, and when the current page has no rows.
- It is enabled when the current page has at least one row.

**Files:**

- `src/operator/OperatorPage.tsx`
- `src/operator/OperatorPage.test.tsx`
- `src/i18n/messages.ts`

**Test cases:**

- the button is enabled once a page with rows has loaded
- the button is disabled for an empty page
- the button is disabled when the audit request fails

## 02-2 Download the current page

Clicking `Export CSV` downloads the rows of the current page as CSV, without a new request to the backend.

- The content is `toAuditCsv` of the current page's rows, in a `Blob` of type `text/csv;charset=utf-8`.
- The browser downloads it through `URL.createObjectURL`: an `<a>` element with that URL as `href` and `download` set to `auditCsvFilename` of the query's target type, action, actor login and page, with the current date, is clicked.
- The object URL is released with `URL.revokeObjectURL` after the click.

**Files:**

- `src/operator/OperatorPage.tsx`
- `src/operator/OperatorPage.test.tsx`

**Test cases:**

- clicking downloads a CSV Blob whose text is the current page's rows
- the download name carries the URL filters and the one-based page
- the object URL is revoked after the click
- clicking makes no further audit request
