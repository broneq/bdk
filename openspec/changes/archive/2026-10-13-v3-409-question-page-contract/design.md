# Design

## Context

See proposal.md - Why. Today `plugins/bdk/skills/design-draft/SKILL.md` step 4.1 asks for "one card per open decision with its options as radio inputs, the recommended one checked, a short trade-off per option, and a free-text note", and runs `npx -y lavish-axi playbook input` for the page shape. Nothing requires context, today's code or consequences, nothing names the page's language, and nothing checks the page before `npx -y lavish-axi <page>` opens it. The designer gets only `Run the skill bdk:design-draft with the arguments: <change>` (`plugins/bdk/skills/design/SKILL.md` "The blocks", `design-draft/SKILL.md` step 0.1), so it cannot know the user's language.

What Lavish gives today (`lavish-axi` 0.1.84; the installed `lavish` skill only points to the CLI):

- Interaction mechanics, `playbook input`: native radios, a `data-lavish-question` wrapper per question, one Submit/Queue control per question that calls `window.lavish.queuePrompt` once.
- Content guidance, `playbook comparison`: name the decision, show concrete behaviour per option, make each option's cost as visible as its benefit, recommend only when the evidence supports it. Advice only; nothing requires a context or consequences section.
- Look, `lavish-axi design`: no design system is injected; the priority is the look the user asked for, then the design system of the project the page is about, then a Tailwind 4 + DaisyUI 5 CDN fallback.

So Lavish leaves the content of a card open; the contract is BDK's whichever way the look goes.

## Goals / Non-Goals

**Goals:**

- Every card of a design question page carries what a developer needs to decide without other context.
- A card without it never reaches the user.
- The page speaks the user's language.

**Non-Goals:**

- A BDK look for pages (D1).
- The questions asked without Lavish, and the `/bdk:triage` page (proposal, Out of scope).

## Decisions

### D1. Lavish look, BDK content

BDK fixes what a card says and how its sections are marked; layout, styling and controls follow the live `npx -y lavish-axi design` and the `input` and `comparison` playbooks. Decided by the user on 2026-10-13.

Alternatives: a BDK HTML/CSS template the skill fills (same look everywhere, fewer tokens, an easy check) lost because it overrides Lavish's "match the project's design system" rule and BDK would have to track Lavish's API (`queuePrompt`, `data-lavish-question`) by hand; a BDK unstyled skeleton with the Lavish look lost because it is one more file to keep in step with Lavish, while the model may still restructure it.

### D2. Language-neutral section markers

Each card is the `data-lavish-question` wrapper Lavish's `input` playbook asks for, and holds three elements marked `data-bdk-section="context"`, `"options"` and `"recommendation"`. Their headings are in the page's language. The markers let the designer's self-check, an eval grader and a reader of the HTML find the sections whatever the language.

