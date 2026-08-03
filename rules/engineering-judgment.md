# Engineering Judgment Rules

Language-agnostic principles for weighing technical decisions and scope during design and planning.

- **Quality over build cost.** When comparing approaches, weight quality, simplicity, robustness, scalability, and long-term maintainability heavily. Give little weight to implementation effort or time-to-build - surface them for transparency, but they should rarely tip a recommendation. The usual cost/quality tradeoff assumes scarce human labor; that constraint does not hold when the implementation is carried out by AI agents.
- **Fix what's clearly off, even if unrelated.** If something in the codebase, design, or plan clearly looks wrong, inconsistent, or broken while working on something else, address it or flag it explicitly rather than looking past it because it is out of scope.
