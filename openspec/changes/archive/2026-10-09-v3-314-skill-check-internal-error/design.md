## Context

`main` in `plugins/bdk-skill-kit/src/main.ts` maps a `ConfigError` or a `node:util` `parseArgs` error to `skill-check: <reason>` and exit 2, and rethrows anything else; `src/cli.ts` sets `process.exitCode` from `main` without a catch, so Node prints the stack and exits 1. `runChecks` in `src/runner.ts` calls every rule's `check` and `checkProject` without a guard, so a throwing plugin rule takes the same path. Reproduced with the built bundle: an absolute `dirs` entry in a config outside the project (#310) ends in `ENOENT` with a stack trace and exit 1.

## Goals / Non-Goals

**Goals:**

- No error leaves `skill-check` as exit 1; exit 1 keeps meaning "findings".
- One stderr line by default; the stack is available on request.
- A rule failure names the rule and the file.

**Non-Goals:**

- Fixing the discovery bug itself (#310).
- Turning a throwing rule into a finding and continuing the run.

## Decisions

### D1. Exit 3, not exit 2

An internal error exits 3. Exit 2 means "your arguments or config are wrong; fix them", which the user can act on. An internal error means the checker or a plugin rule is broken; editing the config or the skills does not help. A distinct code lets CI and the skill say the right thing. Alternative: exit 2 for both, as ESLint does; it lost because it merges two cases that need different actions, and a new code costs nothing to callers that only test for 0.

### D2. The stack behind `SKILL_CHECK_DEBUG`

A non-empty `SKILL_CHECK_DEBUG` prints the stack (via `util.inspect`, so an error's `cause` chain is shown) after the one line. Alternatives: `DEBUG`, which the `debug` package and many tools read with namespace semantics and would switch on output in unrelated setups; a `--debug` flag, which a CI job running the skill's command or a wrapper cannot add without changing the command line, and which a `parseArgs` failure could not honour. A tool-named variable is unambiguous and reaches every invocation.

### D3. The runner wraps a rule error with its rule and file

`runChecks` catches an error thrown by `check` or `checkProject` and rethrows `rule <id> failed on <file>: <message>` (`... failed in the project check: ...` for `checkProject`), keeping the original as `cause`. The one line then points at the broken plugin rule. Alternative: report the throw as an error finding and go on; it lost because a crash would again exit 1 like findings, which is the bug, and a baseline could suppress it. Alternative: leave the message bare; it lost because "boom" alone does not say which of many plugin rules failed.

### D4. `main` owns the mapping; `cli.ts` stays thin

`main` catches everything: `ConfigError` and argument errors exit 2, everything else exits 3. `main` is what the tests drive, so the behaviour is tested in-process, and a bundle test proves the built CLI end to end. A non-`Error` thrown value is printed with `String(value)`.

### D5. The skill names exit 3 in one sentence

The eval case `skill-check-internal-error` (a project rule that throws) scored 1.00 over 3 runs both with the skill text from before this Change and with a longer paragraph on how to handle exit 3: the one-line CLI message alone leads the model to the broken rule and keeps it off the skill. The skill therefore names exit 3 in one sentence, so its list of exit codes stays complete, and carries no extra handling advice. Alternative: the longer paragraph (what to report, `SKILL_CHECK_DEBUG`); it lost because it changed no outcome and every line of a skill costs context on each call. The case stays as a regression guard for the message, with its numbers in `plugins/bdk-skill-kit/evals/README.md`. The `bdk` eval suite's free CI loader check covers only `plugins/bdk/evals/` (`skill-evals` spec); extending it to every plugin is out of scope here.

## Risks / Trade-offs

- [A caller treated any non-zero code other than 2 as findings] → that caller was misled by crashes before; `--help`, the spec and the skill now name exit 3.
- [The one line hides where the error came from] → `SKILL_CHECK_DEBUG=1` prints the full stack and its causes; `--help` says so.
