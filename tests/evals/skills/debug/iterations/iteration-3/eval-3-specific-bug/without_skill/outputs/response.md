# Debug Response: PDF Export Footer Shows "0 of 0" Page Numbers

## Investigation Summary

After searching the codebase at `/Users/przemyslawbroniszewski/PycharmProjects/or-migrator`, this repository is a **Python data migration tool** for transforming Charter Party documents from OR 1.0 (Froala HTML) to OR 2.0 (XML format). It does not contain any PDF export functionality, reporting features, or page numbering logic.

The bug described — "footer shows page '0 of 0' instead of correct page numbers when exporting to PDF from Reports > Export > PDF" — **does not apply to this codebase**.

## What This Codebase Does

- Stack: Python 3.13, Typer CLI, BeautifulSoup4, lxml
- Purpose: Migrates HTML documents with tracked changes to XML
- No web frontend, no reporting module, no PDF generation

## General Diagnosis for This Type of Bug

If this bug exists in a different codebase, the most common root causes for "0 of 0" in PDF footer page numbers are:

### 1. Pagination calculated before render completes
The total page count (`of 0`) is computed before the PDF renderer has laid out all pages. The footer template references a total-pages variable that is resolved at layout start rather than after full pagination.

**Fix pattern**: Use a two-pass rendering approach — first pass lays out all content and counts pages, second pass injects the correct total into the footer.

### 2. Wrong variable reference in footer template
The footer template uses a variable name like `{{totalPages}}` or `{page_count}` that is never populated, defaulting to `0`.

**Fix pattern**: Verify the variable name matches exactly what the PDF library exposes. Common libraries (WeasyPrint, ReportLab, wkhtmltopdf) each have different APIs:
- WeasyPrint: `@page` CSS with `counter(pages)`
- ReportLab: `canvas.setPageCount()` or `doc.multiBuild()`
- wkhtmltopdf: `[topage]` substitution variable (not `{total_pages}`)

### 3. wkhtmltopdf header/footer variables not substituted
If using wkhtmltopdf, footer variables require the `--footer-html` flag and the HTML must use the exact tokens `[page]` and `[topage]`. Any JavaScript-based page count will show `0` unless `--enable-javascript` and `--javascript-delay` flags are set.

**Fix pattern**:
```html
<!-- footer.html -->
<span>Page <span class="page"></span> of <span class="topage"></span></span>
<script>
  var vars = {};
  var query = window.location.search.substring(1).split('&');
  for (var i = 0; i < query.length; i++) {
    var pair = query[i].split('=');
    vars[pair[0]] = decodeURIComponent(pair[1]);
  }
  document.querySelector('.page').textContent = vars.page;
  document.querySelector('.topage').textContent = vars.topage;
</script>
```

### 4. ReportLab: missing `multiBuild` for total page count
ReportLab's `build()` does not support forward-references to total page count. You must use `multiBuild()` with a `PageNumCanvas` class.

**Fix pattern**:
```python
class PageNumCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)
```

## Recommended Next Steps

1. Identify which PDF library is used in the actual reporting codebase
2. Search for footer template files or page number rendering code
3. Check whether `totalPages` / `[topage]` / total page count variable is populated before or after full pagination
4. Apply the two-pass or library-specific fix above

## Note

This investigation found no relevant code in the `or-migrator` repository. Please point to the correct repository or codebase that handles the Reports > Export > PDF feature.
