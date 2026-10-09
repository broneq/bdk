Status: done

## Bug
- Report: tally total crashes with "TypeError: total.toFixed is not a function" after tally add 5
- Reproduction: debug/reproduction.md (tools.e2e cli)
- Root cause: bin/tally.js:16 `add` pushes the text argument instead of the parsed amount, so `total` sums strings

## Fix
- Test: tally / Total / Total after an add -> test/tally.test.js "total after an add prints the sum"; red seen; green seen
- Changed files: bin/tally.js, test/tally.test.js
- Commits: eab9957 fix(total): print sum after an add (part 01); 1e180f6 docs(openspec): fix Change fix-total-crash

## Review
- Status: done
- Rounds: 1 (2 findings: 1 accepted, 1 deferred; 0 to fix)

## Blockers
- None.

## Decisions taken without the user
- Gate: policy.gates.design auto.
- Review triage: policy.gates.review auto.
