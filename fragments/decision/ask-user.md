**Decision tier: ask-user**

Ask the user in the terminal (`features.lavish` is off, or `lavish-axi` is not on PATH). Pick the form by the shape of the decision:

- **Simple decision**: every option fits a label and one sentence ("new branch or the current one", "keep these commands"). Ask it with `AskUserQuestion`.
- **Rich decision**: an option needs a diagram, a side-by-side comparison, a schema delta or an annotated draft to be judged (the approaches of a design, the review of a draft). Print each option with its diagram or draft and its tradeoffs first, then ask with `AskUserQuestion`. The terminal loses rendered diagrams, a side-by-side layout and annotation on the draft; it keeps every option, the recommendation and the tradeoffs, so write those out in full.

For both:

- Bundle every open decision into one call; the multi-question form takes up to four. Do not split them into sequential prompts.
- Give each decision its options, the recommended option first with "(Recommended)" in its label, and the tradeoff in each option's description.
- Ask free-form only when the answer space is genuinely open.

Never proceed on an assumed answer: a decision the user did not answer is still open, and it does not leak into the output as if it were made.
