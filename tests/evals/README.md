# Legacy skill evals

These are the v2 skill evals of `/skill-creator`: prompts, assertions and recorded iterations per skill. They are replaced by the promptfoo harness in [`evals/`](../../evals/README.md) (T40), which runs real Claude Code sessions with the BDK plugin on a pinned fixture and compares cells against an A/A noise floor. To compare a skill with and without it, use `pnpm eval with-without --skill bdk:<name> --tasks <file>`.

Nothing new goes here. T32 (v2 -> v3 import, Python cut, cleanup) removes this directory together with `.claude/rules/skill-test-eval.md`.
