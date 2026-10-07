# bdk evals

Eval cases of the `bdk` plugin for [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). A block stays in BDK only when its case shows that it changes the outcome (ADR-0003); a CLI helper, hook or workflow comes only for a problem a case or a measurement showed. Spec: `openspec/specs/skill-evals/spec.md`.

Every run is a real model call on your account. Nothing here runs in CI except the free check below.

## Run

From the repository root, after `pnpm install`:

```bash
# Every case, with and without the plugin, 3 runs per arm
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit

# Probe one case cheaply while writing it: one run, one arm
pnpm --filter @bdk/bdk run eval --allow-tools Write --case 'sample-*' --runs 1 --ablation none

# Blocks, and orchestrators (one arm)
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit --tag block
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit --tag orchestrator --ablation none
```

The `eval` script builds the plugin, then runs `claude plugin eval . --scaffold` with the Claude Code version pinned in the root `package.json`; every other argument goes to `claude plugin eval` (`--help` lists them). Useful ones: `--model` and `--judge-model` to pin models when comparing runs, `--max-cost-usd` as a ceiling, `-j 4` for parallel runs, `--no-publish` to keep the report local. Results land in `evals/results/<timestamp>/` (ignored by git) with `report.html`.

Read `WITH`, `W/OUT` and `Δ`: a block whose `Δ` stays near 0 over 3 runs does not change the outcome. `tool_used: Skill` graders are not scored; they show whether the skill fired.

### Grants

A run gets only the read-only tools a case lists in `allowed_tools`; `Write`, `Edit`, `Bash`, `WebFetch` and `WebSearch` also need `--allow-tools` on the command line, for every case of the run. Repeated `--allow-tools` add up. Grant `Bash` narrowly (`"Bash(git *)"`); each granted command runs in Claude Code's OS sandbox.

### Cases that need Bash

The `setup-*` cases run `/bdk:setup`, which calls the plugin's `bdk`, OpenSpec and `git`. Grant them, with the clean `HOME` of "Host limits" and a `PATH` without other plugins' `bin/`:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(npx *)" "Bash(git *)" --case 'setup-*'
```

Claude Code refuses every write to `.claude/settings.json` in a run, whatever the grants, so the cases grade the permission rules from the reply, where setup lists them for the user.

The review cases (`review-group-*`, `review-integration-*`, `judge-*`) run on the `monthly-report` fixture, a recorded review round of a two-part Change. The blocks read the code and write only through `bdk findings`, so they need `bdk` and read-only `git`, and no `Write` or `Edit`:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools "Bash(*/bin/bdk *)" "Bash(git *)" --case 'review-*'
pnpm --filter @bdk/bdk run eval --allow-tools "Bash(*/bin/bdk *)" "Bash(git *)" --case 'judge-*'
```

The `e2e-check-*` cases run the product of the scaffolded project as a user would, through commands the skill cannot know in advance, so they need `Bash` itself; the sandbox still confines every command to the run's workspace. `--trust-plugin` lets the run start without a terminal:

```bash
pnpm --filter @bdk/bdk run eval --trust-plugin --allow-tools Write Bash --case 'e2e-check-*'
```

### Manual browser check of `e2e-check`

No eval case covers the `browser` and `http` drivers: the run's sandbox refuses to bind a local port ("Host limits"). Check them by hand in a project built from `fixtures/click-counter.sh` outside this repository:

```bash
mkdir -p /tmp/click-counter && cd /tmp/click-counter && bash <repo>/plugins/bdk/evals/fixtures/click-counter.sh
claude -p "Use the app the way a user would and check that change add-counter does what its spec scenarios say." --plugin-dir <repo>/plugins/bdk --permission-mode auto
```

Expected: `.bdk/runs/add-counter/e2e/verdict.md` starts with `Verdict: FAIL`, `add-one.md` with `Result: fail` and a screenshot next to it, one `e2e-check` finding for "Add one", and nothing listening on port 5180 afterwards.

## Write a case

