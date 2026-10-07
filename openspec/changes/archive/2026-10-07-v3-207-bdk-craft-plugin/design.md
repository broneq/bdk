# Design

## Context

- When this Change started, `staging/v3` held no plugin; `bdk`, `git-identity` and `bdk-skill-kit` landed while it ran (#175, #178). ADR-0002 and `docs/design/2026-10-07-v3-repo-structure-cicd.md` ("Layout") place `bdk-craft` at `plugins/bdk-craft/` as "skills only, no package.json"; evals live in `plugins/<name>/evals/`, run locally with `claude plugin eval`, never in CI ("Docs and evals").
- The v3 architecture ("Evals and the development rule") fixes the eval tool: `claude plugin eval` cases with and without the plugin; a block stays when it changes the outcome. ADR-0003: a new skill starts as a plain skill with an eval.
- Input material: the nine draft skills and task files on `draft/v3-1` (`plugins/bdk-craft`, `evals/suites/with-without/examples/craft/`), and the draft record `docs/v3-draft1/evals/V3-EVAL-CRAFT.md`: eight admitted, `data-modeling` rejected, one run per cell, reply-only regex assertions, a harness that no longer exists.
- Claude Code 2.1.292 (pinned in `pnpm-lock.yaml`) has `claude plugin eval` with `regex`, `tool_used`, `tool_order`, `file_exists`, `llm` graders, a no-plugin baseline arm, `scaffold_script`, OS-sandboxed `Bash`, and `tool_used: Skill` graders reported as an unscored "plugin fired" indicator in two-arm runs.
- Parallel work: #175 moved `git-identity` and `bdk-skill-kit` in with `git-subdir` marketplace entries at `ref: release`; #178 created `plugins/bdk`. Both touch the same three release and marketplace files (D12).

## Goals / Non-Goals

**Goals:**

- A `bdk-craft` plugin that installs and works alone.
- Each candidate rewritten with `/skill-creator`, eval cases first, measured with and without, shipped only on evidence.
- Evidence that a contributor can re-run with one command, and a test that keeps `skills/` and the record in step.

**Non-Goals:**

- Using craft skills from `bdk` orchestrators or agents (the draft's `ctx craft` and dispatch mapping): `bdk` does not exist yet, and the v3 architecture drops the kernel that did this.
- Running evals in CI (paid; ADR-0002 constraints).
- A docs-site page for the plugin; the plugin `README.md` is the user documentation for now.
- A second attempt at `data-modeling` (D1).

## Decisions

### D1. Candidates: the eight skills the draft admitted

`tdd`, `debugging`, `refactoring`, `testing-strategy`, `api-design`, `oop-design`, `modularizing`, `mermaid-drawer`. Each is a process with checkable steps or a set of named choices, which is the shape the draft found to change outcomes.

- _All nine, `data-modeling` included:_ the draft measured it at 11/13 with and 12/13 without; the model already applies its content. Without a new hypothesis for what the skill would change, a rewrite would pay to confirm a known result. Lost.
- _Only the strongest three (`api-design`, `testing-strategy`, `debugging`):_ the issue asks which skills ship to be decided by evidence, not by a guess before measuring. Lost.

### D2. Eval tool: `claude plugin eval`, cases in `plugins/bdk-craft/evals/<skill>-<case>/`

Follows the v3 architecture ("Evals and the development rule") and the host facts (`claude plugin eval` runs a no-plugin baseline arm). The with-arm loads only `bdk-craft`, so every passing with-arm run is also evidence that the plugin works alone.

- _Restore the draft harness:_ it lived in the removed kernel; rebuilding it repeats the draft root cause "the kernel duplicates the host" (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`, section 5). Lost.
- _`/skill-creator`'s own `evals/evals.json`:_ a different format that `claude plugin eval` does not read, and it gives no no-plugin baseline per plugin. `/skill-creator` is still the authoring tool; its eval loop is not the admission evidence. Lost.

### D3. Admission rule: mean `Δ` at least `+0.10` and the skill fired in at least half of its with-arm runs

Each skill has three cases, each run three times per arm (the tool's default). `Δ` per case is the tool's with-arm score minus without-arm score; the skill's `Δ` is the mean over its cases. The fired rate comes from each case's `tool_used: Skill` indicator grader.

- The margin `+0.10` is above what one or two flipped graders in one run can produce: a case has 3 to 5 scored graders, so one flip in one of nine runs moves a skill's mean `Δ` by at most about `0.04`.
- The fired condition ties the effect to the skill. Without it, a positive `Δ` on a `tdd` case could come from another craft skill, or from noise, while the `tdd` skill itself never triggers on natural phrasing.
- _Draft D7, summed assertions with greater than without, one run per cell:_ a single flip decides a verdict (the draft's `oop-design` passed by one assertion). Lost.
- _Five runs per arm with a range rule:_ about 1.7 times the cost of three runs for a verdict the margin already protects; kept as the re-run for a disputed verdict. Lost.
- _An absolute score threshold:_ says how good the with-arm is, not what the plugin adds. Lost.

### D4. Case design: behaviour graders, not wording graders

Every case is a request a user would type, never naming the skill, plus graders that check what the skill is meant to change. Graders never check the skill's own phrases (such as "TDD log" or "Debug report").

- **Process skills** (`tdd`, `debugging`, `refactoring`) run in a scaffolded workspace with `Bash`, `Write` and `Edit` granted. Graders read the transcript: `tool_order` (test written before the implementation; reproduction run before the fix; tests written before the first edit), `tool_used` with a minimum count of test runs (one cycle per behaviour or per step), plus an `llm` or `regex` grader on the produced code or the reply for the outcome (the real cause named, the odd behaviour kept, the second instance of the bug found).
- **Choice skills** (`testing-strategy`, `api-design`, `oop-design`, `modularizing`, `mermaid-drawer`) answer in the reply. Graders are `regex` over the reply for concrete choices (a Test Data Builder call chain, `application/problem+json`, `If-Match` with `412`, a public entry file, an import-boundary rule, `classDef` lines carrying `fill`, `stroke` and `color`), plus at most one short `llm` rubric where a regex cannot judge.
- Every case has one `tool_used: Skill` grader for its own skill; the tool reports it unscored in both arms.

- _Reply-only graders for every skill, as in the draft:_ a process skill is about the order of work, and the reply is the agent's own account of it. The transcript shows the order. Lost.

### D5. Fixtures: plain ESM JavaScript and `node --test`, written by the case's scaffold script

A run's `Bash` is OS-sandboxed without network, so `npm install` is not possible. Node's built-in test runner needs no install. The scaffold script writes `package.json` (`"type": "module"`, `"test": "node --test"`) and the source files with heredocs, so no fixture `.js` file sits in the repository for eslint, prettier or a reader to mistake for product code.

- _TypeScript fixtures with vitest:_ need a dependency install inside the run. Lost.
- _Fixture files committed next to the case and copied by the script:_ they would enter the workspace lint and format checks. Lost.

### D6. Models: agent `claude-opus-5-5`, judge `claude-sonnet-5-5`, pinned on the command line

The agent model is the one BDK users run and the one the draft measured with, so verdicts compare. The judge is Sonnet, not the default Haiku, because the plugin-eval docs warn that a small judge marks a correct answer wrong when its format differs from the rubric. Both are written into `RESULTS.md`.

### D7. Record: `plugins/bdk-craft/evals/RESULTS.md`, checked by `tests/craft-skills.test.ts`

`RESULTS.md` holds the command, models, versions, date, cost, a per-skill table with the verdict, and a per-case table. `evals/results/` (the tool's raw output) is ignored by git. The test parses the per-skill table and fails on a skill directory without an `admitted` row, an `admitted` row without a directory, a `rejected` row whose directory still exists, or a shipped skill with fewer than two cases. It also checks the plugin's shape (D8) and the marketplace entry.

- _Commit the raw `aggregate-result.json`:_ several megabytes of transcripts per run, with the full prompts of every case already in the repository. Lost.
- _A record under `docs/`:_ the evidence belongs next to the cases it measures, and the release snapshot already drops `evals/`. Lost.

### D8. Plugin shape and wiring

- `plugin.json` has `name`, `description`, `version` `0.1.0`, `author`, `repository`, `license`, in the `JSON.stringify(_, null, 2)` layout that `tests/release-components.test.ts` requires. Skills sit in the default `skills/` directory, so no `skills` field is needed.
- `release-please-config.json` gets `"plugins/bdk-craft": {"component": "bdk-craft", "bump-minor-pre-major": true}` (a breaking change before `1.0.0` bumps the minor, as for `git-identity`) and `.release-please-manifest.json` gets `"plugins/bdk-craft": "0.1.0"`, as CLAUDE.md requires for a new plugin directory.
- The marketplace entry is `git-subdir` on `broneq/bdk`, `path: plugins/bdk-craft`, `ref: release` (ADR-0002, the same shape #175 gives its entries). Until the first release writes `plugins/bdk-craft` to the `release` branch, installing the entry fails; that holds for every plugin of this line and is resolved by the first release from `main`.
- Skill frontmatter uses only `name`, `description` and `license`, so the skills stay portable Agent Skills. Each skill stays under 500 lines with any long reference in `references/` (the draft `mermaid-drawer` recipes).

### D9. Skills are written with `/skill-creator`, cases first

For each candidate: write its three cases (D4) and check them with a dry run of one case with `--ablation none --runs 1`; then write the skill with `/skill-creator`, using the draft skill as reading material, not as text to copy; then measure. A skill whose cases fail to load or whose scaffold fails is fixed before the measured run, so a verdict never rests on a broken case.

### D10. Graders are tried before the measured run

Each case ran once with Sonnet before the measured run: first without any skill (does the case load, does the scaffold work, what does a plain agent do), then with the skills (does each skill fire on the case's phrasing). Those trials found grader defects, fixed before measuring:

- Agents often write files with a Bash heredoc (`cat > src/invoice.js`), so a `tool_order` on `Write` missed real edits. The order graders are regexes over the trace that count a `Write`, an `Edit` or a Bash redirect into the file, and they look for the failing run before the first such change.
- An `llm` rubric that named a technique ("maps ł to l") failed a correct implementation that used Unicode normalisation; rubrics describe behaviour.
- Absence graders matched prose ("no `setStatus()`"); they now match a definition or a call only.
- Two graders judged taste rather than outcome (a verb-free cancel path, "one level per behaviour" judged by Haiku-sized reasoning) and were replaced or dropped.
- The skill descriptions did not trigger on a plain question ("How should we test it?") in a separate project; they now say "Load it before ..." and fire on every case's phrasing.

### D11. Local eval environment

`claude plugin eval` refuses any run that grants `Bash` when `~/.docker` holds a symbolic link (Docker Desktop installs several), because its sandbox cannot exclude that credential store. The measured run starts `claude plugin eval` with `HOME` set to a clean directory whose `Library/Keychains` links to the user's keychain, so the run stays logged in and the user's Docker install stays untouched. The child runs get their own temporary home either way. `RESULTS.md` records this.

### D12. Coordination with parallel work

The shared files this Change touches (`release-please-config.json`, `.release-please-manifest.json`, `.claude-plugin/marketplace.json`, `CLAUDE.md`) were announced to the agents working on #179, #180, #186, #187, #188 and #189 before the PR; their merges were rebased in, and #189 had already added the same `.gitignore` line, so this Change no longer touches `.gitignore`. #189's `skill-evals` spec covers `plugins/bdk/evals/` only; `bdk-craft` keeps its own admission record (D7). #189 (eval setup for `plugins/bdk`) also got the eval lessons of D10 and D11. `bdk-craft` shares no code with `plugins/bdk`; its cases and scaffolds stay inside `plugins/bdk-craft/evals/`.

## Risks / Trade-offs

- **Three runs per arm is still a small sample.** → The `+0.10` margin and the fired condition (D3); the record keeps per-case numbers, so a disputed verdict can be re-run with `--runs 5` on that skill's cases.
- **The with-arm holds all eight candidates while measuring each one.** → The fired condition attributes the effect; removing rejected skills afterwards only removes competing descriptions.
- **A grader can reward a choice the skill prefers rather than a better outcome** (the draft's `mermaid-drawer/failure-path`). → Graders check behaviours that any expert reviewer would accept (D4); where a case fails for a defensible answer, the record says so instead of hiding it.
- **Cost.** About 144 agent runs plus judge calls. → `--max-cost-usd` on each run; cases capped by `max_turns` and `timeout_seconds`.
- **The marketplace entry points at a branch that does not hold the plugin yet.** → Same for every plugin until the first release (D8).

## Outcome

Measured on 2026-10-07 with the installed Claude Code 2.1.293 (the workspace pins 2.1.292 for CI loader checks; `claude plugin eval` behaved the same in the dry runs on 2.1.292), agent `claude-opus-5-5`, judge `claude-sonnet-5-5`, three runs per arm, 33.33 USD. Full numbers: `plugins/bdk-craft/evals/RESULTS.md`.

**Ships in v3.0:** `tdd` (`Δ` +0.25), `debugging` (+0.11), `refactoring` (+0.56), `testing-strategy` (+0.44), `mermaid-drawer` (+0.41). Each fired in 9 of 9 with-arm runs.

**Rejected and deleted with their cases:** `api-design` (+0.07), `oop-design` (+0.07), `modularizing` (-0.05). They fired on every case, but a plain Opus already makes the choices they encode, so the cases score near the ceiling without them. The draft admitted all three on one run per cell and reply-wording checks; with three runs and behaviour graders the effect does not hold.

**What the run showed beyond the verdicts:**

- The suite run hit the account's weekly usage limit part way through. Every run of the `tdd-*` and `testing-strategy-*` cases and of `refactoring-user-label` failed with that error and scored 0 in both arms; those seven cases were re-run in full after the reset, and only the re-run numbers are used (task 4.1).
- `debugging` passes by a small margin. In `debugging-invoice-cents` no run of either arm ran the new test before the fix, although the skill asks for it; the skill's effect comes from the regression test and the search for the same defect. A follow-up can try a stronger step 2 against this case.
- `tdd-business-days` scores lower with the skill: a plain Opus already works test-first on that prompt.
