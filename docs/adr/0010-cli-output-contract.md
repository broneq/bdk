---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/src/shared/cli/tests/run.test.ts
  - plugins/bdk/tests/cli.test.ts
  - plugins/bdk/tests/hooks.test.ts
---

# ADR-0010: CLI output contract - a "no" is exit 1 with a normal result, and no exit code refuses work

## Context and Problem Statement

Skills, evals and tests call `bdk` and act on what it prints and how it exits. The draft 1 kernel used its exit codes to govern: 82 refusal rules in the classes `policy/`, `guard/`, `state/` and `kernel/`, exit codes 2 to 5 that meant "you may not do this now", and commands that read a body from stdin with a 3 second wait (14 timeouts in run B1). That moved the order of the work out of the skill text into the CLI ([ADR-0003](0003-v3-architecture-skills-first.md)). What does a `bdk` command print, how does it exit, and what does an exit code mean to the skill that called it?

## Decision Drivers

- **The skill decides:** an exit code is information for the caller, never a stop.
- **Stable for machines:** skills, evals and tests match on codes and exit values; a meaning that changes breaks them silently.
- **Cheap to read:** the reader is a model or a program; one stream, one document, no decoration.
- **Never hang:** an agent's Bash call must not wait on input nobody gives.

## Considered Options

1. **Three error classes, exit 0-4, exit 1 as "no" with a normal result, no refusal class.**
2. **The draft 1 refusal classes** (`policy/`, `guard/`, `state/`) with their own exit codes.
3. **Exit 0 always**, the outcome only in the output.

## Decision Outcome

**Chosen option: 1.**

- **Streams.** stdout holds only the result; stderr only errors and warnings in text mode. No colour, no progress output, nothing that depends on a terminal, and items in a stable order, so the same input gives byte-identical output.
- **`--json`.** Every command takes it and then prints exactly one compact JSON document on stdout, valid against the zod schema the command declares: its result, or `{"error": {"code", "message", "hint"}}`. stderr stays empty, so a caller parses one stream.
- **Errors.** A code is `<class>/<name>` with the class `usage`, `env` or `internal`; a code never changes meaning once released. A slice adds its own names, never a new class.
- **Exit codes, and only these:** 0 success; 1 the command ran and its answer is "no" (a red check, a plan fault), with the result on stdout as on success; 2 `usage/*`; 3 `env/*`; 4 `internal/*`. There is no `policy/` or `guard/` class: no exit code means "you may not do this now".
- **No waiting.** A command reads stdin only for an explicit `-` argument, and never prompts or waits.
- **The hook commands speak the host's protocol instead.** `bdk hooks` prints the host's hook JSON and exits 0 for every decision, a denial included, because the host reads hook output only on exit 0. A deny by exit 2 lost: it collides with `usage/`, so a stale bundle answering `usage/unknown-command` would block every Bash call. `hooks.json` turns a failure of the guard into the host's non-blocking exit 1 and a failure of the session start into a visible exit 2.

It is the only option that leaves every decision about the work to the skill, while still telling the skill everything a command found.

### Consequences

- ✅ A red check or a plan fault is an ordinary result the skill reads and acts on, as with `grep`, `diff` or a linter.
- ✅ A caller tells "no" (1) from "called wrongly" (2), "the environment is missing something" (3) and "a defect" (4) without parsing text.
- ✅ No command can hang an agent on stdin.
- ❌ A skill that ignores exit 1 goes on after a red check; nothing in the CLI stops it, so the skill text and its evals carry that rule.
- ❌ Renaming or repurposing an error code is a breaking change, also when no test catches it.
- 🟡 The hook group is the one exception to the exit codes; its tests hold it.

## Pros and Cons of the Options

### 1 - Three classes, exit 1 as "no"

- Good: the CLI answers, the skill decides; stable, small vocabulary.
- Bad: process rules have no enforcement in the CLI.

### 2 - Refusal classes

- Good: the CLI can stop a skill that skipped a step.
- Bad: the process lives in the kernel and changes with every model; draft 1 failed on it (1,349 of 1,808 Bash calls in B1 were `bdk`).

### 3 - Exit 0 always

- Good: no exit code to misread.
- Bad: every caller must parse text to see a failure; a red check looks like success to a shell.
