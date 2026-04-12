# Debug Response: PDF Footer Shows "0 of 0" Page Numbers

## Assessment

This bug report describes a PDF export feature with a footer page numbering issue. After searching the codebase (`src/`), there is no PDF export functionality, report export pipeline, or footer page-number rendering logic in this repository. This project is a document migrator (Froala HTML to XML), not a reporting application with PDF export.

**The bug report does not match this codebase.**

---

## What the Bug Description Tells Us

The symptom — footer showing `0 of 0` — is a well-known class of PDF generation bug. Without knowing the actual codebase, here are the most likely root causes:

### 1. Page count computed before rendering completes (most common)

PDF libraries like WeasyPrint, ReportLab, or browser-based tools (Puppeteer/wkhtmltopdf) require a two-pass rendering approach:
- **Pass 1:** Lay out content to know how many pages exist
- **Pass 2:** Inject total page count into headers/footers

If the footer is injected before Pass 1 completes, `total_pages` is still `0`.

**Fix:** Use the library's built-in late-binding mechanism (e.g., WeasyPrint `@page` CSS rules, ReportLab `canvas.getPageNumber()` + `canvas.saveState()`/deferred drawing, or Puppeteer `--display-header-footer` with `<span class="totalPages">`).

### 2. Placeholder variable never substituted

The footer template may contain placeholders like `{{page}}` / `{{total}}` or `{page_number}` / `{total_pages}` that are being rendered as literal text `0` because:
- The substitution step is skipped
- The wrong variable name is used
- The footer template is constructed after serialization

**Fix:** Verify the template variable names match what the PDF renderer injects. Check whether the substitution function is actually called on the footer string.

### 3. JavaScript-based page counter not executing

If the PDF is generated via headless browser (Puppeteer, Playwright, wkhtmltopdf), the page counter may rely on JavaScript or CSS counters that don't execute in the headless context.

**Fix:** For Puppeteer, use the native `headerTemplate`/`footerTemplate` with the `.pageNumber` and `.totalPages` CSS classes — these are substituted by Chrome's PDF engine, not JavaScript.

### 4. Off-by-one or zero-indexed page counter

The current page index may be zero-based but displayed without +1, causing page 1 to show as `0`.

**Fix:** Ensure `current_page + 1` is used when displaying to users.

---

## Information Needed to Diagnose Further

The bug report is too vague to pinpoint the exact cause without:

1. **Which PDF library is used?** (WeasyPrint, ReportLab, wkhtmltopdf, Puppeteer, Prince, etc.)
2. **Where is the footer template defined?** (HTML template, Python code, CSS `@page` rule?)
3. **Is this reproducible on single-page reports too?** (Helps distinguish "total pages = 0" vs "current page = 0")
4. **Any error logs from the export process?**
5. **Does this affect all reports or only specific ones?**

---

## Recommended Next Steps

1. Locate the PDF export code path (`Reports > Export > PDF` handler)
2. Find where footer content is constructed and where page numbers are injected
3. Add logging to capture `current_page` and `total_pages` values at the point of footer rendering
4. Check the PDF library's documentation for its two-pass / late-binding page count API
5. Write a regression test with a known multi-page report that asserts footer content

---

## Note on This Codebase

This repository (`or-migrator`) is a document format migrator (Froala HTML to OR 2.0 XML). It does not contain a report export feature or PDF generation pipeline. If this bug was reported against this project, it may have been filed against the wrong repository.
