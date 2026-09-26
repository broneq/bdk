**Decision tier: ask-user**

Ask this decision point with `AskUserQuestion` in the terminal (`features.lavish` is off, or `lavish-axi` is not on PATH).

- Bundle every open decision into one call; the multi-question form takes up to four. Do not split them into sequential prompts.
- Give each decision its options, the recommended option first with "(Recommended)" in its label, and the tradeoff in each option's description.
- Ask free-form only when the answer space is genuinely open.

Never proceed on an assumed answer: a decision the user did not answer is still open, and it does not leak into the output as if it were made.
