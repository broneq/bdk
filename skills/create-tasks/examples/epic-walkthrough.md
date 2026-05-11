# Example — change-tracking epic

Reference walkthrough showing how the `create-tasks` skill applies its three-step flow to an
epic-sized feature. Read this when you need orientation on the expected output shape; the
runtime spec lives in `SKILL.md`.

## User input

> "We want to add change tracking to the WYSIWYG editor — authors can propose edits,
> reviewers can accept or reject them, like Google Docs track changes."

## Skill response (Step 1 + Step 2)

[Spawn `bdk:explorer` to map existing editor, version history, user roles, then present:]

> Before writing tasks, let me check the scope. Here's how I'd break this down:
>
> | Area | What it covers | Est. tasks |
> |------|----------------|------------|
> | Authoring — propose changes | Author enables tracking mode; edits appear as suggestions, not direct changes | 2 |
> | Reviewing — accept / reject | Reviewer sees pending changes, accepts or rejects individually or in bulk | 2 |
> | Change visibility | How tracked changes render (inline diff, sidebar summary) | 1 |
> | Permissions | Who can enable tracking, who can review — does this use existing roles? | 1 |
> | Notifications | Reviewer notified when new changes are pending; author notified on decision | 1 |
> | History & audit | Accepted/rejected changes stored for audit; visible in version history | 1 |
>
> Does this look right? Anything to cut, add, or rename before I start writing?

## Step 3 (after user confirms scope)

Write tasks grouped by area heading. Each task follows the standard 5-section template (see
`SKILL.md` → "Your output format"). Where appropriate, add edge-case probes before the ACs for
complex areas, and technical risk flags where a known implementation challenge could invalidate
the ACs if not resolved first.

Example technical risk flag for this epic:

> ⚠️ **Technical risk:** How suggestions are anchored to document positions must be decided
> before ACs for "propose changes" and "accept/reject" can be finalized — if text shifts
> upstream, stored positions may point to the wrong location. Confirm approach with engineering.
