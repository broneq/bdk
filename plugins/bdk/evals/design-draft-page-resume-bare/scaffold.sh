#!/usr/bin/env bash
set -euo pipefail
# The ledger-explored fixture with the lavish-axi stub of design-draft-lavish,
# plus round 1's page from an earlier run that broke off before the answers:
# its cards hold only a question and radio options (the page of #409).
bash "$(dirname "$0")/../design-draft-lavish/scaffold.sh"
mkdir -p .lavish
cat > .lavish/design-add-csv-export.html <<'HTML'
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Design questions: add-csv-export</title></head>
<body>
<h1>add-csv-export: open decisions</h1>
<form data-lavish-question="delimiter" onsubmit="event.preventDefault(); const v = new FormData(event.currentTarget).get('delimiter'); if (v) window.lavish.queuePrompt('CSV delimiter: ' + v, { tag: 'choice', element: event.currentTarget, data: { question: 'delimiter', answer: v } });">
  <h2>1. CSV delimiter?</h2>
  <label><input type="radio" name="delimiter" value="comma" checked> Comma</label>
  <label><input type="radio" name="delimiter" value="semicolon"> Semicolon</label>
  <textarea name="note" placeholder="Note"></textarea>
  <button type="submit">Queue answer</button>
</form>
<form data-lavish-question="amount" onsubmit="event.preventDefault(); const v = new FormData(event.currentTarget).get('amount'); if (v) window.lavish.queuePrompt('Amount format: ' + v, { tag: 'choice', element: event.currentTarget, data: { question: 'amount', answer: v } });">
  <h2>2. Amount format?</h2>
  <label><input type="radio" name="amount" value="decimal" checked> Decimal</label>
  <label><input type="radio" name="amount" value="cents"> Cents</label>
  <textarea name="note" placeholder="Note"></textarea>
  <button type="submit">Queue answer</button>
</form>
</body>
</html>
HTML
