# Design

## Context

The tool and the place are decided: `claude plugin eval` with and without the plugin (design `2026-10-07-v3-architecture.md`, "Evals and the development rule"; ADR-0003), cases under `plugins/<name>/evals/`, local only, never in CI because every run is paid (ADR-0002; `2026-10-07-v3-repo-structure-cicd.md`, "Docs and evals"). The release snapshot already drops `evals/` (`scripts/publish-plugin.ts`, `DEV_ONLY`).

Draft 1 (`draft/v3-1:evals/`) built its own harness on promptfoo: runners, providers, cost, series, statistics, a patched dependency, about 30 source files. `claude plugin eval` now does the runs, the arms, the graders, cost and the report itself, so none of that harness is carried over. What draft 1 measured still holds (thin skills, craft skills, rule no-ops; design "Existing Codebase Context").

`plugins/bdk` holds no skill yet (#178). The parallel tasks add CLI slices (#179, #186, #187, #188), the OpenSpec schema (#180) and a separate `bdk-craft` plugin with its own suite (#207). No block exists to evaluate.

Host facts measured for this Change with Claude Code 2.1.292 (the version pinned in `pnpm-lock.yaml`), each in a throwaway plugin:

| Fact | Observation |
| --- | --- |
| `scaffold_script` runs in place | `$0` is the script's path inside the case directory, cwd is the empty workspace; a script can run a sibling file through `$(dirname "$0")/../fixtures/...` |
| Plugin `bin/` in eval runs | Not on `PATH` of Bash, and `CLAUDE_PLUGIN_ROOT` is empty in Bash; a skill `!` block calling a `bin/` command fails and aborts the skill. In plain `claude -p --plugin-dir` the same `bin/` is on `PATH` (HOST-FACTS `plugin-bin-bash`) |
| `${CLAUDE_PLUGIN_ROOT}` in `SKILL.md` | Substituted in eval runs; `"${CLAUDE_PLUGIN_ROOT}/bin/<cli>"` runs inside the Bash sandbox |
| Bash sandbox on macOS | Every Bash-granting run is refused when `~/.docker` holds symbolic links (Docker Desktop's `cli-plugins/` does); `DOCKER_CONFIG` does not help; running with `HOME` pointed at a clean directory whose `Library/Keychains` links to the real one works and keeps the login |
| `PATH` of a run | Inherited from the shell that starts `claude plugin eval`, including the `bin/` of plugins of a Claude Code session the command runs in |
| A plugin inside a case | `plugins:` may name a plugin only in a subdirectory of the case directory, never the case directory or a parent |
| `--max-cost-usd 0` | Loads and checks every case (frontmatter keys, graders, `plugins:` paths, graders that cannot pass with the granted tools), starts no run, needs no credential, exits 2 in about one second; load errors are printed on stderr as `✗ <case dir>: ...` and `N case file(s) failed to load` |
| Repeated `--allow-tools` | Grants accumulate |

## Goals / Non-Goals

**Goals:**

- A block author adds a case directory and runs one command; nothing else needs building.
- Fixtures shared between blocks without copies.
- A sample case that shows the with/without difference today, before the first block.
- A broken fixture or case file fails free PR CI, not a paid run.

**Non-Goals:**

- No harness code, runner, statistics or result store of our own (draft 1's promptfoo harness).
- No paid run in CI (ADR-0002).
- No eval case of a real block or orchestrator; each block's issue writes its own.
- How skills call the `bdk` CLI. The measured `bin/` fact is recorded here and in the README for the first block that calls `bdk`.
- `bdk-craft` evals (#207) and the B1-sized speed fixture (#208).

## Decisions

### D1. Layout: flat case directories, shared fixtures beside them

```
plugins/bdk/evals/
  README.md                      how to run, write cases, share fixtures; host facts
  fixtures/<name>.sh             shared fixture builders, not cases
  <block>-<case>/                one case: prompt.md, optional case.yaml, graders/, scaffold.sh
  sample-handover-note/          the harness sample (D4), with plugin/ inside it
  results/                       written by runs; ignored by git
```

Case directories are named `<block>-<case>` as the design section "Evals and the development rule" fixes, flat under `evals/` so `--case '<block>-*'` selects a block. Orchestrator cases use the orchestrator's name as `<block>`.

Alternative: one directory per block with cases inside (`evals/<block>/<case>/`). Lost: the design already names the flat form, and `claude plugin eval` keys reports and `--case` on the case name, not the path, so nesting would add a level without a feature.

### D2. Shared fixtures: scripts under `evals/fixtures/`, run by each case's scaffold

A shared fixture is a Bash script `evals/fixtures/<name>.sh` that builds a workspace in its current directory: files and git state only, no network, deterministic, under the 120 s scaffold limit. A case uses it through a two-line `scaffold.sh` in its own directory:

```bash
#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tiny-ledger.sh"
```

and may add case-specific files after it. This resolves "Shared fixtures between blocks" of #189. The harness runs `scaffold_script` in place (Context, row 1), so the relative path holds; git commits pass `-c user.name -c user.email` because the scaffold's `HOME` is empty.

Alternatives: a copy of the fixture in each case - lost, copies drift and a fix must be made N times. A fixture as a directory tree that the scaffold copies (`cp -R`) - lost for now: binary-free text fixtures are shorter as a script that also makes the git history, and a script can still copy a tree when a fixture needs one. `context.add_dirs` - lost: it grants read-only access to a directory inside the case, it does not seed the workspace.

### D3. Graders and arms per kind of skill

Taken from the design section "Evals and the development rule", with the grader lessons of the docs ("Choose graders that give a stable signal"):

- **Block case:** runs with and without the plugin (the default for a path target). One grader on the result (`file_exists`, `regex` over the produced file with `target: { source: file, path: ... }`, or a short `llm` rubric with concrete PASS/FAIL lines) and one on the steps (`tool_order` or `tool_used`). A `tool_used: Skill` grader shows whether the block fired; the harness reports it as an unscored indicator. Tag `block`.
- **Orchestrator case:** tag `orchestrator`, run with `--tag orchestrator --ablation none`; `tool_order` for the order of blocks, `file_exists` for the run artifacts, `llm` for the outcome; time and turns from the report.
- Long outputs are graded by `regex`, not by `llm` (judge variance grows with length).

Alternative: a custom grader script. Not available: the harness has no custom-code graders.

### D4. Sample case with its own plugin inside the case directory

`sample-handover-note` measures a tiny skill, `handover-note`, from a plugin `bdk-eval-sample` at `sample-handover-note/plugin/` (case field `plugins: ["plugin"]`). The skill holds a house convention the baseline cannot guess (`docs/handover.md` with a fixed outline), so the with-arm passes and the without-arm fails the result graders. It uses every grader kind of D3 and the shared fixture `tiny-ledger`. It is tagged `sample`, and it needs only `Write` beyond the read-only tools, so it runs without the Bash sandbox (Context, row 4).

Measured on 2026-10-07 with `pnpm --filter @bdk/bdk run eval --allow-tools Write --case 'sample-*' --model haiku` (3 runs per arm): with 1.00, without 0.50, Δ +0.50, $0.20, 113 s. No baseline run wrote `docs/handover.md`; both arms read `package.json` before writing and gave a short reply, so `read-before-write` and `reply` pass in both and only the convention the skill carries makes the difference.

Alternatives: a sample skill in `plugins/bdk/skills/` - lost: it would ship to users and is not a BDK block. A sample case against the real `bdk` plugin calling `bdk --version` - lost: the plugin has no skill, and the `bin/` command is not on `PATH` in eval runs (Context, row 2), so both arms fail and Δ is 0. Waiting for the first block - lost: the acceptance signal of #189 needs a difference now, and the sample doubles as the harness self-check when a run looks wrong.

The sample stays while it is the only proof that the harness reports a difference; once real block cases exist it can go, by the Change of a block that replaces it.

### D5. One local command

`plugins/bdk/package.json` gains `"eval": "node build.ts && claude plugin eval . --scaffold"`. It builds first so hooks and `bin/` see a current `dist/`, uses the `claude` binary pinned in the root `devDependencies`, and runs scaffolds, which are written in this repository. Everything else is passed through: `pnpm --filter @bdk/bdk run eval --allow-tools Write --case 'sample-*'`. Grants stay per call because they decide cost and sandbox needs (repeated `--allow-tools` accumulate, Context).

Alternatives: a wrapper script that picks grants, models and thresholds - lost: the CLAUDE.md rule against building machinery for infrequent operational work; the flags of `claude plugin eval` already cover it. A root-level `pnpm eval` - lost: each plugin owns its suite (ADR-0002), and `bdk-craft` has its own.

### D6. Free CI check: real loader at zero cost, fixtures run as the harness runs them

`plugins/bdk/tests/evals.test.ts`, inside the existing `pnpm test` of the `check` job:

1. **Loader check.** Runs the pinned `claude plugin eval plugins/bdk --trust-plugin --max-cost-usd 0 --allow-tools Write Edit --no-publish` with a temporary `HOME`, `--output-dir` and `--report`, and fails on any `✗` load error or "cannot pass" warning on stderr. It needs no credential and starts no run (Context, last rows). To prove the check is not a silent no-op after a Claude Code upgrade changes the wording, it also runs on a temporary copy of the suite with one broken case added and expects the error.
2. **Fixture check.** Runs every `evals/fixtures/*.sh` and every case's `scaffold_script` in an empty temporary directory with the scaffold's environment (`PATH`, a temporary `HOME` and `TMPDIR`, `TERM=dumb`) and a 120 s limit, and expects exit 0.
3. **Layout check.** Every case directory name matches `<block>-<case>` in kebab-case, and `evals/results/` is ignored by git.

Alternatives: a hand-written YAML/frontmatter validator - lost: it would re-implement the harness's own loader and drift from it; the zero-cost run uses the real one. No CI check at all - lost: a broken scaffold scores every run 0 and is found only after paying for the runs. A separate CI job - lost: the test is about one second plus the scaffolds and fits `pnpm test`.

### D7. Shared spots and coordination

`.gitignore` gains `plugins/*/evals/results/` (the same line #207 adds; whichever merges second keeps one). `CONTRIBUTING.md` gets one pointer to `plugins/bdk/evals/README.md`. The parallel agents were told of these touches and of the measured `bin/` fact; no reply was needed.

The spec is a new capability `skill-evals` rather than an addition to `bdk-plugin`, because it describes how skills are measured, not the package; `bdk-craft` (#207) keeps its own `craft-skills` spec.

## Risks / Trade-offs

- [The loader check reads stderr wording of Claude Code] -> pinned version; the planted broken case fails the test when the wording changes, so an upgrade never turns the check into a silent pass.
- [The sample measures a toy skill, not BDK] -> it proves the harness only; real blocks bring their own cases.
- [`bin/` not on `PATH` in eval runs] -> a block that calls `bdk` by name fails in evals although it works for users. Recorded for the first block that calls `bdk`; `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"` in skill text works in both (measured).
- [Bash-granting runs refused on a Mac with Docker Desktop] -> README gives the clean-`HOME` workaround; the sample needs no Bash.
- [Every run is paid] -> README: probe with `--runs 1 --ablation none`, cap with `--max-cost-usd`, cheap judge default.
