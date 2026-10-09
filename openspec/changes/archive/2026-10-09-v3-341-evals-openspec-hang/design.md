# Design

## Context

- The failed run: `debug-fix`, run at `-j 3` from the agent session of #262 on 2026-10-09 (Claude Code 2.1.292, clean `HOME`, the `git` shell prefix of "Host limits"), kept workspace `/private/tmp/e-i4mu2Y`. Global OpenSpec 1.13.2 at `/opt/homebrew/bin/openspec` (`#!/usr/bin/env node`, resolved to the nvm Node 24.21.0 on `PATH`).
- `README.md` "Host limits" already holds one `openspec` entry (#300): a pnpm shim under the home directory fails with `Cannot find module`. That is a fast failure; this one is a hang.
- `plugins/bdk/hooks/hooks.json` runs `node dist/bdk.mjs hooks pre-tool-use` before every Bash call with a 10 s timeout. Hooks run as a plain host process, outside the run's OS sandbox, so their `durationMs` in the run transcript measures the host, not the sandbox.

## Cause

The transcript of the failed run (`config/projects/*/<session>.jsonl`) times every Bash call and every `PreToolUse` hook:

| | Hook `durationMs` | Bash call wall time |
|---|---|---|
| Before the first `openspec` call (4 calls, 14:34:41-14:34:51 UTC) | 94-122 | under 1 s (`git status`, `node bin/tally.js` included) |
| First `openspec new change` (14:34:58) | 3 732 | killed at the 120 s timeout |
| Every later call (14:37-14:44) | 6 735 to 12 689; 8 of 10 hit the 10 s timeout | `ls -la` 27 s, `ls -R` 31 s, `type -a openspec` 46 s, `head -5` 43 s, `git status` 35 s; every `openspec` call, `--version` included, killed at 20-60 s |

The hook slowed down before `openspec` started, and it runs outside the sandbox; commands without `node` slowed down 30 to 100 times as well. So the whole host stalled, and `openspec` (a Node program that loads several hundred modules) was only the call that did not finish within its timeout.

The other sessions on the machine at that time (their transcripts under `~/.claude/projects/`) show the same window, 14:35 to about 15:00 UTC: four agent sessions working on #249, #262, #338 and #339 each saw plain Bash calls take tens of seconds (`echo waiting` 15 s, `herdr pane read` 48 s, `grep -rn` over `docs/` 79 s, `ls openspec/changes/archive` 104 s, `grep -rn` over `skills agents src` 160 s). In that window they ran two `pnpm install`, two VitePress dev servers, headless Chrome screenshots, a `plan-*` eval run and the three `debug-fix` runs, each with its own subagents, on a 12-core, 24 GB machine. The system log that would show memory pressure is not readable without admin rights, so which resource ran out is not recorded; that the stall was host-wide is.

## Measurement

`diagnose-bug-reproduced` (calls `openspec new change`, `openspec status`, `openspec instructions` early), 9 runs at `-j 3`, `--ablation none`, clean `HOME`, the `git` shell prefix, Claude Code 2.1.292, global OpenSpec 1.13.2, 2026-10-09 18:25 UTC, on a machine without other heavy work:

- Every run called `openspec` 5 to 8 times; every call returned in 0.4 to 1.8 s. No call hung.
- `PreToolUse` hook `durationMs`: median 97 to 117, max 290 per run.
- Score 0.99 (8 of 9 runs 1.00), 213 s, $4.48. The one miss is `one-acceptance-scenario` (the part listed a second scenario), unrelated to `openspec`: #359.

The acceptance signal of #341 holds on both branches: the case passes the `openspec` step in 9 of 9 runs at `-j 3`, and the README names the limit.

## Goals / Non-Goals

**Goals:**

- The cause is recorded where the next contributor who sees the symptom looks: README "Host limits".
- A contributor can tell a host stall from a broken `openspec` from the kept run alone.

**Non-Goals:**

- Fixing the `one-acceptance-scenario` miss (#359).
- Making a run robust to a stalled host.

## Decisions

### D1. A README "Host limits" entry, no runner change

The entry names the symptom, the evidence that tells it apart (hook `durationMs`, plain commands slow too), the cause and the way to avoid it: start paid runs on an otherwise idle machine (no other agent sessions installing, building or driving a browser), keep `-j` at 3 or below, and re-run a run that shows the signature instead of reading its score.

Alternatives considered:

- A pre-run load check in `evals/run.ts` (warn when `os.loadavg()[0]` exceeds the core count). Lost: the stall began minutes into the runs, after any pre-run check; load average does not show memory pressure, the likelier resource; and a warning nobody acts on mid-run adds code without changing an outcome (global rule: no machinery without a concrete need it removes).
- A grader or run-time watchdog that fails a run whose hooks time out. Lost: graders read the result, not the host; it would turn a stall into a failure that still costs the run, and the README check of a kept transcript gives the same answer to the contributor who looks.
- Lower the default `-j` in the README commands. Lost: `-j 3` and `-j 4` passed (this measurement; #262 recorded `-j 4`); the concurrency of the eval runs was not the cause, the other work on the host was.
- Report upstream to OpenSpec. Lost: OpenSpec is not at fault (`--version` hung only while every process on the host was slow).

### D2. Point the existing `openspec` entry at the new one

The `openspec` entry covers a fast `Cannot find module` failure. A contributor who sees `openspec` hang reads that entry first, so it gets one sentence naming the new entry.

## Risks / Trade-offs

- The resource that ran out is not identified (no system log access). The README advice (idle machine, re-run) holds for any of CPU, memory or I/O.
