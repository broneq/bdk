# Debug Session: Date Format Bug in Report Formatters

Using debug to investigate the issue.

## Phase 1: Parse Input

```
[debug] Issue: All four report formatters output dates in MM/DD/YYYY format instead of ISO 8601 (YYYY-MM-DD)
[debug] Signals: error=none (wrong output format), component=CsvFormatter/XmlFormatter/JsonFormatter/HtmlFormatter, _format_date method
```

## Phase 2: Investigate

**SIMULATED: Searching for formatter files**

Found four formatter files:
- `src/data_migrator/reports/formatters/csv_formatter.py` — `CsvFormatter._format_date` at line ~45
- `src/data_migrator/reports/formatters/xml_formatter.py` — `XmlFormatter._format_date` at line ~52
- `src/data_migrator/reports/formatters/json_formatter.py` — `JsonFormatter._format_date` at line ~38
- `src/data_migrator/reports/formatters/html_formatter.py` — `HtmlFormatter._format_date` at line ~61

Each contains the identical pattern:
```python
def _format_date(self, date: date) -> str:
    return date.strftime('%m/%d/%Y')
```

**SIMULATED: Checking existing tests**

Existing test file: `tests/unit/reports/formatters/test_formatters.py` — contains tests for each formatter but none specifically asserting the date format output.

```
[debug] Root cause: Each of the four formatter classes independently calls date.strftime('%m/%d/%Y') in its own _format_date method, producing US-format dates instead of ISO 8601
[debug] Affected:
  src/data_migrator/reports/formatters/csv_formatter.py:45
  src/data_migrator/reports/formatters/xml_formatter.py:52
  src/data_migrator/reports/formatters/json_formatter.py:38
  src/data_migrator/reports/formatters/html_formatter.py:61
[debug] Test gaps found: 4 — no existing tests assert the date format output for any of the four formatters
```

## Phase 3: Write Failing Tests

Each test passes a known date and asserts ISO 8601 output. These will be RED until the fix is applied.

```python
# tests/unit/reports/formatters/test_formatters.py

import datetime
import pytest
from data_migrator.reports.formatters.csv_formatter import CsvFormatter
from data_migrator.reports.formatters.xml_formatter import XmlFormatter
from data_migrator.reports.formatters.json_formatter import JsonFormatter
from data_migrator.reports.formatters.html_formatter import HtmlFormatter


# Primary bug: _format_date returns MM/DD/YYYY instead of ISO 8601

def test_csv_formatter_format_date_returns_iso8601() -> None:
    formatter = CsvFormatter()
    result = formatter._format_date(datetime.date(2024, 3, 15))
    assert result == "2024-03-15", f"Expected ISO 8601, got: {result}"


def test_xml_formatter_format_date_returns_iso8601() -> None:
    formatter = XmlFormatter()
    result = formatter._format_date(datetime.date(2024, 3, 15))
    assert result == "2024-03-15", f"Expected ISO 8601, got: {result}"


def test_json_formatter_format_date_returns_iso8601() -> None:
    formatter = JsonFormatter()
    result = formatter._format_date(datetime.date(2024, 3, 15))
    assert result == "2024-03-15", f"Expected ISO 8601, got: {result}"


def test_html_formatter_format_date_returns_iso8601() -> None:
    formatter = HtmlFormatter()
    result = formatter._format_date(datetime.date(2024, 3, 15))
    assert result == "2024-03-15", f"Expected ISO 8601, got: {result}"
```

**SIMULATED: Writing tests to file and running them**

```
[debug] Running failing tests...
```

**SIMULATED test-runner result:**

```
FAILED tests/unit/reports/formatters/test_formatters.py::test_csv_formatter_format_date_returns_iso8601
  AssertionError: Expected ISO 8601, got: 03/15/2024

FAILED tests/unit/reports/formatters/test_formatters.py::test_xml_formatter_format_date_returns_iso8601
  AssertionError: Expected ISO 8601, got: 03/15/2024

FAILED tests/unit/reports/formatters/test_formatters.py::test_json_formatter_format_date_returns_iso8601
  AssertionError: Expected ISO 8601, got: 03/15/2024

FAILED tests/unit/reports/formatters/test_formatters.py::test_html_formatter_format_date_returns_iso8601
  AssertionError: Expected ISO 8601, got: 03/15/2024

4 failed, 0 passed
```

