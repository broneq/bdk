# Schema-change gate

A data-model change is the most expensive design decision to get wrong: migrations are hard to reverse, readers break silently and lost data stays lost. So the user, not the skill, owns the final schema, and the approval is a decision of its own.

**When it applies.** The chosen approach, or one still under serious consideration, adds, drops or renames a table or column, changes a type, a constraint or nullability, adds or removes an index, or needs a migration.

**What to do before `/bdk:verify-design` runs:**

1. **Show the current shape** of each affected table or document, taken from the migrations, models or schema files you read. Never invent a column name; when you have not read the shape, read it first.
2. **Offer the proposals.** When more than one shape is viable, offer at least two with their tradeoffs: normalised versus read-optimised, nullable with backfill versus not-null with a default, new table versus new columns, additive versus breaking. Show each as a compact `erDiagram` or a before-and-after column table. Mark each migration as additive or breaking and state its backfill, downtime and rollback. When only one shape is viable, say why the others fail.
3. **Ask for approval** as a rich decision of the `Asking the user` section: the proposals, plus an option to revise when none fits. A revision goes back to step 2 with the user's feedback.
4. **Record the approval** as `bdk log add decision "<approved proposal in one line>" --ref design --ref <table or model> --body -`, with the approved shape and the dropped proposals in the body.

Approval of the overall design, or a "looks good" on another question, is not schema approval. When a later change, a verifier finding included, alters the data model again, run the gate again for that change: an earlier approval does not cover a shape the user never saw.
