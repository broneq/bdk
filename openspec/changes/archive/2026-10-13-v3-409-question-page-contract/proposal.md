# Proposal

## Why

Tracks #409.

On 2026-10-12, in a `/bdk:design` run on a Next.js + Convex project, the first Lavish page from `bdk:designer` listed only questions and bare options: no trade-offs, no consequences, nothing about what the code does today. The user could not answer it ("nie rozumiem tych pytań"), and it took an extra round with a full rewrite in plain Polish. `/bdk:design-draft` asks for "a short trade-off per option" and says nothing about the context a developer needs to decide, or about the language of the page.

## What Changes

- `/bdk:design-draft` gets a page contract (a new reference of the skill): every question card of a Lavish page has three sections, marked in the markup so they can be found in any language: **Context** (what the proposal or issue says, and what the code does today with `file:line`), **Options with consequences** (per option: cost, risk, what stays uncovered, what breaks) and **Recommendation** (the option and the reason). A card with only a question and bare options is invalid.
- Presentation follows Lavish, the content follows BDK (decided with the user): the layout and look come from the live `npx -y lavish-axi design` and the `input` and `comparison` playbooks; BDK fixes only what a card must say and the section markers. No BDK template or stylesheet.
- The designer checks every page against the contract itself before it opens it (decided with the user: a skill self-check, no `bdk` helper), and fixes the page in place when a card fails. This also covers a page from an earlier run that it opens again on resume.
- The page is written in the language the user writes in: the thread that starts `bdk:designer` (`/bdk:design`, or `/bdk:design-draft` typed by the user) names that language in the designer's prompt; without one the page is in English.
- Two new block eval cases: `design-draft-page-contract` (a Polish request: every card has the three sections, in Polish) and `design-draft-page-resume-bare` (a bare page from an earlier round is caught and rewritten before it opens again).

To resolve in the spec, both settled with the user on 2026-10-13: Lavish style vs a BDK style (Lavish look, BDK content; design D1) and how the check runs (the skill's own self-check; design D3).

Out of scope: the content of questions asked without Lavish (`AskUserQuestion`, or listed in the reply), and the triage page of `/bdk:triage`; neither was part of the incident.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `design-blocks`: "Questions follow the policy and the session" gains the page contract, the self-check before opening, and the page language; "Eval cases of the design blocks" gains the two cases.

## Impact

- Changed: `plugins/bdk/skills/design-draft/SKILL.md` (step 0, step 4), new `plugins/bdk/skills/design-draft/references/question-page.md`, `plugins/bdk/skills/design/SKILL.md` (the designer's prompt names the user's language).
- New eval cases `plugins/bdk/evals/design-draft-page-contract/`, `plugins/bdk/evals/design-draft-page-resume-bare/`; `plugins/bdk/evals/README.md`.
- User docs: `docs/concepts/orchestrators.md` (design questions: what a question card holds, its language) and `docs/concepts/stages.md` (the `/bdk:design-draft` row); the Reference regenerated with `pnpm docs:reference`. No diagram changes: no step, exit, command, settings key, file or agent of a flow is added, removed or reordered.
