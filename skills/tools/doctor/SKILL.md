---
name: doctor
description: Diagnoses the BDK installation of this project with bdk doctor and walks the user through each repair. Use when BDK misbehaves, a kernel command fails, or after an upgrade.
allowed-tools: Bash(bdk *) Bash(echo *) AskUserQuestion Skill
disable-model-invocation: true
---

!`bdk ctx skill doctor 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: doctor" heading appears above, run `bdk ctx skill doctor` first and apply its output; on a `BDK STOP` line, stop and report it.

# Doctor

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context.

Bring the project's BDK installation to a clean `bdk doctor` report, or to a list of what is left and why. Done when the last `bdk doctor --json` report is shown to the user with every remaining finding and its repair.

When the kernel itself does not start (a `BDK STOP` line above), the context lines already name the repair: report it and stop.

## 1. Diagnose

Run `bdk doctor --json`. Each finding has an `id`, a `level` (`ok`, `warn`, `fail`), a `summary` and exactly one `repair`. When `ok` is true and no finding is `warn` or `fail`, report the kernel version and stop.

## 2. Apply the safe repairs

Run `bdk doctor --fix --json`. It applies the repairs that need no system change (the index rebuild, the schema refresh, the modeline) and never installs software. Then run `bdk doctor --json` again for the findings left.

## 3. Walk the rest

Sort the remaining findings, `fail` before `warn`, and take each by the kind of its `repair`:

- **A `bdk` command or a `/bdk:` skill** (for example `bdk rebuild` or `/bdk:setup`): it changes only BDK's own files in this project. Ask with `AskUserQuestion`, showing the summary and the repair, and run it on a yes.
- **A system change**: anything else, such as an install line, a version manager, or a change outside the repository. Show the exact command and what it changes. Run nothing yourself: a system change is made only after the user agrees to that exact command, and they run it in their own shell (`! <command>` in the prompt).

A finding the user declines stays in the report as declined.

## 4. Report

Run `bdk doctor --json` once more and report: the repairs applied, the findings left with their repair, and the ones the user declined.
