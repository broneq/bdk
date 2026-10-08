# Design

## Context

`/bdk:setup` (#181) ends with step 9, "Verify and report". `design-draft` (#190) and `triage` (#195) already pick their decision surface at the moment they ask: a Lavish page, `AskUserQuestion` when the Lavish open command exits non-zero, or the reply when neither is available (D4). Setup only has to tell the user which path the project gets. The eval cases already stand in for Lavish with a stub in the workspace's `node_modules`, which `npx -y lavish-axi` runs before any installed copy (`plugins/bdk/evals/README.md`, design-block cases).

## Goals / Non-Goals

**Goals:** one report line, decided by one command, graded for both paths.

**Non-Goals:** recording the result anywhere; changing how the consumers decide; a CLI helper (no eval or measurement shows a problem that needs one, CLAUDE.md "Building skills (v3)").

## Decisions

### D1 - The check is part of the final step, not a step of its own

The check runs in step 9 ("Verify and report"), before the report. Every run reaches step 9, a targeted re-run included (step 1 sends it to steps 5, 6 and 9), so the report always holds the line without changing step 1's routing.

- *Alternative: a new step 9 "Decision surface" before the report.* Lost: it renumbers the steps and step 1 would need to name it for re-runs; the work is one command whose only output is a report line.

### D2 - `npx -y lavish-axi --version`, exit code decides

The issue names this command. Exit 0 means Lavish runs; any other exit, or a command that cannot run, means `AskUserQuestion`. `--version` opens no page and needs no browser, so it is safe in any session, including `claude -p`.

- *Alternative: open a probe page as the consumers do.* Lost: it would open a browser tab during setup and need a page and a session end; the consumers already detect a session that cannot open a page at the moment they ask.
- *Alternative: `which lavish-axi`.* Lost: it misses the `npx` cache and a local `node_modules/.bin`, which `npx -y` uses.

### D3 - Nothing is written for the decision surface

Setup writes no settings key and no permission rule for Lavish. A setting would go stale when the user installs or removes Lavish, while the consumers decide at run time anyway; a permission rule for `npx -y lavish-axi *` belongs to the consumers' `allowed-tools`, which already have it. The setup skill's own `allowed-tools` gains only `Bash(npx -y lavish-axi --version)`.

### D4 - Extend two existing eval cases instead of adding two

The issue allows "add or extend a `setup-*` eval case". `setup-web-app` gets a stub that answers `--version` and `setup-library` a stub that exits 1 (the stub of `design-draft-ask`), each with one `llm` grader on the reply. Both cases already run setup end to end, so the check costs no extra run, which serves the speed goal of v3.

- *Alternative: new cases `setup-lavish` and `setup-no-lavish`.* Lost: two more full setup runs per arm to grade one report line.

Without a stub the result depends on the host: a machine with network reaches the real package through `npx -y`. Both cases therefore pin the path with a stub. The stub sits in an untracked `node_modules/`; setup's detection reads manifests and lockfiles, not `node_modules`, so the stub does not change what the other graders check.

## Risks / Trade-offs

- [The first `npx -y lavish-axi` on a machine downloads the package and can take seconds] - acceptable once per setup run; Bash's default timeout covers it, and a timeout counts as "does not run".
- [The `--version` result can differ from what a consumer sees later, e.g. a session without a browser] - the report names the path the project gets by default; the consumers still fall back on their own (D4 of the skills decisions).
