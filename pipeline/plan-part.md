Write the plan of Change {change} (profile {profile}) as plan parts ({node}): {paths}.

- Frontmatter: `schema: 1`, `id`, `title`, `goal`, `success-measure`, `do-not-touch`, `depends-on`, `spec-impact` (`none` or capabilities).
- At most 8 tasks and 8 KB per part; each task names its `Files:` and its test cases.
- A task is a contract with no implementation code: its goal, the exact signatures and formats other tasks consume, and test cases that each name an input and the expected result, one or more for every behaviour the task states.
- Write the spec deltas of every capability a part names in `spec-impact` to `spec-delta/<capability>.md`, and check each with `bdk spec delta check`, before `done`.