One directory per case, `evals/<block>-<case>/`, where `<block>` is the skill's name:

```text
evals/<block>-<case>/
  prompt.md        frontmatter: tags, allowed_tools, max_turns; body: what a user would type
  case.yaml        only for context.scaffold_script (and plugins: for the sample)
  scaffold.sh      builds the workspace, usually from a shared fixture
  graders/*.md     one grader per file
```

Write the prompt the way a user would ask, without naming the skill. Put `tags` in `prompt.md` as a flow list (`tags: [block]`); every case carries exactly one of `block`, `orchestrator`, `sample`.

- **Block case** (`tags: [block]`), run with and without the plugin: at least one grader on the result (`file_exists`, `regex` with `target: { source: file, path: ... }`, or a short `llm` rubric with concrete PASS and FAIL lines) and one on the steps (`tool_order` or `tool_used`), plus a `tool_used: Skill` grader that shows the block fired.
- **Orchestrator case** (`tags: [orchestrator]`), run with `--ablation none`: `tool_order` for the order of its blocks, `file_exists` for the files the run writes, `llm` for the outcome; time and turns come from the report.
- Grade long output with `regex`, not `llm`: the judge's verdict varies more the longer the text.
- `file_exists` sees only files created during the run, not files the scaffold made.

`sample-handover-note` is a complete example: a plugin inside the case directory (a case may name a plugin only in its own subdirectory), the shared fixture, and one grader of each kind.

## Shared fixtures

A workspace used by more than one case is a script in `evals/fixtures/<name>.sh` that builds it in the current directory: files and git state only, no network, under 120 s. A case runs it from its own `scaffold.sh`, then adds what only it needs:

```bash
#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tiny-ledger.sh"
```

`claude plugin eval` runs the scaffold in place from the case directory, so the relative path holds. The scaffold gets only `PATH`, an empty `HOME`, `TMPDIR` and `TERM=dumb`; pass `-c user.name=... -c user.email=...` to `git commit`. Configuration it writes (`.claude/`, `CLAUDE.md`) is not loaded by the run.

## Free check in CI

`plugins/bdk/tests/evals.test.ts` (part of `pnpm test`) loads every case with `claude plugin eval --max-cost-usd 0`, which checks the case files and the graders against the grants `Write Edit` but starts no run and needs no credential. It also runs every fixture and case scaffold as the harness does, and checks names and tags. Run it alone with `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`.

## Host limits

Measured with Claude Code 2.1.292:

- **`bin/` is not on `PATH` in eval runs.** A skill that runs `bdk ...` by name, or a `!` block calling it, fails in a run although it works in a normal session. `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"` in skill text is substituted and works in both.
- **Bash on a Mac with Docker Desktop.** Every Bash-granting run is refused while `~/.docker` holds symbolic links (Docker Desktop's `cli-plugins/` does). Run those cases with a clean `HOME` that keeps the login keychain:

  ```bash
  EVAL_HOME=$(mktemp -d) && mkdir -p "$EVAL_HOME/Library" && ln -s ~/Library/Keychains "$EVAL_HOME/Library/Keychains"
  HOME=$EVAL_HOME pnpm --filter @bdk/bdk run eval --allow-tools "Bash(git *)" Write --case '<case>'
  ```

- **`PATH` leaks from the caller.** A run inherits the `PATH` of the shell that starts it, including the `bin/` of plugins of a Claude Code session the command runs in. Start paid runs from a plain terminal.
- **No Artifact tool, no project configuration.** A run cannot publish artifacts and loads no `CLAUDE.md`, `.claude/` or `.mcp.json`; ship what a case needs in the plugin.
- **No local server.** Measured with Claude Code 2.1.292: a Bash-granting run cannot bind a local port (`listen EPERM: operation not permitted 0.0.0.0:5180`), so a case cannot start a web app or an HTTP API. `e2e-check` then reports `Verdict: BLOCKED`, as it should; its browser path is checked by hand (see "Manual browser check of `e2e-check`").
