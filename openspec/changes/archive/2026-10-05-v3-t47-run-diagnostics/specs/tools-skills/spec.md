## MODIFIED Requirements

### Requirement: Tools skill shape

The tools skills `/bdk:commit`, `/bdk:docs`, `/bdk:rules`, `/bdk:adr`, `/bdk:doctor`, `/bdk:diagnose` and `/bdk:bdk-cli` SHALL live at `skills/tools/<name>/SKILL.md`, a directory the `skills` array of `.claude-plugin/plugin.json` lists. Each SHALL:

- stay at or below 200 lines in `SKILL.md`;
- name BDK skills, roles and agents with the `/bdk:` and `bdk:` namespace, and name no skill of another plugin;
- name no model, in its frontmatter or its prose;
- pass `pnpm skill-check` with no baseline entry.

Every tools skill except `bdk-cli` SHALL start its body with the two context lines of `kernel-cli`, Output modes, naming its own skill, and SHALL list the kernel pair of `kernel-cli`, Invocation, in `allowed-tools`. A missing kernel then stops it with the visible `BDK STOP` line. `commit`, `docs`, `adr` and `bdk-cli` SHALL work without an active Change. `rules`, `doctor` and `diagnose` SHALL work without one as well, because the kernel commands they call are not Change-scoped.

`doctor` (T02 decision R-14) and `diagnose` (T47-D1) SHALL set `disable-model-invocation: true`. The other five SHALL NOT set it. `diagnose` SHALL set `context: fork` and `agent: bdk:reader` (HOST-FACTS `fork-plugin-agent`, `fork-bang`); no other tools skill sets `context`.

#### Scenario: every tools skill in place

- **WHEN** the content test lists `skills/tools/`
- **THEN** it finds `commit`, `docs`, `rules`, `adr`, `doctor`, `diagnose` and `bdk-cli` next to `cr` and `pr-review`, each with a `SKILL.md` of at most 200 lines

#### Scenario: context lines with the kernel pair

- **WHEN** the content test reads `commit`, `docs`, `rules`, `adr`, `doctor` and `diagnose`
- **THEN** each body starts with the two context lines naming its own skill, its `allowed-tools` starts with the kernel pair, and the `ctx skill` manifest has an entry for it

#### Scenario: invocation per skill

- **WHEN** the content test reads the frontmatter of the seven skills
- **THEN** only `doctor` and `diagnose` have `disable-model-invocation: true`, and only `diagnose` has `context: fork` with `agent: bdk:reader`

#### Scenario: no foreign plugin and no model

- **WHEN** the content test reads every file under the seven skill directories
- **THEN** none names `caveman`, a model name, or a skill namespace other than `bdk:`

## ADDED Requirements

### Requirement: diagnose analyzes one session

`/bdk:diagnose [<session-id>]` SHALL analyze one session from the deterministic report, the journal, the ledger and bounded transcript slices, and SHALL store the analysis only through `bdk diagnostics write`.

The skill runs `bdk diagnostics report --json` (with `--session` when given). It stops with the report's reason when `transcript` is `unavailable` and the journal holds no line of the session. For each finding and each refusal rule, it reads at most one `bdk diagnostics slice` around the finding's `cite` and the ledger entries the finding names (`bdk log show`). It never reads a whole transcript file. It sorts each problem by where the fix belongs: stage skill, role contract, dispatch package or template, kernel, plan, or project. It writes the five sections of `kernel-cli/diagnostics`, bdk diagnostics write, and every claim in them cites a journal line, a ledger id or a slice. A problem of the project is recorded with `bdk log add learning` when a Change is active. A problem of BDK stays in the analysis. When `.claude-plugin/plugin.json` of the working tree names the plugin `bdk`, `## Where the fix belongs` also gives, for each BDK problem, the file, the current sentence and a proposed sentence. On `policy/project-code`, the skill rewrites the named line of `## For a BDK issue` and writes again, at most twice. It ends by printing the path and the top three problems, and it tells the user to read `## For a BDK issue` before attaching it to an issue.

#### Scenario: steps named in the skill

- **WHEN** the content test reads `skills/tools/diagnose/SKILL.md`
- **THEN** it names `bdk diagnostics report --json`, `bdk diagnostics slice`, `bdk diagnostics write` and `bdk log add learning`, names the five sections, and contains no instruction to `Read` a file under `~/.claude`

#### Scenario: top refusal analyzed

- **WHEN** the `stages` probe of `execute` runs `/bdk:diagnose` after the stage
- **THEN** the analysis names the most frequent refusal rule of the report with a cause and a citation, and `bdk diagnostics write` accepted it
