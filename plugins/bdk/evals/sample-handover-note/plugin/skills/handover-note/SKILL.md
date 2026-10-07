---
name: handover-note
description: Writes the handover note of a repository in the house format. Use when the user hands a repository over to someone, or asks for a handover note.
---

# Handover note

1. Read `package.json` and `README.md` first.
2. Write the note to `docs/handover.md`, in exactly this outline:

   ```markdown
   # Handover: <the "name" field of package.json>

   ## Purpose
   <two sentences from the README>

   ## Run it
   <the commands from the "scripts" field of package.json>

   ## Open questions
   <what the next owner should decide; "None" when nothing is open>
   ```

3. Reply with the path of the note and a two-sentence summary. Do not paste the note.
