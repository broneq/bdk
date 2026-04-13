# Debug Skill Transcript — Eval 3: Vague Input

**User prompt:** "The migration is broken."

**Skill:** `debug`

---

## Skill Announcement

Using debug to investigate the issue.

---

## Phase 1: Parse Input

### Step 1: Validate Input

The input "The migration is broken." is **vague**. It does not provide:
- An error message or exception class
- A failing component or file path
- Steps to reproduce the failure
- Expected vs actual behavior

Per the skill rules: *"If input is vague (e.g., 'it doesn't work'): ask what specific behavior is wrong and what was expected, then **stop**."*

### AskUserQuestion (SIMULATED)

**Question I would ask the user:**

> The migration is broken — can you give me a bit more detail so I can investigate effectively?
>
> Specifically, I need one or more of the following:
>
> 1. **Error message or traceback** — paste the full error output (exception class, stack trace, file/line number)
> 2. **Steps to reproduce** — what command did you run? What input file or data did you use?
> 3. **Expected vs actual behavior** — what did you expect to happen, and what happened instead?
> 4. **Affected component** — do you know which part is broken? (e.g., the HTML parser, the XML output, the CLI command, a specific charter party document?)
>
> **Options presented:**
> - Paste an error message or traceback
> - Describe the steps to reproduce (command + input)
> - Describe what you expected vs what actually happened
> - Point me to a specific file, test, or document type that is failing

**STOP — waiting for user response before proceeding.**

---

## Phase 1 Gate: BLOCKED

The skill has correctly identified the input as too vague to begin investigation. It cannot proceed to Phase 2 (Investigate) without at least one concrete signal:

- No exception class extracted
- No failing component identified
- No steps to reproduce
- No expected vs actual behavior

**Status:** Waiting for clarifying input from user before any investigation begins.

---

## Summary of Skill Behavior on Vague Input

| Check | Result |
|-------|--------|
| Input provided? | Yes — but vague |
| Enough signal to investigate? | No |
| Correct action taken? | Yes — AskUserQuestion triggered |
| Proceeded past Phase 1? | No — correctly stopped |
| Anti-patterns avoided? | Yes — did not guess root cause, did not scan codebase speculatively |
