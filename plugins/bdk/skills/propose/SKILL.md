---
name: propose
description: 'Opens a BDK Change from an intent or a GitHub issue - saves the source word for word, runs openspec new change with the BDK schema, writes proposal.md with the intent, the acceptance criteria (AC-1..n) and the capabilities, checks conditional criteria in the code with the recon block, asks every scope question in one round, and opens the scope log. Use when starting a feature or fix in a BDK project, when asked to "start a change", "propose" or "open a change for issue #N", or when /bdk:run reaches the propose stage.'
argument-hint: '"<intent>" | #<issue> | <issue URL> [--name <change>]'
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(openspec *) Bash(gh issue view *) Read Write Edit Glob Grep Agent AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Propose

Leave one opened OpenSpec Change whose `proposal.md` says why and what, carries every acceptance point of the source as an AC with a stable id, and names capabilities that match the project's main specs; next to it, the source word for word and a scope log of every change of scope. The acceptance criteria are the reference every later verifier checks against, so never drop, narrow or reinterpret one yourself: only the user does that. Run each command on its own, without `;`, `&&` or pipes. Never commit, create a branch, write to GitHub or start the design stage.

## 1. Check the configuration

When the block above says `BDK not configured: run /bdk:setup`, or `BDK configuration invalid`, stop: create nothing and tell the user that line (for an invalid one, that `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config check` lists the problems). Otherwise note `policy.questions` from it (`stop` when absent) and `models.explorer` when set.

Done when the project is configured, or you have stopped.

## 2. Read the input

- An issue reference (`#42`, `42`, `owner/repo#42`, an issue URL): run `gh issue view <ref> --json number,title,body,labels,state,url,comments`. Pass `#42` as `42`, and `owner/repo#42` as `42 --repo owner/repo`. When it exits non-zero, stop: create nothing and quote the `gh` error. When the body names another issue as the source of its scope (a parent, or an issue it continues or splits from), read that one the same way.
- Any other text: the intent, as the user wrote it.
- No argument and no request in the conversation: ask the user what to change, and create nothing until they answer.
- `--name <change>` (as `/bdk:run` passes it): the Change's name, taken off the input. When it does not match `^[a-z0-9][a-z0-9-]*$`, stop: create nothing and name the rule.

Done when you hold the issue with its comments, or the intent, and the name when `--name` gave one.

## 3. Read the main specs it touches

Run `openspec list --specs`. Read in full, with Read, `openspec/specs/<id>/spec.md` of every spec whose id or purpose touches the issue or intent. Read only the code the Impact section needs to name (files and modules); mapping the code is the design stage's work, and checking a condition is recon's (step 7).

Done when you know, for each behaviour the change touches, which existing spec holds it or that none does.

## 4. Open the Change

With `--name`, use that name. Otherwise read `openspec/config.yaml` with Read first: when an entry of `rules.proposal` says how a Change is named ("A change is named `v3-<N>-<slug>`"), follow it, N being the issue number. Without such a rule, name it in kebab-case, two to five words of the change; from an issue, `<issue-number>-<slug>` (`42-csv-export`). Either way the name matches `^[a-z0-9][a-z0-9-]*$`. When `openspec/changes/<name>/` exists: with a `proposal.md`, stop and report that Change and its proposal path, changing nothing; without one, write the proposal into it. Otherwise run `openspec new change <name> --schema bdk`.

Done when `openspec/changes/<name>/.openspec.yaml` exists.

## 5. Save the source

Write `.bdk/runs/<name>/source/issue.md` once, with Write, word for word: never summarise, reorder or shorten.

```markdown
# Issue #42: <title>

URL: <url>
State: <state>
Labels: <names>

## Body

<the body, exactly as gh printed it>

## Comments

### <author login>, <createdAt>

<the comment, exactly>
```

`None.` under `## Comments` when there are none; each source issue of step 2 follows under its own `# Issue #<n>: <title>` heading. From an intent the file holds `# Intent` and the user's words exactly. Nothing changes this file later.

Done when the file exists and its body matches the source line for line.

## 6. Write the proposal

Run `openspec instructions proposal --change <name>`. Follow its `<instruction>` and project rules, fill its `<template>`, and write `openspec/changes/<name>/proposal.md` with Write. Remove the template's comments. Write it from the source alone; step 8 applies the answers.

