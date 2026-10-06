# Design

## Context

`classifyDiff` (`kernel/src/part/use-cases/diff.ts`) builds the forbidden globs of a target in `ownSets`. For the Change target it takes the `do-not-touch` of every part with a `part start` marker, and a done part keeps its marker. The review stage runs after every part is done, so a review fix meets the union of all parts' lists.

## Decisions

### D-1: the Change target forbids nothing

A `review-fix` ticket's diff is checked against no `do-not-touch` glob.

`do-not-touch` is a field of a plan part and constrains that part's tasks (`kernel-state`, plan part; the implementer and simplifier role contracts apply it to "the task"). A review fix belongs to no part: its scope is the round's blocking entries, which name whatever files the review found at fault, and it already declares every path it touches (T42). The review entries and the review of the next round are what bound it.

Alternatives considered:

- **Only parts in flight (started, not done).** Keeps the union for parts still executing. It lost: an in-flight part's list still constrains that part's tasks, not a fix of the Change, and the work-in-flight rule already keeps a review fix's diff away from another part's uncommitted files. It also adds a "done" fact the classifier does not read today, for a case (a review round while parts still execute) the pipeline does not reach.
- **Only the parts that own none of the path.** A path one part declares and another part forbids would pass. It lost: a review fix may touch a path no task declares (`src/util.ts` in the existing scenario), so ownership cannot decide it, and the rule would stay hard to predict for the user.
- **Keep the refusal, change its `instead`.** Telling the user to edit the plan parts is what made `plan-verify` stale in #160. It lost: there is no plan edit that is correct here.

## Risks / Trade-offs

- A review fix can now change a file the plan meant to protect, such as a vendored directory. The review entries name the files to fix, and the next review round and the PR review see the change, so this is reviewed, not silent.
