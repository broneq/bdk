**Decision tier: lavish**

This project has `features.lavish` on and `lavish-axi` on PATH, so route this decision point through it instead of the terminal `AskUserQuestion`. Everything about *what* to ask is unchanged - the same bundled question set, the same recommended-option-first ordering, the same "no unresolved decision leaks into the output" rule. Only the surface changes.

Procedure:

1. Read the interface once per session: `lavish-axi --help`. Do not assume flags - the binary is installed and versioned outside this plugin, so its argument shape is its own business and hardcoding it here would be a guess that fails silently on the next release.
2. Pass the whole bundled set in one invocation, exactly as you would have passed it to `AskUserQuestion`: every open decision, each with its options, its recommended option first, and the tradeoff text.
3. Read the selections back and continue.

**Fall back on any failure.** A nonzero exit, an unparseable reply, or a `--help` that does not describe an interface you can use means the decision is still open and unasked - so ask it with `AskUserQuestion` in the terminal instead. Never proceed on an assumed answer, and never report a decision as made because the tool ran.

The fallback is silent about lavish either way: the user configured it, they do not need to be told it was tried.