- **Why**: from an issue, the first line names it (`Tracks #42.`).
- **Intent**: the issue's goal (or the intent) as a Markdown quote, word for word. When the project's template has no Intent or Acceptance section (a copy older than this plugin), add both after Why anyway.
- **Acceptance**: every acceptance point of the source, its acceptance signal and every point of its scope a user can check, one per line: `- AC-1: <the point, in the source's words where it can be>`. A conditional point keeps its condition (`- AC-3: If the world builder can seed an expired link: add the expiry variant ...`); a step the source asks to do by hand is an AC too. Write it also when the Change sets `skip_specs: true`. Ids are never renumbered.
- **What Changes** from the scope; **Out of scope** what the source names as out of scope or owned by another issue (`#40`).
- Modified Capabilities: the exact id of an existing main spec, from step 3. New Capabilities: an id no main spec has, never a near-duplicate of one. Write `None.` under an empty heading. A change of no behaviour (refactoring, tooling, docs) names no capability: set `skip_specs: true` in `.openspec.yaml` instead.
- Why and what only; no how, no order of work.

Then write `openspec/changes/<name>/scope-log.md`:

```markdown
# Scope log: <name>

Append only. An AC changes only through an entry By: user.
```

Done when `proposal.md` holds Why, Intent, Acceptance, What Changes, Capabilities, Out of scope and Impact, every Modified id is in `openspec list --specs`, and the log exists.

## 7. Check conditional AC in the code

An AC is **conditional** when it holds a condition on the code ("if the world builder can ..."), **unclear** when it names a symbol, file or count the source does not show to exist. With none, write nothing and go to step 8.

Otherwise tell the user in one line, e.g. `Checking AC-3 in the code: bdk:explorer writes .bdk/runs/<name>/explore/propose-recon.md`, and start one agent with the Agent tool in the foreground (`run_in_background: false`): `subagent_type: "bdk:explorer"`, prompt `Run the skill bdk:recon with the arguments: <name> <the AC ids>`, `model` set to `models.explorer.model` and `effort` set to `models.explorer.effort`, each only when the configuration above sets it. Wait for it and read `explore/propose-recon.md`.

Then build `.bdk/runs/<name>/explore/index.md`: read the front matter of every file in `explore/` other than `index.md` and write the whole index again with Write, one line per file:

```markdown
# Explore: <name>

- [propose-recon.md](propose-recon.md) (propose) <question> - <summary>
```

Done when every conditional or unclear AC has a section in the recon file with its `Settles:` line, and the index lists it, or there was none.

## 8. Ask once

List the open scope questions: two readings of the source that change different behaviour; a closed issue; an AC whose condition recon found false (`Settles: does not hold`) or left open; an AC recon shows cannot be met as written; and every AC you would drop, narrow or reinterpret. Each gets options, the default first, and the AC ids it touches. Where a behaviour belongs is not a question: step 3 settles it. With none, ask nothing and go to step 9.

- `policy.questions: stop` and `AskUserQuestion` available: ask them all in this one round, the default first, each option one label and one sentence (at most four per call; ask the rest in the next call of the same round, then go on).
- `decide-and-record`, or `AskUserQuestion` not available: a question that touches no AC takes the default; record it as a bullet of a last section `## Decided without the user` of `proposal.md` and as a log entry `By: setting policy.questions decide-and-record` with `AC: none`. A question that touches an AC is never decided: leave the AC as the source says and append an open entry `By: needs-user`, its default under `After:`. Never put an AC under `## Decided without the user`.

Append each answer or open question to `scope-log.md` with Edit, numbered from `SL-1`:

```markdown
## SL-1
- Stage: propose
- Date: 2026-10-15
- AC: AC-3
- Before: AC-3: If the world builder can seed an expired link: add the expiry variant of the guest test.
- After: dropped
- Why: `seedGuest` takes no `expiresAt` (test/world.ts:41), so the condition does not hold.
- Options: drop AC-3 (default); add `expiresAt` to `seedGuest` and keep AC-3
- By: user
```

Apply each user answer to `proposal.md` with Edit: a changed AC keeps its id, its old text struck (`~~...~~`) and the new text after it, naming the entry (`(SL-1)`); a dropped AC is struck whole and named under Out of scope; a changed intent is struck and rewritten the same way; What Changes and the capabilities follow. An open `By: needs-user` entry changes nothing in the proposal.

Done when every open question is answered, recorded by the setting, or open as `By: needs-user`.

## 9. Verify and report

Run `openspec status --change <name>`: `proposal` must be done. Check with Read that every acceptance point of `source/issue.md` is an AC of `## Acceptance`, struck only where a `By: user` entry says so. Then report in a few lines:

- the Change name and the path of `proposal.md`;
- the AC ids, the New and Modified capabilities;
- the source file, and the recon file with its `Settles:` lines when written;
- every scope-log entry written, with its `By:` line; name each `By: needs-user` entry as waiting for the user, answered by `/bdk:design <name>` in a session that can ask;
- every decision taken without the user, exactly the bullets of `## Decided without the user`;
- the next stage: `/bdk:design <name>`.

End your turn there; the Change stays uncommitted for review.
