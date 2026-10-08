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

The `triage-*` cases start from the shared fixture `monthly-report-judged.sh`: round 1 of `monthly-report` judged, one finding of each level, no decision. The block records decisions only through `bdk findings decide`, so it needs `bdk` and, for the manual cases, `Write` for the page and the Lavish CLI. `triage-lavish` and `triage-ask` put a `lavish-axi` stub into `node_modules` as the `design-draft` cases do; `triage-auto-policy` sets `policy.gates.review: auto` and grades that nothing is asked:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write "Bash(*/bin/bdk *)" "Bash(npx -y lavish-axi *)" --case 'triage-*'
```

The `propose-*` cases run `/bdk:propose`, which calls `bdk`, OpenSpec and `gh issue view`. A run has no GitHub credential, so `propose-from-issue` reads its issue through the offline stand-in `fixtures/bin/gh`: its scaffold copies the stand-in to `.git/bdk-eval/bin/gh` and the issue to `.git/bdk-eval/issues/42.json`. A run cannot execute a file outside its workspace, even with that directory on `PATH`, so put the relative directory first:

```bash
PATH=".git/bdk-eval/bin:$PATH" pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(gh *)" "Bash(git *)" --case 'propose-*'
```

A case that reads issues writes `.git/bdk-eval/issues/<n>.json` with the fields of `gh issue view --json` (`number`, `title`, `body`, `labels`, `state`, `url`) and copies the stand-in the same way.

The `e2e-check-*` cases run the product of the scaffolded project as a user would, through commands the skill cannot know in advance, so they need `Bash` itself; the sandbox still confines every command to the run's workspace. `--trust-plugin` lets the run start without a terminal:

```bash
pnpm --filter @bdk/bdk run eval --trust-plugin --allow-tools Write Bash --case 'e2e-check-*'
```

The `commit-*` cases run `git` and grade `.git/COMMIT_EDITMSG` and `.git/logs/HEAD`, which their scaffolds clear (on a Mac, see the `git` entry of "Host limits"); the `adr-*` cases need only `Write` and `Edit`:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(git *)" --case 'commit-*'
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit --case 'adr-*'
```

The `plan-draft-*` and `verify-plan-*` cases start from the shared fixture `ledger-change.sh` (a configured project with the Change `add-csv-export` ready to plan) and call `bdk plan check`; `verify-plan` runs in a `bdk:verifier` agent (opus):

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" --case '*plan-*'
```

The `spec-conformance-*` cases start from the shared fixture `tally-change.sh` (the Change `add-total` on its branch, with `main` as the base and a main spec to merge into); each scaffold adds one commit with what it tests. The block runs in a `bdk:verifier` agent (opus), reads `git diff` against `main` and writes `close/spec-conformance.md` (on a Mac, see the `git` entry of "Host limits"):

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write "Bash(*/bin/bdk *)" "Bash(git *)" --case 'spec-conformance-*'
```

The `implement-part-*` and `conform-part-*` cases start from the shared fixtures `ledger-planned.sh` (the Change `add-csv-export` with its two verified plan parts) and `ledger-implemented.sh` (part 01 built and left uncommitted, with the implementer's report, as the execute lead hands it to `conform-part`). The blocks run in a `bdk:implementer` or `bdk:conformer` agent (sonnet), edit the part's files, run the checks through `bdk check run`, read the diff with `git status` and `git diff`, and create the run directory with `mkdir -p` (on a Mac, see the `git` entry of "Host limits"):

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(mkdir -p *)" "Bash(git *)" --case '*-part-*'
```

The design-block cases (`explore-*`, `design-draft-*`, `verify-design-*`) start from the fixtures `ledger-proposal.sh`, `ledger-explored.sh` and `ledger-designed.sh`, and need the `bdk` launcher, OpenSpec, `git` and the Lavish CLI. `design-draft-lavish` and `design-draft-ask` put a `lavish-axi` stub into the workspace's `node_modules`, which `npx -y lavish-axi` runs before any installed one: the first opens every page and answers the poll, the second fails as a session without a browser does. `AskUserQuestion` is not available in a run, so `design-draft-ask` grades the questions in the reply.

```bash
for c in "explore-*" "design-draft-*" "verify-design-*"; do
  pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(npx -y lavish-axi *)" "Bash(git *)" --case "$c"
done
```

The `design-*` cases are the orchestrator cases of `/bdk:design` (`tags: [orchestrator]`, one arm). They start from the same ledger fixtures, run the design blocks inside one run (a `bdk:explorer` and an opus `bdk:verifier` agent), and need the grants of the design blocks:

```bash
pnpm --filter @bdk/bdk run eval --ablation none --tag orchestrator --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(npx -y lavish-axi *)" "Bash(git *)" --case 'design-*'
```

`--case 'design-*'` alone also matches the `design-draft-*` block cases; `--tag orchestrator` keeps only the orchestrator ones.

The `close-*` cases are the orchestrator cases of `/bdk:close` (one arm). They start from the shared fixture `tally-reviewed.sh`: the Change `add-total` after review, a bare repository `.git/bdk-eval/remote.git` inside the workspace as `origin`, so `git push` works offline, and the offline `gh` stand-in, which records `gh pr create` in `.git/bdk-eval/prs/<n>.json` and answers `gh pr view` from there. Put its directory first on `PATH` as for the `propose-*` cases; the run starts an opus `bdk:verifier` and runs `commit` (on a Mac, see the `git` entry of "Host limits"):

```bash
PATH=".git/bdk-eval/bin:$PATH" pnpm --filter @bdk/bdk run eval --ablation none --tag orchestrator --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(gh *)" "Bash(git *)" --case 'close-*'
```

A grader on the order of Bash calls is a `regex` on the trace, not `tool_order`: the free check loads cases with the grants `Write Edit`, under which a `tool_order` naming Bash cannot pass.

`--case` takes one glob; a repeated `--case` keeps only the last.

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

- **`git` on a Mac without Homebrew git.** `git` fails in every run: `/usr/bin/git` is an `xcrun` shim that cannot write its cache in the sandbox, and the sandbox hides `/Library/Developer` from `PATH` lookup, while that git runs by its full path. `macos-git-prefix.sh` defines `git` as that full path for each Bash call; copied as `bin/git` next to itself, it is also the `git` that git starts by name (a `git push` runs `pack-objects` and the remote's `receive-pack` that way). The sandbox cannot read files under your home directory, so copy it out and pass it as Claude Code's shell prefix:

  ```bash
  mkdir -p /Users/Shared/bdk-eval/bin && cp plugins/bdk/evals/macos-git-prefix.sh /Users/Shared/bdk-eval/
  cp plugins/bdk/evals/macos-git-prefix.sh /Users/Shared/bdk-eval/bin/git
  CLAUDE_CODE_SHELL_PREFIX=/Users/Shared/bdk-eval/macos-git-prefix.sh pnpm --filter @bdk/bdk run eval ...
  ```

- **`PATH` leaks from the caller.** A run inherits the `PATH` of the shell that starts it, including the `bin/` of plugins of a Claude Code session the command runs in. Start paid runs from a plain terminal.
- **No Artifact tool, no project configuration.** A run cannot publish artifacts and loads no `CLAUDE.md`, `.claude/` or `.mcp.json`; ship what a case needs in the plugin.
- **No local server.** Measured with Claude Code 2.1.292: a Bash-granting run cannot bind a local port (`listen EPERM: operation not permitted 0.0.0.0:5180`), so a case cannot start a web app or an HTTP API. `e2e-check` then reports `Verdict: BLOCKED`, as it should; its browser path is checked by hand (see "Manual browser check of `e2e-check`").
