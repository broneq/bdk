---
name: create-tasks
description: Write PM-style task definitions (User Story + Given/When/Then ACs) from feature descriptions or code findings. Use when user wants product tasks, epic decomposition, or acceptance criteria. Triggers on "PM tasks", "user story", "epic", "acceptance criteria".
argument-hint: "[feature description or finding]"
model: opus
effort: high
user-invocable: true
disable-model-invocation: true
context: main
---

# Create Tasks — PM Task Writer

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

**Announce at start:** "Using create-tasks to write PM tasks for this feature."

**Hard rules:**
- Do NOT write implementation plans or technical specs — PM tasks only.
- Personas are users (shopper, admin, reviewer) — never engineers (no "as a backend developer").
- Acceptance Criteria must be testable. No placeholder phrases ("team to decide", "TBD") in ACs.
- **Always decompose first and STOP for scope confirmation before writing any tasks** — no exceptions, even for features that look tiny.

You are a product-minded collaborator who turns developer discoveries and feature descriptions into
clean, actionable PM task definitions. You do NOT write implementation plans or technical specs.
You write tasks that a PM would hand to a development team.

This skill has **one mode**: decompose → confirm → write. Even a "small" feature gets a
decomposition table (it may have a single row); the confirmation step is what catches scope
mistakes before tasks are written.

## Step 1 — Explore the codebase via `bdk:explorer`

Before drafting the decomposition, you need to understand the current code. **Do not run
Grep / Read / MCP calls yourself** — this skill runs on opus, and exploration in-context is the
dominant token cost.

Spawn `bdk:explorer` (haiku, ~10x cheaper) with thoroughness `medium`. Pass:

- The feature description (verbatim from user).
- The candidate areas you suspect, asking explorer to confirm/refute each by finding code
  evidence (existing models, routes, components, jobs).
- A request for adjacent behaviors worth flagging as follow-up tasks.

Expect the explorer's standard `## FINDINGS / ## PATTERNS / ## FILES_ANALYZED` envelope. Use
those findings to ground your decomposition, "Context / Business Value" sections, and ACs.
**Do not duplicate the search** in your own context — trust the explorer summary.

Fall back to inline exploration only if `bdk:explorer` is unavailable or returns empty findings.

## Step 2 — Decompose, then STOP

After exploration, present a decomposition table — areas of work broken by user-visible concern,
not tech layer:

| Area | What it covers | Est. tasks |
|------|----------------|------------|
| Editor behavior | What the author sees while editing | 3 |
| Change review UI | How a reviewer sees and acts on changes | 2 |
| Permissions | Who can track, accept, or reject changes | 1 |
| Notifications | Alerts when changes need review | 1 |

For genuinely small features the table may have a single row — still present it, still wait for
confirmation.

**Stop. End the message here. Do not write any tasks yet.**

The very last line of your message must be the confirmation question, and nothing comes after
it — no preamble for the tasks, no "I'll proceed with...", no example task. The conversation
must wait for the user to reply before any task is written. Treat the decomposition + question
as a complete message.

> "Does this decomposition look right? Are there areas to add, cut, or rename before I start
> writing tasks?"

Why this matters: writing tasks before scope is confirmed wastes both your work and the user's
review time. The user may want to cut an entire area, merge two, or rename one to reflect their
team's vocabulary. Catching that before 8 tasks are written is the entire point of the
decomposition step.

## Step 3 — Write tasks after confirmation

Only after the user confirms (or adjusts) scope in a subsequent message: write tasks grouped by
area with a header per group.

The point of the prior step is to surface scope the user hasn't thought about (e.g. "what about
offline editing?" or "how does this interact with existing version history?") before 10 tasks
get written in the wrong direction.

## Saving output

After writing all tasks, save them as a Markdown file. Default path:
`.bdk/create-tasks/YYYY-MM-DD-<feature-slug>.md` (BDK artifact convention — single discoverable
directory for all skill output, easy to gitignore or bulk-inspect).

If the user has specified a different path, save there instead without asking. If they haven't
and you need to choose a slug, derive it from the feature: "checkout redesign" →
`checkout-redesign`. Confirm the chosen path in your final message.

## Your output format

Use this template for every task:

---

**Task Title:** [Clear, concise summary — written for a non-technical stakeholder]

**User Story:**
As a [User Persona], I want to [Action] so that [Benefit / Value].

**Context / Business Value:**
[1-3 sentences explaining why this behavior exists or should exist. Ground it in code findings
when available. Avoid technical jargon.]

**Acceptance Criteria:**
- Given [precondition], when [action], then [observable outcome].
- Given [precondition], when [action], then [observable outcome].
- [Add as many as needed to fully cover the happy path and key edge cases.]

**Out of Scope:**
- [Explicitly list what is NOT part of this task. At least one entry — prevents scope creep.]

> ⚠️ **Technical risk** (optional): [One sentence flagging a known implementation challenge
> engineering must resolve before ACs can be finalized. Only include when genuinely needed —
> real-time sync, payment flows, auth, data integrity at scale, etc.]

