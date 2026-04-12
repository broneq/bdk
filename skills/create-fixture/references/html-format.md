# HTML Format Reference for Fixture Generation

Quick reference for generating valid OR V1 (Froala) and SEA fixture documents.
Read specific sections as needed — don't load the whole file.

## Table of Contents
- [§1 Format Detection](#1-format-detection)
- [§2 Froala Document Wrappers](#2-froala-document-wrappers)
- [§3 Froala Tracked Changes](#3-froala-tracked-changes)
- [§4 Froala Placeholders](#4-froala-placeholders)
- [§5 SEA Document Wrapper](#5-sea-document-wrapper)
- [§6 SEA Tracked Changes](#6-sea-tracked-changes)
- [§7 SEA Placeholders](#7-sea-placeholders)
- [§8 SEA Freetextfields](#8-sea-freetextfields)
- [§9 Metadata Rules](#9-metadata-rules)

---

## §1 Format Detection

Read the first 20 lines of `template.html`:

| Signal in HTML | Format | Sub-type hint |
|----------------|--------|---------------|
| `fr-element fr-view` | **Froala** | check table/paragraph structure |
| `no-borders outside-margins` | Froala nype46 | 3-col table, Times New Roman |
| `no-borders` (without outside-margins) | Froala nype81/2015/93-lo | 2-col table, Roboto |
| `<section` with `<p` content | Froala nype93/gencon1994 | paragraph-based |
| `cpm-main-clause` or `cp-editable-line` | **SEA** | CKEditor+ICE |

---

## §2 Froala Document Wrappers

### nype46 — 3-column table, Times New Roman 7.7pt
```html
<link rel="stylesheet" href="../../orv1.css">
<div class="fr-element fr-view" dir="auto" contenteditable="true"
     aria-disabled="false" spellcheck="true" data-or-legacy-html="true">
  <table class="no-borders outside-margins"
         style="width: 100%; line-height: 1; font-family: 'Times New Roman', Times, serif, -webkit-standard; font-size: 7.7pt; border: none;">
    <thead style="visibility: collapse;">
      <tr>
        <th colspan="1" scope="col" style="width:7%;"><br></th>
        <th colspan="1" scope="col" style="width:5%;"><br></th>
        <th colspan="1" scope="col" style="width:88%;"><br></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="vertical-align: top;" colspan="1"><span>&nbsp;</span></td>
        <td class="line-number" data-is-line-number="true" colspan="1"><span>1</span></td>
        <td style="vertical-align: top;">
          <!-- content here -->
        </td>
      </tr>
    </tbody>
  </table>
</div>
```
Line numbers: plain integers `1`, `58`, `290` (no padding).

### nype81 / nype2015 — 2-column table, Roboto
```html
<link rel="stylesheet" href="../../orv1.css">
<div class="fr-element fr-view" dir="auto" contenteditable="true"
     aria-disabled="false" spellcheck="true" data-or-legacy-html="true">
  <span class="fr-marker" data-id="0" data-type="false" style="display: none; line-height: 0;">​</span>
  <span class="fr-marker" data-id="0" data-type="true" style="display: none; line-height: 0;">​</span>
  <table class="no-borders"
         style="width:100%; font-family: 'roboto', sans-serif, -webkit-standard; font-size: 8.6pt; border: none;">
    <thead style="visibility: collapse;">
      <tr>
        <th colspan="1" scope="col" style="vertical-align: top; width:4%;"><br></th>
        <th colspan="1" scope="col" style="vertical-align: top; width:96%;"><br></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="line-number" data-is-line-number="true" rowspan="1" style="vertical-align: top;">
          <span>001</span>
        </td>
        <td>
          <!-- content here -->
        </td>
      </tr>
    </tbody>
  </table>
</div>
```
Line numbers: zero-padded 3-digit `001`, `058`, `290`.

### nype93 — paragraph-based (section + p)
```html
<link rel="stylesheet" href="../../orv1.css">
<div class="fr-element fr-view" dir="auto" contenteditable="true"
     aria-disabled="false" spellcheck="true">
  <section style="font-family: 'roboto', sans-serif, -webkit-standard; font-size: 11pt; text-align: justify;">
    <p>THIS CHARTER PARTY, made and concluded in
      <!-- content here -->
    </p>
    <p><br/></p>
  </section>
</div>
```
No `data-or-legacy-html`. Empty lines: `<p><br/></p>`.

### gencon1994 — plain paragraphs + grid tables
```html
<link rel="stylesheet" href="../../orv1.css">
<div class="fr-element fr-view" dir="auto" contenteditable="true"
     aria-disabled="false" spellcheck="true">
  <p dir="ltr" style="text-align: center;"><strong>GENCON 1994</strong></p>
  <p><br></p>
  <!-- paragraph content -->
  <p>1. It is agreed between...</p>
</div>
```
No `data-or-legacy-html`. Empty lines: `<p><br></p>`.

---

## §3 Froala Tracked Changes

### Addition span
```html
<span data-timestamp="1765983998005"
      data-identifier="2e5744d4-0486-4244-ac16-861b1c957564"
      data-user="53b51b06-ca6e-4ad5-83a6-fd0a78fa76b1"
      data-change-type="addition"
      class="fr-highlight-change">new text</span>
```

### Deletion span
```html
<span data-timestamp="1765983998005"
      data-identifier="ffdfc4c8-7bf6-448d-8d97-5fe4325ac699"
      data-user="53b51b06-ca6e-4ad5-83a6-fd0a78fa76b1"
      data-change-type="deletion"
      class="fr-tracking-deleted">old text</span>
```

### Tracked line-break addition (nype81/nype2015 only)
```html
<br data-change-type="addition">
```

### Deletion + replacement pair (same line)
```html
<span ... data-change-type="deletion" class="fr-tracking-deleted">Steamship/Motor</span><span ... data-change-type="addition" class="fr-highlight-change">Motor Vessel</span>
```

### Deletion inside smart field (nype93/gencon)
```html
<a data-recap-type="addition" data-recap-id="last-dry-dock-(date)"
   contenteditable="false" data-change-type="addition" data-identifier="977183"
   name="smart-field" data-is-smart-field="true" class="fr-highlight-change">
  <span class="fr-highlight-change">
    <span data-timestamp="1765984002841" data-identifier="e021ecef-cc7a-4115-aed7-ba791f36b553"
          data-user="9d5432e9-8811-431b-83e6-d8fc21582f6a" data-change-type="deletion"
          class="fr-tracking-deleted">Last dry dock (date)</span>
  </span>
</a>
```

---

## §4 Froala Placeholders

### Empty placeholder (template slot — unfilled)
```html
<a data-recap-type="addition" data-recap-id="vessel-name" contenteditable="false"></a>
```

### Filled smart field (nype46/81 style — value in nearby addition span)
```html
<a data-recap-type="addition" data-recap-id="vessel-name" contenteditable="false"></a>
<span data-timestamp="1765983998010" data-identifier="3f6bdccb-e811-44f5-90fa-9b96f4c6b2b0"
      data-user="53b51b06-ca6e-4ad5-83a6-fd0a78fa76b1"
      data-change-type="addition" class="fr-highlight-change">MV NORDIC STAR</span>
```

### Filled smart field (nype93/gencon style — value inside anchor)
```html
<a data-recap-type="addition"
   data-recap-id="vessel-name"
   contenteditable="false"
   data-change-type="addition"
   data-identifier="898466"
   data-user="9d5432e9-8811-431b-83e6-d8fc21582f6a"
   data-timestamp="1762312904"
   name="smart-field"
   data-is-smart-field="true"
   class="fr-highlight-change">
  <span class="fr-highlight-change">MV NORDIC STAR</span>
</a>
```
Note: `data-timestamp` on smart-field `<a>` is 10 digits (seconds), not 13.

---

## §5 SEA Document Wrapper

```html
<div class="single-editor cpm-main-clause">
  <div class="inner-page">
    <table class="justified-form cke_show_border">
      <col column="1"><col column="2">
      <tbody>
        <tr line-number="1">
          <td>
            <cp-editable-line contenteditable="true"
                              content-order="1"
                              content-text-line-order="1"
                              class="cpm-cp-clause-line">
              <!-- content here -->
            </cp-editable-line>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

---

## §6 SEA Tracked Changes

### ICE-only (minimal, no CPM metadata)
```html
as Owners, and
<del class="ice-del ice-cts-1">Old Charterer Name Ltd.</del>
<ins class="ice-ins ice-cts-1">New Charterer Name Ltd.</ins>
```
Paired del+ins share same `ice-cts-N` value.

### CPM-layer deletion (full metadata)
```html
<del data-userid-previous="287184"
     data-last-change-time="1713867190075"
     data-time="1713867190075"
     data-changedata=""
     data-username="297329CP"
     data-userid="287184"
     data-cid="2"
     class="ice-del ice-cts-1 cpm-change-previous">Steamship/</del>
```

### CPM-layer insertion (full metadata)
```html
<span class="cpm-change-previous cpm-change-previous-ins"
      data-userid-previous="264794"
      data-cid="3"
      data-userid="264794"
      data-username="272796CP"
      data-changedata=""
      data-time="1738074175253"
      data-last-change-time="1738074175683">Motor Vessel</span>
```

### Composite change (insertion wrapping a deletion — same data-cid)
```html
<span class="cpm-change-previous cpm-change-previous-ins" data-cid="6"
      data-userid="264794" data-username="272796CP"
      data-time="1738074175253" data-last-change-time="1738074175683" data-changedata="">
  <del class="ice-del ice-cts-1 cpm-change-previous" data-cid="6"
       data-userid="264794" data-time="1738074175253">original text</del>
  replacement text
</span>
```

---

## §7 SEA Placeholders

```html
<dfplaceholder
  id="cke_1_df_0"
  padding-char="."
  contenteditable="false"
  dfsystemname="VESSEL_NAME"
  empty-display-name=""
  fit-to-box="false"
  role="region"
  style="min-width: 1pt"
  title="Vessel Name">MV NORDIC STAR</dfplaceholder>
```
Common `dfsystemname` values: `Flag`, `Place`, `CPDate`, `OWNER_NAME`, `PLACE_DATE`, `VESSEL_NAME`, `GRT`, `NRT`.

---

## §8 SEA Freetextfields

Free-text input fields in SEA documents — editable inline areas with a dotted underline style.

### Empty freetextfield (template — unfilled)
```html
<freetextfield style="min-width:20px;" class="sc-dotted">&nbsp;&nbsp;&nbsp;</freetextfield>
```

### Filled freetextfield (fixture — with value)
```html
<freetextfield style="min-width:20px;" class="sc-dotted">12 months</freetextfield>
```

Fields are identified by **ordinal position** (1-based), not by ID. To fill the 3rd freetextfield:
```python
b.fill_freetextfield(3, "Rotterdam")
```

To count fields in a template:
```bash
grep -c '<freetextfield' tests/fixtures/sea/nype46/template.html
```

**Parser behaviour:** freetextfield elements inside a deletion context are ignored (not tokenized). Each field gets an auto-assigned token ID `freetextfield_N` (counter resets per document parse).

---

## §9 Metadata Rules

### Froala attributes (ALL 4 required on every tracked change span)

| Attribute | Rule |
|-----------|------|
| `data-timestamp` | 13-digit ms epoch for `<span>`; 10-digit seconds for smart-field `<a>` |
| `data-identifier` | UUID v4 for `<span>`; 4–7 digit numeric string for smart-field `<a>` |
| `data-user` | UUID. Use `53b51b06-ca6e-4ad5-83a6-fd0a78fa76b1` for nype46; `9d5432e9-8811-431b-83e6-d8fc21582f6a` for others |
| `data-change-type` | `"addition"` or `"deletion"` |
| CSS class | `fr-highlight-change` for additions; `fr-tracking-deleted` for deletions |

`data-or-legacy-html="true"` required on root div for: nype46, nype81, nype2015, gencon1976.
NOT present for: nype93, gencon1994, nype93-lo.

### SEA metadata

| Attribute | Rule |
|-----------|------|
| `data-cid` | Sequential integer; shared between paired del+ins |
| `data-userid` | Numeric user ID (e.g. `264794`) |
| `data-username` | Format: `<6-digit-number>CP` (e.g. `"272796CP"`) |
| `data-time` | 13-digit ms epoch |
| `data-last-change-time` | 13-digit ms epoch, slightly after `data-time` |
| `ice-cts-N` | Change tracking set: `ice-cts-1` most common; `ice-cts-2` for secondary session |
