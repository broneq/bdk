# Analysis template

`bdk diagnostics write` requires these five headings, in this order. Replace each line in angle brackets. Every claim ends with its citation in parentheses: `(journal:<n>)`, `(<agent-id>:<line>)` or `(L-xxxxxxxx)`.

```markdown
## Summary

<Session, Change and stage; how long it ran, the tokens and the cost in USD; the transcript state when it is not ok.>
<The two or three problems that cost the most, one sentence each, with their citations.>

## What went well

- <A step that worked as intended, with its citation. Keep this short: it shows what not to change.>

## What went wrong

### <Problem title>

- **What happened:** <one sentence> (<citation>)
- **Cost:** <tokens, time, retries or refusals it took>
- **Cause:** <the instruction, contract, package or code that led to it> (<citation>)

## Where the fix belongs

- **<Problem title>:** <location from the fix-location table>. <The change in one or two sentences.>
  <Inside the BDK repository, for a BDK problem: the file, the current sentence quoted, the proposed sentence.>

## For a BDK issue

<Only the BDK problems (kernel, stage skill, role contract, dispatch template), in words: what BDK did, what it should do, how often, and the BDK version from the report.>
<No project code, no fenced block, and code spans only for `bdk` commands, rule ids, ticket or ledger ids, roles, settings keys, `/bdk:` skills and paths under `.bdk/`.>
<When there is no BDK problem, write "No BDK problem found in this session.">
```