```
[debug] Failing tests confirmed: 4 red
[debug] Gap tests confirmed: 0 (all 4 primary tests already cover the identified gaps)
```

## Phase 4: Propose Solution & Confirm

**Proposed solution:**

In each of the four formatter files, replace the `_format_date` method body:

```python
# Before (in all four formatters):
def _format_date(self, date: date) -> str:
    return date.strftime('%m/%d/%Y')

# After:
def _format_date(self, date: date) -> str:
    return date.isoformat()
```

- **Files changed:** `csv_formatter.py`, `xml_formatter.py`, `json_formatter.py`, `html_formatter.py`
- **Why it fixes it:** `date.isoformat()` always returns `YYYY-MM-DD` per the Python standard library, regardless of locale.
- **Risks:** None — `isoformat()` is stable, has no dependencies, and the change is self-contained in each formatter.

**Complexity assessment: LOW**

This is the same mechanical one-line substitution (`strftime('%m/%d/%Y')` → `isoformat()`) repeated independently in 4 sibling classes. Each formatter is self-contained. If one is changed incorrectly, only that formatter breaks — not the others. There are no shared abstractions affected, no data models changed, no call-site cascades.

**[SIMULATED AskUserQuestion — would print in conversation:]**

> The fix is straightforward: replace `date.strftime('%m/%d/%Y')` with `date.isoformat()` in `_format_date` across all four formatters. Complexity: **LOW** (same mechanical one-liner in 4 independent sibling classes — if one breaks, only that formatter is affected).
>
> What would you like to do?
> 1. **Fix now** — apply the change to all four files in this session
> 2. **Create plan** — hand off to `/create-plan` with failing tests as acceptance criteria
> 3. **Something else** — reconsider approach or investigate further

**[SIMULATED: User chooses "Fix now"]**

**Applying the fix:**

**SIMULATED edits to all four formatter files:**

```python
# csv_formatter.py line 45 — before:
return date.strftime('%m/%d/%Y')
# after:
return date.isoformat()

# xml_formatter.py line 52 — before:
return date.strftime('%m/%d/%Y')
# after:
return date.isoformat()

# json_formatter.py line 38 — before:
return date.strftime('%m/%d/%Y')
# after:
return date.isoformat()

# html_formatter.py line 61 — before:
return date.strftime('%m/%d/%Y')
# after:
return date.isoformat()
```

**SIMULATED: Running the failing tests after fix**

```
[debug] Running failing tests...
```

**SIMULATED test-runner result:**

```
PASSED tests/unit/reports/formatters/test_formatters.py::test_csv_formatter_format_date_returns_iso8601
PASSED tests/unit/reports/formatters/test_formatters.py::test_xml_formatter_format_date_returns_iso8601
PASSED tests/unit/reports/formatters/test_formatters.py::test_json_formatter_format_date_returns_iso8601
PASSED tests/unit/reports/formatters/test_formatters.py::test_html_formatter_format_date_returns_iso8601

4 passed, 0 failed
```

All 4 tests GREEN.

**SIMULATED: Running static analysis**

```
[debug] Running bin/cleanup.sh...
```

**SIMULATED static-analysis result:**

```
ruff check src/ — no issues
ruff format . — no changes
mypy src/ — Success: no issues found
Maintainability Index: all files A-grade
Cyclomatic Complexity: all functions A-grade
```

No linting or type errors introduced.

## Phase 5: Verify

Walking through the steps-to-reproduce against the fixed code:

- "Generate any report" → report generation calls each formatter's `_format_date`
- `_format_date` now calls `date.isoformat()` → returns `"2024-03-15"` (YYYY-MM-DD)
- Date columns in all report formats now show ISO 8601 regardless of locale settings ✓

```
[debug] Done.

  Root cause:   Each formatter had its own _format_date calling strftime('%m/%d/%Y'), always producing US-format dates
  Tests added:  4 (primary — one per formatter, covering the date format output) + 0 (gaps)
  Fix path:     inline fix (strftime('%m/%d/%Y') → isoformat() in 4 independent sibling methods)
  Status:       all tests GREEN

  Next steps:
    - Review changes before committing
    - Run full test suite if architectural areas were touched
```
