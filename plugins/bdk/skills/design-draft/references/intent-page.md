# Intent page

What `.bdk/runs/<change>/design/intent.html` must show, so the user sees every change of scope since propose once, on one page, and can approve it at the design gate without reading the proposal, the log or the code.

## Look

HTML you write yourself, not Markdown converted to HTML: one self-contained file, styles inline in a `<style>` element, no script needed. Follow the project's design system when it has one (its tokens or CSS variables); otherwise run `npx -y lavish-axi design` once and follow it. Write every word a reader sees in the language your prompt names as the user's; in English when it names none. Code, paths, ids and identifiers stay as they are.

In `<head>`: a `<title>` naming the Change and `<meta name="bdk-scope-log" content="SL-<n>">`, `<n>` the last entry of `scope-log.md`. The gate compares it with the log to see whether the page is current.

## Sections, in order

1. **Banner.** What there is to approve: how many changes of the intent, how many AC changed, added and dropped. Approving starts the plan with the new scope; requesting changes goes back to the design.
2. **Intent.** The intent quoted from `## Intent` (the source's words, from `source/issue.md` when present), every word that changed struck with `<del>` and the new words after it in `<ins>`, each change tagged with its entry id (`SL-2`). An unchanged intent is quoted as it is, with a line saying it did not change.
3. **Why it changed.** One card per entry of `scope-log.md` whose `Stage` is not `propose`, in order: its id and the AC it touches; when and who decided (`Date`, `By`; `needs-user` shown as waiting); what the design found, with the `file:line` of `Why` and of `design.md`; what was chosen; every rejected option of `Options` with why it lost.
4. **Acceptance before and after.** A `<table>` with one row per AC of `## Acceptance`, ids in order: the id, the text before (as the source or propose gave it), the text after, and a status `changed`, `unchanged`, `added` or `dropped` (in the page's language), with the entry id for every status but `unchanged`.
5. **Flow.** An inline `<svg>` of the flow the change alters, before and after side by side, the new or removed steps marked, every box and arrow labelled. When no flow changes (a wording or a limit), draw the one step the AC is about, before and after.

## Check before handing it back

Read the page back with Read and check: the meta names the log's last entry; every entry after propose has its card with a `file:line`; the table has a row for every AC with a status; the intent holds a `<del>` for every changed word (or says it is unchanged); the `<svg>` has labelled boxes; the text is in the page's language. Fix what fails in place, then check again.
