Using debug to investigate the issue.

The input "The migration is broken" is too vague to begin investigation. To debug this effectively, I need at least one of the following:

- **Error message or exception** — e.g., `ValueError: invalid offset`, `KeyError: 'change_type'`, traceback
- **Failing component** — which file, class, or CLI command is failing (e.g., `migrate` command, `HTMLOrV1Parser`, `LineTransformer`)
- **Steps to reproduce** — what exact inputs or commands trigger the issue
- **Expected vs actual behavior** — what you expected to happen and what happened instead

Could you provide any of the above? For example:

> "Running `python -m data_migrator migrate input.html` raises `AttributeError: 'NoneType' object has no attribute 'tokens'` on line 42 of `line_transformer.py`."

or

> "The migrated output is missing all deleted sections — they appear as plain text instead of being wrapped in deletion markers."

Once I have that context, I can trace the code path and identify the root cause.