Alternatives: fixed English headings lost (they break a page in the user's language); CSS class names lost (they mix the contract with the styling Lavish owns, and a design system may use the same names).

### D3. The designer checks the page itself

Before every open, a new page or one opened again on resume, the designer reads the page back with Read and checks each card against the contract (`references/question-page.md`, "Check before opening") and the language; it fixes a failing card with Edit and checks again. Decided by the user on 2026-10-13. It follows the project rule "a new skill starts as a plain skill with an eval case; a CLI helper only for a problem an eval or a measurement shows" (CLAUDE.md, "Building skills (v3)"): the incident showed a missing contract, not a self-check that misses.

Alternative: a deterministic `bdk` command that parses the page lost for now; it stays the next step if `design-draft-page-contract` or `design-draft-page-resume-bare` shows cards that pass the self-check while they break the contract.

### D4. The caller names the language

The thread that starts `bdk:designer` knows the user's words; the designer does not. `/bdk:design` and step 0 of `/bdk:design-draft` add one sentence to the designer's prompt, after the arguments: `Write the questions in <language>, the language the user writes in.` The arguments stay as they are, so the mode detection of step 1 (text after the Change name is a revision request) is untouched. The designer writes the page, and the questions it lists without a page, in that language, English when the prompt names none; spec deltas and `design.md` keep their language rules.

Alternatives: putting the language into the arguments lost (it would read as a revision request when `design.md` exists); letting the designer guess from `proposal.md` lost (a proposal is often in English while the user writes in another language, as in the incident).

### D5. The contract is a reference of the skill

The card contract, the markers and the check live in `plugins/bdk/skills/design-draft/references/question-page.md`; step 4.1 of the skill points to it. The skill body stays short and the reference loads only on the Lavish path.

## Risks / Trade-offs

- [Bottleneck: every card now needs a `file:line` of today's code, so a round with many decisions reads more code before the page opens] -> the designer already reads that code in step 2 and cites it in `design.md`; the card reuses it.
- [Failure mode: the self-check is done by the model that wrote the page, so it can pass its own bare card] -> `design-draft-page-resume-bare` grades the catch on a bare page; a miss there is the measured problem that admits the `bdk` helper of D3.
- [Hidden cost: a longer page, more tokens per round] -> one page per round, and the extra round the incident cost is larger.
- [Unconfirmed assumption: the calling thread identifies the user's language correctly, also under `/bdk:run` where the user's words may be far back] -> English is the fallback, and the user can say "in Polish" in a note, which the designer applies in the next round.
- [Lavish changes its playbooks] -> D1 reads them live; the contract names only `data-lavish-question`, which the `input` playbook has asked for since #194.

## Measurement

Recorded 2026-10-13 with Claude Code (version pinned in the root `package.json`), `--ablation none --runs 1 --model sonnet`, the grants of the design blocks and the `git` entry of "Host limits".

| Run | Skill text | Case | Score | Failed graders | Cost |
|---|---|---|---|---|---|
| baseline | before this Change (the reference was written while the run went; neither page carries a marker, so both read the old text) | `design-draft-page-contract` | 0.60 | `cards-decidable`, `section-markers` | $1.00 |
| baseline | as above | `design-draft-page-resume-bare` | 0.50 | `cards-decidable`, `fixed-before-open`, `section-markers` | $0.60 |
| after | this Change | `design-draft-page-contract` | 1.00 | none | $0.71 |
| after | this Change | `design-draft-page-resume-bare` | 1.00 | none | $1.18 |
| regression | this Change | `design-draft-lavish` | 1.00 | none | $0.63 |

After the PR opened, two more paid runs on 2026-10-13:

- Series, `--runs 3 -j 3`: `design-draft-page-contract` 1.00 in 3 of 3 runs ($2.46), `design-draft-page-resume-bare` 1.00 in 3 of 3 runs ($1.95); $4.41 and 415 s.
- The real look: one `claude -p` run of the Polish request with `--plugin-dir plugins/bdk` and `--model sonnet` on the `ledger-explored` fixture, with a stub that passes `design` and `playbook` through to the real `lavish-axi` 0.1.84 and fakes only the open and the poll; $0.71 and 161 s. The page took Lavish's DaisyUI `luxury` theme and card layout, held the three sections on all three cards in Polish, and fit a 390 px viewport (Playwright: `scrollWidth` 390).

Total: $9.24 and 1151 s of machine time over five commands (191 s, 249 s, 135 s, 415 s, 161 s), within the issue's $15 budget; no failed or repeated run. The old skill opened the bare resume page unchanged; the new one rewrote it with Write before the first open. The Polish page of the after run held three cards (delimiter, amount format, entry point), each with `file:line` context (`src/store.js:12`, `src/format.js:2`, `package.json`), cost, risk, uncovered and breaks per option, and a recommendation citing `BDK-ARCH-4` or `src/format.js:1`. Its look was plain CSS because the stub answers `lavish-axi design` with one line; with the real CLI the look comes from Lavish (D1). No case showed a card passing the self-check while breaking the contract, so the `bdk` helper of D3 is not admitted.
