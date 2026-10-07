Write the plan of Change {change} (profile {profile}) as plan parts ({node}): {paths}.

- Frontmatter: `schema: 1`, `id`, `title`, `goal`, `success-measure`, `do-not-touch`, `depends-on`, `spec-impact` (`none` or capabilities), and `isolation` with `isolation-reason` for a part that needs a worktree.
- `isolation: worktree` when a part touches state outside its `Files:` that a part of the same wave touches too (a lockfile or codegen output both regenerate, migration numbering, snapshots, a whole-project build, a port, a database or fixtures), with `isolation-reason` naming that state; every other part stays `shared` (the default). Parts whose `Files:` overlap get a `depends-on`, never a worktree.
- At most {max-tasks} tasks, {max-files} distinct `Files:` paths and 8 KB per part, since one agent implements a whole part; split a larger unit of work into parts that can share a wave. Each task names its `Files:` and its test cases.
- Every acceptance and `Verification:` line names the exact commands to run, never a set described by exclusion, and none that spends money, needs credentials or reaches a shared or external system unless an accepted `decision` names it.
- A task is a contract with no implementation code: its goal, the exact signatures and formats other tasks consume, and test cases that each name an input and the expected result, one or more for every behaviour the task states.
- Write the spec deltas of every capability a part names in `spec-impact` to `spec-delta/<capability>.md`, and check each with `bdk spec delta check`, before `done`.
