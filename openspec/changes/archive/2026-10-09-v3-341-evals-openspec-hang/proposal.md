# Proposal

## Why

Tracks #341.

In one of three `debug-fix` runs recorded on 2026-10-09 (#262), every `openspec` call of the run hung until it was killed, `openspec --version` included, and `diagnose-bug` stopped `Status: blocked`. The issue asks for the cause and for reliable eval runs that call `openspec`. The cause is not OpenSpec and not the run's sandbox: the whole machine stalled at that time (design "Cause"). Nothing in the eval runner can prevent that; the README must name the limit, how to recognise it and how to avoid it.

## What Changes

- `plugins/bdk/evals/README.md`, "Host limits": a new entry "An overloaded host stalls every process of a run", with the signature (hook `durationMs` of ~100 ms grows to the 10 s hook timeout, plain `ls` takes tens of seconds, `node` programs such as `openspec` never finish), how to read it from a kept run's transcript, and how to avoid it (start paid runs on an otherwise idle machine, at most `-j 3`, re-run a run that shows it).
- The `openspec` entry of "Host limits" points to the new entry for a hang (as opposed to a `Cannot find module` failure).
- The measurement and its cause are recorded in design.md.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The `skill-evals` requirement "Local run" already requires the README to name the host limits a case author meets; this Change adds one limit. `skip_specs: true`.

## Impact

- `plugins/bdk/evals/README.md` only. No skill, agent, hook, `bdk` command or settings key changes, so nothing a BDK user sees changes: the eval suite is a contributor tool and is not released. No `docs/guide/` or `docs/concepts/` page changes; no Docs task group.
- Out of scope: the 1-of-9 `one-acceptance-scenario` miss of `diagnose-bug-reproduced` seen during the measurement (#359).
