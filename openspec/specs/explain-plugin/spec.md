# explain-plugin Specification

## Purpose

Defines the `bdk-explain` plugin: one skill that answers a question about the code, a flow or a concept as a self-contained, interactive HTML page opened in the browser, without leaving files in the project's `git status`, and the eval evidence that admits it.

## Requirements

### Requirement: bdk-explain is a skills-only plugin that works alone
The directory `plugins/bdk-explain/` SHALL hold a plugin named `bdk-explain` whose runtime files are its manifest, `README.md`, `LICENSE` and `skills/explain/`. It SHALL ship no hooks, agents, MCP servers, CLI or `package.json`, and its skill SHALL NOT require another plugin, a `bdk` command, `/bdk:setup` or a `!` shell block. The plugin SHALL be listed in `.claude-plugin/marketplace.json` with a `git-subdir` source at `ref: release` and be a release component named `bdk-explain`.

#### Scenario: Strict validation
- **WHEN** `claude plugin validate plugins/bdk-explain --strict` runs
- **THEN** it passes

#### Scenario: Loaded without bdk
- **WHEN** a project that never ran `/bdk:setup` starts Claude Code with only `bdk-explain` loaded and a user asks how some code works and wants it explained as a page
- **THEN** the skill `bdk-explain:explain` runs and writes the page

### Requirement: The explanation is one self-contained interactive HTML page
`/bdk-explain:explain` SHALL answer with exactly one HTML file that holds its CSS and JavaScript inline and loads no external resource: no `<script src>`, no stylesheet `<link>`, no `@import`, no web font and no remote image. Diagrams SHALL be inline SVG. The page SHALL be legible in a light and a dark color scheme, following the system preference. The first screen SHALL hold the one-sentence answer and the key picture. Where the subject is a sequence of steps, a state change or a value that changes the result, the page SHALL let the reader step through it or change the value, by mouse and by keyboard. What the page states about the project's code SHALL come from the code the skill read, with the file paths it came from.

#### Scenario: Flow with several steps
- **WHEN** a user asks how a checkout flow that passes through four modules works
- **THEN** the page shows the flow as an inline SVG diagram in its first screen, with controls that step through the modules one at a time, and names the source file of each step

#### Scenario: No network
- **WHEN** the page is opened on a machine without network access
- **THEN** it renders completely, diagrams and controls included

#### Scenario: Dark theme
- **WHEN** the reader's system uses a dark color scheme
- **THEN** the page background, text and diagram strokes switch to dark-theme colors with legible contrast

### Requirement: The page never dirties git status
The page SHALL be written to `.bdk/tmp/explain/<short-name>.html` under the root of the current worktree (the current directory when it is not in a git repository). `<short-name>` SHALL be lowercase kebab-case, taken from the name the user gave or else from the topic. Before writing, the skill SHALL create `.bdk/tmp/.gitignore` holding `*` when that file is missing. The skill SHALL NOT edit the project's own `.gitignore` and SHALL NOT write any other file. A page with the same name SHALL replace the earlier one. The skill SHALL NOT delete pages.

#### Scenario: Clean git status
- **WHEN** the skill writes a page in a git repository whose `.gitignore` does not mention `.bdk/`
- **THEN** `git status --porcelain` prints the same as before the skill ran, and the project's `.gitignore` is unchanged

#### Scenario: Same topic again
- **WHEN** the user asks for the page named `checkout` a second time
- **THEN** `.bdk/tmp/explain/checkout.html` is replaced and no second checkout page is created

### Requirement: The page opens in the browser and the reply stays short
After writing the page, the skill SHALL open it in the default browser with `open` on macOS and `xdg-open` on Linux with a display. It SHALL NOT try to open it in a remote session (`SSH_CONNECTION` set), on Linux without `DISPLAY` or `WAYLAND_DISPLAY`, or on another platform. The reply SHALL be a summary of two or three lines and the page path. It SHALL NOT contain the HTML source. When the browser was not opened, or the open command failed, the reply SHALL give the path only, with no retry and no other viewer.

#### Scenario: Local macOS session
- **WHEN** the skill finishes on macOS in a local terminal
- **THEN** it runs `open .bdk/tmp/explain/<short-name>.html` and replies with a short summary and that path

#### Scenario: Remote session
- **WHEN** the skill finishes in an SSH session
- **THEN** it opens nothing and replies with the summary and the path to open

### Requirement: The explain skill ships only with eval evidence
The skill SHALL have at least two eval cases under `plugins/bdk-explain/evals/`, each run with `claude plugin eval` at least three times per arm, with `bdk-explain` and with no plugin. It SHALL ship only when the mean of its per-case `Δ` is at least `+0.10` and it fired in at least half of its with-arm runs. `plugins/bdk-explain/evals/RESULTS.md` SHALL record each case's `WITH`, `W/OUT` and `Δ`, the fired count, the models, the Claude Code version, the date and the verdict. The workspace tests SHALL fail when a skill of the plugin has no `admitted` row or fewer than two cases.

#### Scenario: Skill without evidence
- **WHEN** `plugins/bdk-explain/skills/explain/` exists and `RESULTS.md` holds no `admitted` row for `explain`
- **THEN** `pnpm test` fails and names `explain`
