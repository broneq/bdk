---
name: propose
description: 'Opens a BDK Change from an intent or a GitHub issue - runs openspec new change with the BDK schema and writes proposal.md with the capabilities the design stage works from. Use when starting a feature or fix in a BDK project, when asked to "start a change", "propose" or "open a change for issue #N", or when /bdk:run reaches the propose stage.'
argument-hint: '"<intent>" | #<issue> | <issue URL> [--name <change>]'
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(openspec *) Bash(gh issue view *) Read Write Edit Glob Grep AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Propose

Leave one opened OpenSpec Change whose `proposal.md` says why and what, with capabilities that match the project's main specs. Run each command on its own, without `;`, `&&` or pipes. Never commit, create a branch, write to GitHub or start the design stage.

## 1. Check the configuration

When the block above says `BDK not configured: run /bdk:setup`, or `BDK configuration invalid`, stop: create nothing and tell the user that line (for an invalid one, that `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config check` lists the problems). Otherwise note `policy.questions` from it (`stop` when absent).

Done when the project is configured, or you have stopped.

## 2. Read the input

- An issue reference (`#42`, `42`, `owner/repo#42`, an issue URL): run `gh issue view <ref> --json number,title,body,labels,state,url`. Pass `#42` as `42`, and `owner/repo#42` as `42 --repo owner/repo`. When it exits non-zero, stop: create nothing and quote the `gh` error.
- Any other text: the intent, as the user wrote it.
- No argument and no request in the conversation: ask the user what to change, and create nothing until they answer.
- `--name <change>` (as `/bdk:run` passes it): the Change's name, taken off the input. When it does not match `^[a-z0-9][a-z0-9-]*$`, stop: create nothing and name the rule.

Done when you hold the issue's title and body, or the intent, and the name when `--name` gave one.

## 3. Read the main specs it touches

Run `openspec list --specs`. Read in full, with Read, `openspec/specs/<id>/spec.md` of every spec whose id or purpose touches the issue or intent. Read only the code the Impact section needs to name (files and modules); mapping the code is the design stage's work.

Done when you know, for each behaviour the change touches, which existing spec holds it or that none does.

## 4. Settle open questions

An open question is only one the input and the specs cannot settle and whose answer changes the scope: two readings of the intent that change different behaviour, a closed issue. Where a behaviour belongs is not a question: step 3 settles it (an existing spec that holds it is modified; otherwise the capability is new). With none, ask nothing.

- `policy.questions: stop`: ask them all in one `AskUserQuestion` call (at most 4), the recommended answer first.
- `decide-and-record`, or `AskUserQuestion` not available: take the recommended answer, and record each as a bullet in a last section `## Decided without the user` of `proposal.md`.

Done when every open question has an answer.

## 5. Open the Change

With `--name`, use that name. Otherwise read `openspec/config.yaml` with Read first: when an entry of `rules.proposal` says how a Change is named ("A change is named `v3-<N>-<slug>`"), follow it, N being the issue number. Without such a rule, name it in kebab-case, two to five words of the change; from an issue, `<issue-number>-<slug>` (`42-csv-export`). Either way the name matches `^[a-z0-9][a-z0-9-]*$`. When `openspec/changes/<name>/` exists: with a `proposal.md`, stop and report that Change and its proposal path, changing nothing; without one, write the proposal into it. Otherwise run `openspec new change <name> --schema bdk`.

Done when `openspec/changes/<name>/.openspec.yaml` exists.

## 6. Write the proposal

Run `openspec instructions proposal --change <name>`. Follow its `<instruction>` and project rules, fill its `<template>`, and write `openspec/changes/<name>/proposal.md` with Write. Remove the template's comments.

- From an issue: the first line under Why names it (`Tracks #42.`). Carry its scope into What Changes, its acceptance signal into the capabilities, and what it names as out of scope or owned by another issue (`#40`) into Out of scope.
- Modified Capabilities: the exact id of an existing main spec, from step 3. New Capabilities: an id no main spec has, never a near-duplicate of one. Write `None.` under an empty heading.
- A change of no behaviour (refactoring, tooling, docs) names no capability: set `skip_specs: true` in `.openspec.yaml` instead.
- Why and what only; no how, no order of work.

Done when `proposal.md` holds Why, What Changes, Capabilities, Out of scope and Impact, and every Modified id is in `openspec list --specs`.

## 7. Verify and report

Run `openspec status --change <name>`: `proposal` must be done. Then report in a few lines:

- the Change name and the path of `proposal.md`;
- the New and Modified capabilities;
- every decision taken without the user, exactly the bullets of `## Decided without the user` (a choice you made between readings of the input belongs there, not only in the report);
- the next stage: `/bdk:design <name>`.

End your turn there; the Change stays uncommitted for review.
