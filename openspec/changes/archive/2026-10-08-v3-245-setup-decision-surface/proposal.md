# Proposal

## Why

Tracks #245.

D4 of `docs/design/2026-10-07-v3-skills-decisions.md` makes Lavish optional: `triage` and `design-draft` ask through a Lavish page when `npx -y lavish-axi` runs in the session and through `AskUserQuestion` otherwise, and `/bdk:setup` reports which path the project gets. The setup skill (#181) does not report it yet, so a user learns which decision surface they get only when the first question comes, and does not learn that installing `lavish-axi` would give them a browser review page.

## What Changes

- `/bdk:setup` (`plugins/bdk/skills/setup/SKILL.md`) runs `npx -y lavish-axi --version` once in its final step and adds one line to its report: "questions and triage use a Lavish page" when the command exits 0, or "questions and triage use AskUserQuestion; install lavish-axi for a browser review page" when it fails. The check runs on every setup run, a re-run included. The skill's `allowed-tools` gains `Bash(npx -y lavish-axi --version)`.
- BDK does not install Lavish, and setup writes nothing for the decision surface: no settings key, no permission rule. The consumers keep deciding at the moment they ask (design-draft and triage fall back when the open command exits non-zero, D4).
- The skill is rebuilt with `/skill-creator` (CLAUDE.md "Building skills (v3)"); the eval cases come first. The existing cases `setup-web-app` and `setup-library` are extended with a `lavish-axi` stand-in in `node_modules` (as the `design-draft-*` and `triage-*` cases do): one that answers `--version` in `setup-web-app`, one that fails in `setup-library`, each with a grader on the reply.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-setup`: a new requirement that setup reports the decision surface, and the "Eval cases" requirement names the two cases that grade both paths.

## Out of scope

- How `design-draft` (#190) and `triage` (#195) choose and fall back; they already do on their own (issue, "Input").
- Installing Lavish or adding a permission rule for it.

## Impact

- Changed: `plugins/bdk/skills/setup/SKILL.md`, `plugins/bdk/evals/setup-web-app/`, `plugins/bdk/evals/setup-library/`, `plugins/bdk/evals/README.md` (the `setup-*` paragraph), spec `bdk-setup`.
- Docs: `docs/guide/first-run.md` and `docs/concepts/orchestrators.md` describe the new report line; the Reference is regenerated.
- Ships in the released `bdk` plugin (`skills/`); `evals/` does not ship. No CLI, hook, `package.json` or lockfile change.
