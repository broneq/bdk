# FixtureBuilder API Reference

The `FixtureBuilder` factory auto-detects the HTML format (Froala or SEA) and returns the appropriate builder.

## Quick Start

```python
import sys
sys.path.insert(0, ".claude/skills/create-fixture/scripts")
from fixture_builder import FixtureBuilder

b = FixtureBuilder.from_template("tests/fixtures/sea/nype46/template.html")

b.fill_placeholder("cke_36_df_0", "MV PASIR GUDANG")
b.delete("Steamship/Motorship")
b.replace("2 1/2", "3.75")
b.insert_after("in ballast", ", trimmed")

b.save("document_gen_negotiated_pasir-gudang.html")
```

Run from the **project root**:
```bash
.venv/bin/python tmp_my_fixture.py
```

---

## `FixtureBuilder.from_template(path)`

Returns a `SEAFixtureBuilder` or `FroalaFixtureBuilder` depending on the template format.

| Argument | Type | Description |
|----------|------|-------------|
| `path` | `str` | Path to `template.html`, relative to the project root |

Raises `ValueError` if the format cannot be detected.

---

## Methods (both formats)

### `fill_freetextfield(index, value)`

Fills the Nth free-text field in the document (1-based index).

- **SEA only**: finds the Nth `<freetextfield>` element and replaces its content with `value`
- Froala documents do not have freetextfields; calling this on a Froala builder raises `ValueError`

```python
b.fill_freetextfield(1, "12 months")
b.fill_freetextfield(2, "Rotterdam")
```

The index is the ordinal position of the `<freetextfield>` element in the template HTML. Use `grep -c '<freetextfield'` on the template to count total fields; inspect the template to identify which field is which.

Raises `ValueError` if the index is out of range (no Nth freetextfield found).

---

### `fill_placeholder(placeholder_id, value)`

Fills an empty placeholder anchor with the given value.

- **Froala**: finds `<a data-recap-id="<id>"></a>` and appends an addition span after it
- **SEA**: finds `<dfplaceholder id="<id>">` and inserts the value inside

```python
b.fill_placeholder("cke_36_df_0", "MV BALTIC PIONEER")
b.fill_placeholder("cke_42_df_1", "Rotterdam, Netherlands")
```

The placeholder ID comes from the template. Use `grep 'data-recap-id'` (Froala) or `grep 'id="cke_'` (SEA) on the template to discover available IDs.

Raises `ValueError` if the ID is not found.

---

### `delete(text)`

Wraps the **first** occurrence of `text` in deletion markup.

```python
b.delete("Steamship/Motorship")
b.delete("excluding overtime")
```

**The text must exist verbatim in the template HTML.** This method searches the raw HTML string — if the text appears as `&amp;` in HTML but you pass `&`, it will not be found. Always verify with grep before calling:

```bash
grep -o "Steamship/Motorship" tests/fixtures/sea/nype46/template.html
```

Raises `ValueError` if the text is not found, with a hint about encoding differences.

---

### `replace(old, new)`

Replaces the **first** occurrence of `old` with a deletion+insertion pair.

```python
b.replace("2 1/2", "3.75")
b.replace("hire payable monthly", "hire payable semi-monthly")
```

Same verbatim-match rule as `delete()`. The `old` text must exist in the template.

Raises `ValueError` if `old` is not found.

---

### `insert_after(anchor, text)`

Inserts an addition span immediately after the **first** occurrence of `anchor`.

```python
b.insert_after("in ballast", ", trimmed")
b.insert_after("always within IWL", "/INL")
```

The `anchor` must exist in the HTML (can be any substring — a word, phrase, or closing tag). The new `text` is freely invented.

Raises `ValueError` if `anchor` is not found.

---

### `save(filename)`

Writes the fixture file, sets `data-or-legacy-html="true"` on the root element, and runs the validator.

```python
b.save("document_gen_negotiated_nordic-star-china.html")
```

The file is saved in the **same directory as `template.html`**.

Raises `ValueError` if:
- No changes were applied (forgot to call any operation methods)
- The validator finds structural errors in the generated HTML

---

## Error Handling

Operation methods (`delete`, `replace`, `fill_placeholder`, `fill_freetextfield`, `insert_after`) **do not raise immediately** on failure. Errors are collected and all reported together when `save()` is called. This means the LLM sees every problem in one shot instead of one at a time.

```python
b.delete("wrong text one")    # records error, continues
b.delete("wrong text two")    # records error, continues
b.fill_placeholder("bad_id", "x")  # records error, continues
b.save("out.html")
# raises ValueError:
#   3 operation(s) failed:
#     [1] delete("wrong text one"): text not found in template (hint: check &amp; vs & encoding)
#     [2] delete("wrong text two"): text not found in template (hint: check &amp; vs & encoding)
#     [3] fill_placeholder("bad_id"): id not found in template
```

| Error | Cause | Fix |
|-------|-------|-----|
| `delete(...): text not found` | Text not in template, or HTML-encoded differently | Run `grep -o` on template; check `&amp;` vs `&` |
| `fill_placeholder(...): id not found` | Wrong ID or placeholder not in template | Run `grep 'data-recap-id\|id="cke_'` on template |
| `fill_freetextfield(...): index not found` | Index exceeds number of freetextfields in template | Run `grep -c '<freetextfield'` on template to count fields |
| `no changes applied` | `save()` called before any operations | Add at least one `delete/replace/fill_placeholder/insert_after` call |
| `Validation failed` | Generated HTML has structural problems | Read the validator output and fix the operation that caused it |

---

## Format Details

### Froala format
- Deletions: `<span class="fr-tracking-deleted" data-change-type="deletion" data-timestamp="..." data-identifier="..." data-user="...">text</span>`
- Insertions: `<span class="fr-highlight-change" data-change-type="addition" ...>text</span>`
- Placeholders: `<a data-recap-id="..." data-recap-type="addition"></a>` → addition span appended after

### SEA/ICE format
- Deletions: `<del class="ice-del ice-cts-1 cpm-change-previous" data-cid="..." data-time="..." ...>text</del>`
- Insertions: `<ins class="ice-ins ice-cts-1 cpm-change-previous" data-cid="..." data-time="..." ...>text</ins>`
- Placeholders: `<dfplaceholder id="...">` → value inserted inside tag

All IDs, timestamps, and UUIDs are generated automatically by the builder.
