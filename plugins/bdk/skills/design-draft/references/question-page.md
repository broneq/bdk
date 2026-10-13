# Question page

What a round's Lavish page of `design-draft` must say, so a developer can decide every question from the page alone, without the proposal, the code or this conversation at hand. A card with only a question and bare options is invalid: the user cannot weigh options whose consequences they are not shown.

## Look

The layout, styling and controls follow Lavish: run `npx -y lavish-axi design`, `npx -y lavish-axi playbook input` and `npx -y lavish-axi playbook comparison`, each once, before you write the first page, and follow them (its design priority, its question wiring). BDK sets only what a card says and the section markers below.

## Language

Write every word a reader sees (title, headings, context, options, consequences, recommendation, button labels) in the language your prompt names as the user's language; in English when it names none. Code, file paths, identifiers and technical terms stay as they are.

## A card

One card per open decision: the `data-lavish-question` wrapper of the `input` playbook, with the decision as its heading and three sections, each an element marked `data-bdk-section` with a heading in the page's language:

1. `data-bdk-section="context"`: why this is a question. What the proposal (or the issue it tracks) says about it, or that it says nothing, and what the code does today, with at least one `file:line` of code the decision touches. When the project has no code for it yet, say so and name the nearest code it will sit next to.
2. `data-bdk-section="options"`: every option, the recommended one first and checked, each as a radio input with a label and its consequences: what it costs, what it risks, what it leaves uncovered and what it breaks. Name each of the four, or say "none" for it. Concrete, in the project's terms ("one more file read per export", "every caller of `formatCents` changes"), never "could be a concern".
3. `data-bdk-section="recommendation"`: the recommended option and the reason, tied to the proposal, the code or a project rule (name the rule's id).

Then the free-text note and the card's Submit control, as the `input` playbook shows.

```html
<form data-lavish-question="delimiter" class="...">
  <h2>CSV delimiter</h2>
  <section data-bdk-section="context"><h3>Context</h3> ... `src/format.js:2` ... </section>
  <section data-bdk-section="options"><h3>Options with consequences</h3>
    <label><input type="radio" name="delimiter" value="semicolon" checked> Semicolon</label>
    <dl> cost / risk / uncovered / breaks </dl> ...
  </section>
  <section data-bdk-section="recommendation"><h3>Recommendation</h3> ... because ... </section>
  <textarea name="note"></textarea> <button type="submit">...</button>
</form>
```

## Check before opening

Before every `npx -y lavish-axi <page>`, a new page or one you open again on resume, read the page back with Read and check each card:

- it holds the three marked sections, none empty;
- its context names what the proposal says and cites a `file:line` (or says there is no code yet and names the nearest);
- every option names its cost, risk, what stays uncovered and what breaks;
- the recommendation names one option and a reason;
- its text is in the page's language.

Fix every card that fails in place with Edit (or rewrite the page with Write), then check again. Open the page only when every card passes. A page from an earlier run that fails is fixed the same way, at the same path, before you open it again.
