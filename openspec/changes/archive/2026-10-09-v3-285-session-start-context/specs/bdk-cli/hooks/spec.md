## MODIFIED Requirements

### Requirement: Session start context

`bdk hooks session-start -` SHALL resolve the configuration of the project around the payload's `cwd` (the hook's working directory when absent), as `bdk-cli/config` "Configured project" defines it. In a configured project with a valid configuration, it SHALL add a short BDK context for the model through `hookSpecificOutput.additionalContext` with `hookEventName` `SessionStart`. The context explains how work is done in a BDK project, so that the main session picks the right `/bdk:*` command or edits directly before any skill runs. It SHALL be at most six lines and SHALL say, in this order:

1. that BDK is configured in this project, and the project root;
2. that work with behaviour to specify runs as an OpenSpec Change through the stages `/bdk:propose`, `/bdk:design`, `/bdk:plan`, `/bdk:execute`, `/bdk:auto-review` and `/bdk:close`, named in this order;
3. that `/bdk:run` carries an intent or a list of issues through every stage to a pull request, `/bdk:debug` fixes a reported bug that needs diagnosis, and `/bdk:pr-review` reviews a pull request;
4. that a stage that stopped resumes from its files, so running the same command again continues it;
5. that a small edit that can be seen whole (a typo, a version bump, a one-line fix) is done directly, without a Change.

Apart from the project root, the context SHALL be the same text in every configured project, whatever its settings and whatever its state under `.bdk/runs/` and `openspec/changes/`. It SHALL NOT name `bdk` CLI commands or settings keys. It SHALL show the user nothing.

#### Scenario: Configured project

- **WHEN** the session starts in a project with `.bdk/settings.yaml` and `openspec/`, and a valid configuration
- **THEN** stdout holds `hookSpecificOutput` with `hookEventName` `SessionStart` and an `additionalContext` of at most six lines that names BDK and the project root, names `/bdk:propose`, `/bdk:design`, `/bdk:plan`, `/bdk:execute`, `/bdk:auto-review` and `/bdk:close` in this order, names `/bdk:run`, `/bdk:debug` and `/bdk:pr-review`, says that a stage continues when its command runs again and that a small edit is done directly without a Change; there is no `systemMessage`, and the exit code is 0

#### Scenario: No CLI pointers

- **WHEN** the session starts in a configured project with a valid configuration
- **THEN** the `additionalContext` contains neither `bdk config show` nor `bdk --help`

#### Scenario: Guard on

- **WHEN** the configured project sets `hooks.subagent-git: true`
- **THEN** the `additionalContext` is the same text as in the same project without that setting, and does not contain `hooks.subagent-git`

#### Scenario: Same text whatever the run state

- **WHEN** the session starts in a configured project that holds `.bdk/runs/run.json` and an open Change under `openspec/changes/`
- **THEN** the `additionalContext` is the same text as in the same project without them
