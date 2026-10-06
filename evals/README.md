# Skill evals

Measurement harness for BDK skills: real Claude Code sessions with the BDK plugin on a pinned fixture repository, repeated per cell and compared against an A/A noise floor. Why the evals exist, what each suite measures, how to read a report, how to add a task file or a stage case and the provider facts the harness relies on: [Evals](../docs/guide/contributing/evals.md) in the contributor guide.

```bash
pnpm eval <suite> --probe          # one run per cell: per-cell cost and the projected series
pnpm eval <suite> [--runs N]       # the measured series (5 runs per cell by default); --run-cap USD per session (15)
pnpm eval rules-noop --patches <name,...> [--probe]  # M2 of those patches only
pnpm eval with-without --skill bdk:<name>|bdk-craft:<name> --tasks <file> [--fixture default|none] [--probe]
pnpm eval stages --skill <name> [--case <id,...>] [--probe]
pnpm eval check                    # render and validate every suite's config; no credentials, no model call
pnpm eval report <suite>           # evals/results/<suite>/report.md from the committed rows
```

Suites: `execute-ab`, `review-models`, `rules-noop`, `stages`, `with-without`. Probe first, and start a measured series only after its projected cost is approved.
