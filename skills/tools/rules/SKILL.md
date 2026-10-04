---
name: rules
description: Audits the project's lessons into rules, captures one lesson, or checks the rule files, always through the bdk rules commands. Use when the user asks to add, capture or clean up rules, or to turn repeated findings into a rule.
argument-hint: "[audit | capture <lesson> | check]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *) Read Grep Glob Edit AskUserQuestion Bash(lavish-axi *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill rules 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: rules" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill rules` first and apply its output; on a `BDK STOP` line, stop and report it.

# Rules

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context.

The project's rules are the files under `.bdk/rules/`, read with the rule pack of the plugin, selected per package by `applies` and cited by id. The kernel owns them: you create a rule only with `bdk rules accept`, and the generated `.claude/rules/bdk-generated*.md` files come from `bdk rules export --claude`; never write either by hand. Run kernel commands as `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <command>`; this skill writes them as `bdk <command>`. Add `--json` to every command whose output you act on.

The first argument picks the mode: `audit` (also with no argument), `capture <lesson>` or `check`. Done when the mode's report is given.

## What a rule is

Read "What a rule is" in `rules/README.md` of the plugin (`${CLAUDE_PLUGIN_ROOT}/rules/README.md`) before you judge a candidate. A rule is a choice among valid alternatives, stated as one instruction, of kind `house` or `knowledge`. These are never rules:

- a fact about the project's own system, which belongs in code, a doc comment, documentation or a spec;
- a process lesson ("the negative test was forgotten"), which stays a `learning` or `finding` entry;
- a principle with no alternative, or knowledge capable models already have.

A candidate that passes is written as one imperative, falsifiable sentence, without the story of the incident that taught it. It gets the narrowest `applies` globs that still cover the code it governs (none means global), a severity, and for `knowledge` its `source` and the date it was `verified`. Before proposing it, check that no rule already covers it: `bdk rules explain <file>` for a file in its scope lists the rules that apply there. When one covers it, propose no new rule and say which one does.

## audit

1. Run `bdk rules stats --entries --json`. Group the `recurring` items and the `entries` by meaning, since a fingerprint only groups near-identical wording. Skip items already `adopted`.
2. Drop every group that is not a rule (above), and say in one line why for each.
3. Propose the rest through the `Asking the user` section of the context above, one item per candidate: the sentence, kind, severity, `applies`, prefix, and the entry ids it comes from. The prefix is one the project already uses under `.bdk/rules/`, or a new one the user picks; never `BDK`. Nothing is adopted before the user accepts it.
4. For each accepted candidate, run `bdk rules accept "<text>" --prefix <PREFIX> --kind <kind> --severity <severity> --applies <glob>... --from <changeId>/<L-id>... --json`, adding `--source` and `--verified` for `knowledge`. On a refusal, report its `why` and continue with the next.
5. Run `bdk rules prune --json` and offer each listed rule for removal with its reason (`no-match`: its globs match no file; `uncited`: no recent Change cited it). A bundle rule (`BDK-*`) is switched off with `bdk config set rules.disabled`, never edited. For a project rule the user wants gone, see "Removing a rule".

Report the rules adopted with their ids, the candidates rejected with the reason, and the removals.

## capture `<lesson>`

Distill the lesson into the one sentence and judge it as above. When it is not a rule, report why and where it belongs instead, and write nothing.

- With an active Change on the branch (`bdk change status --json`), record it for the audit: `bdk log add learning "<summary>" --ref <file> --applies <glob>... --body - --json`, with the sentence and the reason in the body. Rules are adopted later from repeated lessons, not from one.
- Without an active Change, adopt it with `bdk rules accept` once the user agrees, since there is no ledger to hold it: propose the rule as in step 3 of the audit and run step 4 with no `--from`.

## check

Run `bdk rules check --json` and `bdk rules export --claude --check --json`. Report each problem with the command that repairs it: a rule file the check refuses is fixed in that file, and a stale projection is regenerated with `bdk rules export --claude`, which you run when the user agrees.

## Removing a rule

A rule is never deleted, so its id is never reused. After the user approves the removal of one project rule, edit its file under `.bdk/rules/` to set `removed`: add `removed: <reason>` to the frontmatter, with the reason the user agreed to (for example "merged into API-1" or "no file matches its globs"), and keep the body. Then run `bdk rules check --json` and `bdk rules export --claude --json`, and report the rule as a tombstone.
