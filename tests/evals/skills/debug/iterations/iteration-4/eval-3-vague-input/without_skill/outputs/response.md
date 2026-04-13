# Response to "The migration is broken"

## Investigation

The report "the migration is broken" is too vague to act on without more details. I investigated the current state of the codebase:

**Test suite status:** All 3221 tests pass.

```
3221 passed in 26.28s
```

**Git status:** The branch `poc/sea-contracts-parser` is 20 commits ahead of remote, with only untracked files (no modified or staged files).

**Recent commits:** The latest commit is a refactor improving code quality (encapsulation and mutable state). No breaking changes visible in commit history.

## What I Need to Diagnose Further

The description "the migration is broken" is too vague. To investigate further, please provide:

1. **Error message or traceback** – What exact error do you see?
2. **Input document** – Which document/template is failing?
3. **Command used** – What CLI command or API call triggered the issue?
4. **Expected vs actual output** – What did you expect vs what happened?
5. **Affected document type** – Froala HTML? SEA Contracts? GENCON 1994?

## Possible Areas to Check

Based on the current branch (`poc/sea-contracts-parser`) and recent work, common failure points are:

- **SEA Contracts parser** – New parser on this branch; if you're testing SEA format documents, this is likely the area
- **Position mapping** – A common source of migration errors; one wrong offset cascades to all changes below
- **Unmarked change detection** – Requires V1 template; skipped without it
- **Template import** – Template must be imported before migration can run

## Next Steps

Please provide the error message, failing command, or a specific document that reproduces the issue, and I can investigate the root cause.
