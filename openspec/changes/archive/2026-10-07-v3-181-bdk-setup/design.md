## Context

`/bdk:setup` is the one BDK skill that runs without a configuration (design section "Constraints & NFRs", "Without configuration"). It is listed with the main-thread orchestrators in the design's "Catalog": stack detection incl. `tools.e2e`, `.bdk/settings.yaml`, permission allow rules, OpenSpec init with the BDK schema. What it builds on:

- `bdk config show|check|set` (#179, spec `bdk-cli/config`): three layers, a strict schema, "configured" = `.bdk/settings.yaml` exists and the root holds `openspec/`. The settings keys have no `tier` and no scoped forms other than `scoped` (unlike v2 and draft 1).
- The BDK OpenSpec schema in `plugins/bdk/openspec/schemas/bdk/` (#180), installed by copying; #180 D7 leaves pinning the OpenSpec version in user projects to setup.
- The eval suite (#189, spec `skill-evals`): cases under `plugins/bdk/evals/<block>-<case>/`; in eval runs the plugin's `bin/` is not on `PATH`, so skills call `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`.
- Inputs read, not copied: v2 `skills/setup` on `main` (ask-everything flow, JSON settings, `tier`, `related`/`failed`/`incremental` forms, caveman toggle) and `draft/v3-1:skills/stages/setup` (kernel `bdk ctx`/`bdk doctor`, Lavish setup page, risks, tracker, evidence globs, `bdk config set` per key). Both carried keys v3 dropped and machinery the findings name as draft 1's cost.

Probes run for this Change on Claude Code 2.1.293, `claude -p --plugin-dir <probe> --permission-mode default`, model haiku, a plugin skill whose `!` block runs `"${CLAUDE_PLUGIN_ROOT}/bin/ptool"`:

| `allowed-tools` | Result |
|---|---|
| `Bash(${CLAUDE_PLUGIN_ROOT}/bin/ptool *)` | block ran, output in context |
| `Bash(*/bin/ptool *)` | block ran, output in context |
| `Bash(nothing *)` (control) | empty result: the skill aborted |

So the variable is substituted in frontmatter too, and a leading `*` wildcard matches the absolute path.

`openspec init --tools none .` (1.13.2) is non-interactive and writes only `openspec/config.yaml` (`schema: spec-driven` plus comments), `openspec/specs/.gitkeep` and `openspec/changes/archive/.gitkeep`.

## Goals / Non-Goals

**Goals:**

- One command leaves a project that `bdk config check` accepts and `bdk config show` reports configured, so every other BDK skill runs (issue, "Acceptance signal").
- Detection of `tools.e2e` for web, API and CLI products, written down (issue, "To resolve in the spec").
- A fast run: read a handful of files, write a few, ask at most once.

**Non-Goals:**

- No `bdk` command for detection or for writing settings (CLAUDE.md "Building skills (v3)"; `.claude/rules/bdk-cli.md`): detection is model work over project files, and the writes are small files. The one command this Change adds, `bdk openspec install`, answers a measured problem (D7).
- No Lavish setup page, risks, tracker, evidence globs or caveman toggle (draft 1, v2): no settings key holds them in v3.
- No commit: setup leaves its files for the user to review and commit.
- No `steps`, `models`, `policy`, `plan`, `execution` or `hooks` keys: their defaults hold until a team changes them; setup writes only what it detects.

## Decisions

### D1. One plain skill, model-invocable, with two references

`plugins/bdk/skills/setup/SKILL.md` holds the process; `references/stacks.md` (commands and scoped forms per stack) and `references/e2e.md` (D4) are read only when detection needs them. The skill is model-invocable (no `disable-model-invocation`): the stop line every other skill prints tells the model to run `/bdk:setup`, and an eval prompt written as a user would ask ("set up BDK here") must be able to fire it.

Alternatives: `disable-model-invocation: true` as in v2 and draft 1 - lost, the model could not act on "run /bdk:setup" and the eval could not fire the skill without naming it. One long `SKILL.md` - lost, the stack table is needed only on a first run, and a thin skill performs no worse (design "Existing Codebase Context", measurements).

### D2. `bdk` is called as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`

The skill starts with a `!` block running `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`, which exits 0 in every state (`bdk-cli/config` "config show"), so the model sees from its first turn whether the project is configured, invalid or new. `allowed-tools` lists `Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *)`, which the probe shows the host substitutes and matches. Every `bdk` call in the skill text uses the same form.

Alternatives: bare `bdk` - lost, not on `PATH` in eval runs (#189). `Bash(*/bin/bdk *)` in `allowed-tools` - works too, but matches any `bin/bdk`; the substituted form names exactly the plugin's launcher.

### D3. Settings are written as one file, then checked

On a first run the skill writes `.bdk/settings.yaml` with the Write tool, with a header comment pointing at `bdk config show`, then runs `bdk config check` and fixes every problem it reports. On a re-run it edits only the keys that change with the Edit tool, which keeps the team's comments and order. Only detected keys are written; a key left on its default stays out of the file, so a later change of the default still reaches the project.

Alternatives: `bdk config set` per key (draft 1) - lost, one Bash call and one turn per key (a typical project has 5-8 keys and items) for a validation that one `bdk config check` gives as well; it would also need `set` to write whole items, which it does but with quoting a model gets wrong in shell. A new `bdk config init` - lost, no measured problem.

### D4. How `tools.e2e` is detected

`tools.e2e` tells `e2e-check` how to start the product and when it is ready (`bdk-cli/config` keys table: `start`, `ready`, `driver`, optional `env`). The skill classifies the project by what a user runs, one entry per runnable product, with the `id` naming the kind:

| Kind (`id`, `driver`) | Signals | `start` | `ready` |
|---|---|---|---|
| web app (`web`, `browser`) | a UI framework or bundler dependency (`vite`, `next`, `react-scripts`, `@angular/core`, `nuxt`, `@sveltejs/kit`, `astro`) or an `index.html` served by a dev script; a Playwright or Cypress config | Playwright `webServer.command` when present; else the `dev` script, then `start`, through the package manager | Playwright `webServer.url` when present; else `http://localhost:<port>`, the port from the script's `--port`, the framework config, then the framework default |
| HTTP API (`api`, `http`) | a server framework (`express`, `fastify`, `koa`, `hono`, `@nestjs/core`; `fastapi`, `flask`, `django`; Go `net/http` or a router in a `main` package; Spring Boot; Rails) and no UI | the `start` or `dev` script, or the framework's run command (`uvicorn <module>:app --port <port>`, `go run .`) | `http://localhost:<port><health path>`: the health route when the code has one (`/health`, `/healthz`, `/status`), else `/`; the port from code or configuration, else the framework default |
| CLI (`cli`, `cli`) | `package.json` `bin`; `[project.scripts]` in `pyproject.toml`; a Go `main` package under `cmd/` or at the root without a server; `[[bin]]` or `src/main.rs` in `Cargo.toml` | the build command that makes the binary runnable; for an interpreted CLI with no build, the same command as `ready` | the CLI's help invocation, which exits 0 once it runs (`node bin/<name>.js --help`, `cargo run -- --help`) |

- A web UI with its own API in one process is one `web` entry; separate packages in a workspace get one entry each, the `id` suffixed with the package name (`web-admin`, `api-billing`).
- `env` is written only when the start command needs a variable the project documents (`.env.example`, README) and has a safe local value; secrets are never written.
- A project with no runnable product (a library) gets no entry, and the closing report says that E2E is skipped and why (design "Constraints & NFRs", "E2E").
- When two candidates compete for `start` or the port is a guess, the skill asks (D5).

Alternatives: detect only Playwright and Cypress configs - lost, an API or CLI has none, and the e2e-tester drives the product itself, so the entry is how to run the product, not a test suite (a Playwright suite is a `tools.test` item). Ask the user for every entry - lost, the files answer most cases; asking is reserved for ambiguity.

### D5. Ask once, only what the files cannot answer

Detection runs first and writes nothing. Then, only when something is open, one `AskUserQuestion` call (at most 4 questions) covers: competing commands for a group, a group with no command found ("the project has none" or a command), an `tools.e2e` start or port the files do not settle, a foreign OpenSpec schema in `openspec/config.yaml`, deleting v2 files. Each question puts the recommended answer first. When nothing is open, setup writes without asking and the closing report lists every value with the file it came from, so a wrong detection is visible and fixed with `bdk config set` or an edit. When `AskUserQuestion` is not available (non-interactive runs, evals), the skill takes the recommended answers and says so in the report.

Alternatives: confirm every detected command (v2) - lost, a question per run the files already answer, and design "Speed" puts waiting for the user on the run's clock. A Lavish page (draft 1) - lost, Lavish is not a BDK dependency (design "What We Did NOT Decide"), and one question round fits in `AskUserQuestion`.

### D6. Permission allow rules in the project's `.claude/settings.json`

Setup adds to `permissions.allow` of `.claude/settings.json` (committed, so the team and CI runs share it), keeping every existing entry and adding only missing ones:

- `Bash(bdk *)` (design "Permissions of the autopilot") and `Bash(*/bin/bdk *)`: skills call the launcher by its plugin path (D2), which the bare rule does not match, and the plugin path changes with every plugin version, so the rule names the launcher by a wildcard.
- `Bash(openspec *)`: OpenSpec is required in a BDK project (ADR-0003 D2-2) and the stage skills run `openspec new change`, `status` and `archive`.
- `Bash(git *)` and `Bash(gh *)` for the main thread; workers are kept from git history by `hooks.subagent-git` (#182), not by permissions.
- Each `tools.*` command exactly (`Bash(pnpm test)`), `tools.e2e` `start` and command `ready` included, and each `scoped` form as its prefix before `{files}` with ` *` (`Bash(pnpm vitest run *)`). A URL `ready` needs no rule.

Claude Code asks the user to approve every write to `.claude/settings.json`, even with Write allowed (measured in the acceptance runs: the write is refused in `claude -p`). That is right: the user approves the rules setup adds. When the write is refused, the report lists the rules to add.

Alternatives: `.claude/settings.local.json` - lost, personal and not committed, so a teammate or an autopilot run on another machine would miss the rules. `Bash(*)` - lost, it allows everything. Writing to `~/.claude/settings.json` - lost, setup configures a project, not a machine.

### D7. OpenSpec at the pinned version, BDK schema as the default

1. When `openspec/` is missing: `openspec init --tools none .` with the pinned CLI: `openspec` when `openspec --version` prints `1.13.2`, else `npx -y @fission-ai/openspec@1.13.2`. `--tools none` because BDK's stage skills replace OpenSpec's slash commands. When neither runs (no network, no npm), the skill writes the same three paths itself (`openspec/config.yaml`, `openspec/specs/.gitkeep`, `openspec/changes/archive/.gitkeep`) and the report asks the user to install OpenSpec 1.13.2 (`npm i -g @fission-ai/openspec@1.13.2`).
2. Install the schema with `bdk openspec install`, which copies every file of the plugin's `openspec/schemas/bdk/` into the project's, reporting each as added, updated or unchanged. A re-run copies it again, so a plugin update reaches the project's committed copy.
3. Set `schema: bdk` in `openspec/config.yaml`, keeping the rest of the file. A config naming a schema other than `spec-driven` or `bdk` is a question (D5). Changes in flight keep their own schema in their `.openspec.yaml`.
4. When the CLI ran: `openspec schema which bdk` must report the project source.

Why a command for the copy: #180 D2 rejected `bdk openspec install` because "a copy is one shell line". The first acceptance run of this Change measured otherwise: Claude Code refused `cp -R <plugin>/openspec/schemas/bdk openspec/schemas/` in default mode, and a probe with exactly that command in `--allowedTools` (and with a trailing ` *`) gave "`cp` with flags needs manual approval" both times, so no allow rule makes the copy run unattended. Copying 10 KB (5 files) through Read and Write costs about 10 tool calls and lets a model drift from the shipped text. The command is a slice of its own (`src/openspec/`, spec `bdk-cli/openspec`): it reads the plugin root from the bundle's location (`<plugin>/dist/bdk.mjs`), writes under the working directory through `shared/fs`, and changes nothing else in `openspec/`.

Alternatives: hand-write OpenSpec's files always - lost, `openspec init` is the owner of its layout and a future version may add to it; the hand-written path is only the fallback. `--tools claude` - lost, it installs `/opsx:*` commands that compete with BDK's stages. Install the schema into the user data directory - lost in #180 D2.

### D8. Git ignore rules and v2 projects

- `.gitignore` gets `/.bdk/runs/` and `/.bdk/settings.local.yaml` when they are missing: run artifacts and the local layer stay out of git (design "Run state, run artifacts and resume", "Constraints & NFRs" repository row).
- When `git check-ignore -q .bdk/settings.yaml` says the project file is ignored (v2 wrote `/.bdk/` into `.gitignore`), the skill replaces that rule with the two paths above, since the team must see the committed settings.
- A v2 `.bdk/settings.json` is read as detection hints (`languages`; `test-tools`, `lint-tools`, `build-tools` items with `type` as `id`, `command`, `scoped`). Setup never reads it again afterwards; deleting the v2 paths (`.bdk/settings.json`, `.bdk/plans/`, `.bdk/design/`, `.bdk/verify-plan/`, and a v2 `.bdk/runs/`) is a question (D5), deleted only after a yes.

Alternatives: leave v2 files untouched without asking - lost, a v2 `.bdk/runs/` holds a layout v3 would misread. A migration command in the CLI - lost, a one-off done once per project is skill text.

### D9. Eval cases

Four cases, tagged `block` (setup composes no other block; run with and without the plugin, the difference shows the skill changes the outcome), each a scaffolded project with git history and no network need:

| Case | Project | Checks on files |
|---|---|---|
| `setup-web-app` | Vite + React + Vitest + ESLint + Playwright (pnpm) | `tools.e2e` `web`/`browser` with the `webServer` URL; `tools.test` with a `scoped` form |
| `setup-http-api` | Express API with `node --test` (npm), `/health` route, port 4000 | `tools.e2e` `api`/`http` with `http://localhost:4000/health` |
| `setup-node-cli` | Node CLI with `bin` (npm) | `tools.e2e` `cli`/`cli` with a `--help` ready command |
| `setup-library` | the shared `tiny-ledger` fixture | no `tools.e2e`; the reply says E2E is skipped |

Graders: `file_exists` on `.bdk/settings.yaml` and `openspec/schemas/bdk/schema.yaml`; `regex` on `.bdk/settings.yaml` and `openspec/config.yaml` (`schema: bdk`); an `llm` grader on the permission rules in the reply, because Claude Code refuses every write to `.claude/settings.json` in a non-interactive run, whatever the grants (measured: `--allowedTools "Write(.claude/settings.json)"` still refused it); `tool_order` Read of the manifest before the Write of the settings; `tool_used` Skill; an `llm` grader on the reply where the outcome is prose (library). Graders use only `Read`, `Write`, `Edit` and `Skill` steps, so the free CI check (grants `Write Edit`) can load them; a paid run additionally grants Bash for `bdk`, `openspec`/`npx`, `cp`, `mkdir` and `git` (README section of the change).

Measured on Claude Code 2.1.292, one run per arm (`--runs 1`, grants as in the eval README): every case scored 1.00 with the plugin and 0.00 without (mean Δ +1.00, 91 s wall clock with `-j 4`, $1.78 for 8 runs). The acceptance runs (`claude -p "/bdk:setup" --plugin-dir`, task 4.1) took 22-26 turns and 39-49 s per project; a targeted re-run (`/bdk:setup add the lint command`) took 10 turns and changed only `tools.lint`, keeping a team comment.

Alternatives: tag `orchestrator` and run one arm - lost, the with/without difference is the admission evidence for a new skill (ADR-0003). One case per stack language - lost, the open question is the product kind (web, API, CLI, none), not the language.

## Risks / Trade-offs

- [Detection misreads a command or port] -> the report lists every value with its source file; `bdk config check` catches shape errors; the eval cases cover the four product kinds.
- [`Bash(git *)` lets workers rewrite history in an autopilot run] -> `hooks.subagent-git` (#182) guards workers; the allow rule is what the design names for the main thread.
- [`Bash(*/bin/bdk *)` matches any `bin/bdk`] -> the command still runs only when a model calls it; the alternative, a versioned plugin path, goes stale on every update.
- [No network for `npx`] -> hand-written OpenSpec layout plus a report line (D7).
- [Eval runs need Bash grants and the Docker Desktop `HOME` workaround] -> documented in `evals/README.md`, recorded per case in `prompt.md`.
- [OpenSpec project schemas are experimental] -> the version is pinned here, as #180 D7 required.

## Open Questions

None. Decisions worth the reviewer's attention: D4 (`tools.e2e` detection), D6 (the two rules beyond the issue's list: `Bash(*/bin/bdk *)`, `Bash(openspec *)`).
