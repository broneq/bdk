# Tasks

## 1. Cause

- [x] 1.1 Reproduce: run `diagnose-bug-reproduced` 9 times at `-j 3` with the README command (clean `HOME`, `git` shell prefix, `--keep-temp`) and time every `openspec` call and `PreToolUse` hook from the kept transcripts; record in design "Measurement"
- [x] 1.2 Time every Bash call and hook of the failed run `/private/tmp/e-i4mu2Y` and of the other sessions on the machine in its window; record in design "Cause"

## 2. README

- [x] 2.1 `plugins/bdk/evals/README.md`, "Host limits": add the entry "An overloaded host stalls every process of a run" (design D1)
- [x] 2.2 The `openspec` entry of "Host limits" names the new entry for a hang (design D2)

## 3. Acceptance and gates

- [x] 3.1 Acceptance signal: the cause is in design "Cause" and in the README; `diagnose-bug-reproduced` called `openspec` without a hang in 9 of 9 runs at `-j 3` (task 1.1)
- [x] 3.2 Run every CI check (`.github/workflows/`), `pnpm docs:reference`, `openspec validate v3-341-evals-openspec-hang --strict` and `openspec validate --specs --strict`