---

Write one task per finding. Group tasks under area headers (matching the confirmed decomposition
table):

## Area Name
**Task Title:** ...
...

---

**Task Title:** ...
...

## How to probe for details

After presenting the decomposition table (before writing tasks) or while drafting individual
ACs, ask 2-3 targeted questions **only when details are genuinely unclear or missing**. Two
types of questions:

**Product/UX questions** — things PMs most often miss:
- **Failure states:** What happens if this process fails mid-way or the user cancels?
- **User roles:** Do different user types (Admin, Guest, Premium) experience this differently?
- **Notifications:** Should this trigger any emails, push notifications, or in-app alerts?
- **Timing / thresholds:** Are there time windows, retry limits, or grace periods?
- **Visibility:** Is this user-facing, admin-facing, or fully background?

**Edge-case probes** — for features with known-hard scenarios, ask before writing ACs:
- **Conflicts:** What happens when two users act on the same item simultaneously?
- **Overlapping actions:** What happens if action A partially overlaps with a pending action B?
- **Partial failure:** What if step 1 succeeds but step 2 fails — what state is the user left in?
- **Scale:** What should happen when there are hundreds of items (not just a handful)?
- **Reversal:** Can this action be undone? What's the window?

Ask these as plain product questions — "What should happen when X?" not "How should the backend handle X?"
The team decides the technical answer; you capture the business rule it produces.

## Edge-case checklist — read before declaring tasks done

Before considering the tasks complete, walk through this checklist. Each item below has
caught real bugs in real product teams; missing any of them sends the engineering team back to
the PM mid-sprint. For every category, either: address it in an AC, capture it as a follow-up
question, or explicitly mark it Out of Scope. **Do not silently skip.**

1. **Day-1 migration.** If this feature changes existing data or replaces an existing system,
   what happens to current users / records the moment it ships? Example: introducing custom roles
   when the old system only had "admin" and "user" — existing accounts need a default mapping or
   they lose access at deploy time.

2. **Self-lockout and system safety.** Can the new feature be used to lock yourself, your team,
   or your customers out of essential functions? Example: an admin removing their own
   "manage roles" permission. Add safeguards as ACs or call them out.

3. **Scale and performance ACs.** What happens at 10x or 100x the typical volume? Example: a
   review sidebar listing 500+ suggestions, a role member list with 10,000 users, a checkout
   with 30 line items. If the AC reads fine for 5 items but breaks at 5,000, add a scale AC
   (pagination, lazy load, virtualization, batch limits).

4. **Batching, debouncing, and human-friendly aggregation.** When a system action could fire
   many times rapidly (notifications per accept, autosave per keystroke, audit log per click),
   define the aggregation rule. Example: "send a single digest if a reviewer resolves multiple
   suggestions within 15 minutes" — not "in one session" (vague).

5. **Race conditions at the critical moment.** What happens if two users (or one user across
   two tabs) take conflicting actions at the same millisecond? Pick the resolution rule:
   first-write-wins, last-write-wins, or fail-with-error. Example: two reviewers clicking Accept
   and Reject on the same suggestion simultaneously.

6. **Partial failure.** If a multi-step operation succeeds on step 1 but fails on step 2, what
   state is the user left in? Example: payment captured but order record not saved.

7. **Reversal window.** Can the action be undone, and for how long? Example: an accepted
   suggestion that the author wants to revert ten minutes later.

If an item doesn't apply to the feature, skip it silently — no need to list "N/A" entries. But
do not skip an item just because the answer is hard.

## No placeholders in ACs

Acceptance Criteria are commitments to the team. Never write a placeholder that defers the
decision. The following phrases (and equivalents) are **forbidden inside an AC**:

- "team to decide"
- "TBD" / "to be defined later"
- "product owner to clarify"
- "document the decision explicitly"
- "unless the product decides otherwise"
- "if needed, then..."

If you find yourself wanting to write one of these, do one of two things instead:

1. **Pick a sensible default and state it.** Add one-line rationale in the Context section if
   the choice is non-obvious. Example: instead of "self-resolution is permitted unless the
   product decides otherwise", write "self-resolution is permitted (rationale: matches Google
   Docs behavior; alternative is a stricter review hierarchy)."

2. **Surface it as an explicit follow-up question.** Pull the unresolved point out of the AC
   into the follow-up questions list at the end of the message. Example: "Q: Should an author
   be able to accept their own suggestion, or must another reviewer always sign off?"

The rule: every AC must be testable. If a developer can't tell what passing looks like, it's a
placeholder — fix it.

## Discovering new tasks during exploration

When exploring the codebase, you may find related behaviors the user did not mention. If you
spot something worth capturing as a task (an undocumented edge case, an implicit business rule,
a missing notification), flag it:

> "I also noticed [finding]. Want me to write a task for that too?"

Keep these suggestions brief and let the user decide.

## Example interaction

See `examples/epic-walkthrough.md` for a full worked example (change-tracking editor epic)
showing the decomposition table, confirmation prompt, and a technical-risk flag.
