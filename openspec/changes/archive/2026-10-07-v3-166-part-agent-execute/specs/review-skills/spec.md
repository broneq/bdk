## MODIFIED Requirements

### Requirement: Review skill shape

`/bdk:cr` and `/bdk:pr-review` SHALL live at `skills/tools/cr/SKILL.md` and `skills/tools/pr-review/SKILL.md`, a directory the `skills` array of `.claude-plugin/plugin.json` lists. Each SHALL:

- start its body with the two context lines of `kernel-cli`, Output modes, naming its own skill;
- stay at or below 200 lines in `SKILL.md`;
- name BDK skills, roles and agents with the `/bdk:` and `bdk:` namespace;
- name no model;
- set `disallowed-tools: Edit Write NotebookEdit`, except that `cr` sets `disallowed-tools: Edit NotebookEdit`.

`cr` SHALL write state only through kernel commands and SHALL write no file of its own but the merged report's draft under `.bdk/.machine/drafts/`, which `bdk log ingest --file` reads (#166); `hooks pre-tool` holds the main thread to that directory while the round's ticket is open (`kernel-cli/hooks`, Pre-tool guards, Report drafts). There is no `.bdk/cr/` report. The human report is the file `bdk review render` writes. Its `allowed-tools` SHALL be:

- the kernel pair of `kernel-cli`, Invocation;
- `Agent`, `SendMessage`, `Skill`, `Read`, and `Bash(git diff *)` and `Bash(git log *)` for reading the range;
- `Write`, for the merged report's draft;
- `AskUserQuestion`, `Bash(lavish-axi *)` and `Bash(gh issue create *)` for the report.

`pr-review` SHALL also allow `Bash(lavish-axi *)`. `cr` SHALL NOT set `disable-model-invocation`, so `/bdk:run` can start it through the `Skill` tool. Neither skill SHALL reference `scripts/bdk_run_state.py` or a v2 agent.

#### Scenario: cr writes only its merge draft

- **WHEN** the content test reads `skills/tools/cr/SKILL.md`
- **THEN** its frontmatter has `disallowed-tools: Edit NotebookEdit`, its `allowed-tools` grants `Write` without a path, its body names `.bdk/.machine/drafts/` as the only place it writes, and names neither `.bdk/cr/` nor `bdk_run_state.py`

#### Scenario: no v2 agent named

- **WHEN** the content test reads every file under `skills/tools/cr/` and `skills/tools/pr-review/`
- **THEN** none names `bdk:code-reviewer`, `bdk:architecture-reviewer`, `bdk:duplicate-detector`, `bdk:dead-code-detector`, `bdk:static-analyse`, `bdk:test-runner` or `general-purpose`

#### Scenario: report tools granted

- **WHEN** the content test reads the frontmatter of both skills
- **THEN** `cr` allows `AskUserQuestion`, `Bash(lavish-axi *)` and `Bash(gh issue create *)`, and `pr-review` allows `Bash(lavish-axi *)`
