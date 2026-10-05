# Design

## Context

`.bdk/` holds committed state that only the kernel writes (`kernel-state`, Change directory layout, Write map). Its files are Markdown with YAML frontmatter, plus JSON evidence captures. Three of them are hashed byte for byte:

- graph input hashes over the artifacts of a Change (`kernel-pipeline`, Artifact kinds; T02 P2): a done node whose inputs changed is `stale`;
- the `bdk-merge-hash` of a living spec (`kernel-state`, Living spec file; T30-D13): `doctor` fails on a mismatch and `spec merge` refuses;
- evidence tree hashes, which never cover `.bdk/**` because `policy.evidence.non-executable` lists it (T23-D16).

The project's own tools know nothing of this. A linter that reads `**/*.md` reports kernel-written files; an agent asked to make lint pass then "fixes" the project's tool configuration, as in the T42 probe. A formatter in write mode rewrites the hashed files.

## Decisions

### D1. The setup step and its consent question

`/bdk:setup` gets a section "Keep `.bdk/` out of the project's tools" between "Settings" and "Lavish". It needs the confirmed lint commands, and it must come before the closing `doctor` run.

1. From `references/stacks.md`, find the configuration of every tool the project has that reads Markdown, YAML or JSON, and every project script that lists files itself (`git ls-files`, a glob). Skip a tool whose ignore list already covers `.bdk/`. A tool's `.gitignore` support does not count: the files are committed, so `.gitignore` never lists them.
2. Ask once, with `AskUserQuestion`: a multi-select with one option per file, labelled with the file and the entry it gets (`.markdownlint-cli2.mjs: ignores ['.bdk/**']`). The recommended answer is all of them.
3. Write each accepted entry with the smallest edit: add `.bdk/` to an existing ignore list, or create the ignore file (`.prettierignore`) when the tool has none.
4. Run every `tools.lint` entry's `command` once (check forms only; `setup` never runs a formatter's write mode). Report every path under `.bdk/` in their output. A path left there means an exclusion is missing: offer it and repeat. Failures elsewhere are the project's own and are only reported.
5. Commit the edited files, and only them, in their own commit: `git add <files>` and `git commit -m "chore(bdk): keep .bdk/ out of the project's tools" -- <files>`.

A declined exclusion is named in the closing report, with the consequence: agents log a `question` when a tool reports `.bdk/` files (D4).

Alternatives:

- **Run the tools first and exclude only what they report.** Lost: on a fresh project `.bdk/` holds only `settings.yaml`, so no Markdown tool reports anything at setup time; the problem appears with the first Change.
- **One question per tool.** Lost: the answers are independent and of one kind; one multi-select is the stage skills' rule for that (`Asking the user in two tiers`).
- **No commit, leave the edit in the working tree.** Lost: the issue requires its own commit, and an uncommitted tool config edit would ride along in the first task commit, where the diff check and review see a file outside the task's `Files:`.

### D2. `bdk doctor` does not check the exclusion

Most tool configurations are code (`eslint.config.js`, `.markdownlint-cli2.mjs`, `prettier.config.mjs`): reading their ignore lists needs executing them, which `doctor`'s read-only, fast contract excludes. A check limited to the declarative files would pass a project whose real config is a `.mjs` and so give false confidence. The setup step reads any format, because the model reads it; the role contract line (D4) catches what setup missed.

Alternative: a `doctor` finding for declarative ignore files only. Lost for the reason above.

### D3. Point 4: a formatter that rewrites `.bdk/` breaks the kernel's hashes

Measured in this Change with the repository's pinned `prettier` 3, `--write .` over a project whose `tiny` Change passed `gate:review` and whose living spec `auth/login` was merged:

- prettier rewrote 15 files under `.bdk/`: every Markdown file whose frontmatter is followed directly by a heading or text got a blank line, and every JSON evidence capture was re-spaced;
- `plan-part:01` and `execute-part:01` went from `done` to `stale` ("inputs changed: recorded sha256:..., current sha256:..."), so the reviewed Change was back at the plan stage;
- `doctor` reported the `merge-hash` finding at level `fail` for `.bdk/specs/auth/login/spec.md`, and `spec merge` refused with `policy/merge-hash-mismatch`;
- the ledger, attempts and evidence manifests still read: `log list` and `change status` exited 0.

A pre-commit hook that runs a formatter on staged files (lint-staged) hits `bdk commit` the same way.

Protection, in order: the setup exclusion (D1), which every formatter and every lint-staged run honours through the tool's own ignore list; the contract line that forbids roles to rewrite `.bdk/` files (D4); and the kernel's existing detection, which already names the file and both hashes. An E2E test keeps the finding true: it runs the pinned prettier and asserts the stale node and the `merge-hash` finding, and asserts that the same run with `.bdk/` in `.prettierignore` leaves `.bdk/` untouched and the Change done.

Alternatives:

- **Hash a normalised form** (whitespace, blank lines, table padding stripped). Lost: every formatter normalises differently (prettier, markdownlint `--fix`, the fixture's own `format:markdown`), a normaliser chasing them is unbounded, and the merge hash is defined over the body's bytes (T30-D6).
- **Write prettier-stable Markdown** (a blank line after the frontmatter). Lost: it fixes one formatter and changes every snapshot and recorded hash, while the next formatter rewrites something else.
- **Kernel-written nested ignore files under `.bdk/`.** Lost: prettier and ESLint read only the root ignore file, so it protects nothing for the common tools.

### D4. The review rule is a role contract line

The roles that report or act on a check's output carry one sentence each:

- `reviewer`, `integration-reviewer`: a problem caused only by files under `.bdk/` is a `question` naming `/bdk:setup`, not a finding;
- `implementer`, `simplifier`: never change the project's tool configuration for `.bdk/` files, and never rewrite them with a formatter; log a `question` naming `/bdk:setup`;
- `runner`: paths under `.bdk/` get no finding but one `question` naming `/bdk:setup`, and a check that fails only on them is recorded `not-run` with that reason.

`not-run` is the existing runner rule for a check that cannot run because of the setup, so the not-run budget brings the user in; the user, not an agent, owns the project's tool configuration. A `question` without `park` keeps the run going until that budget decides.

Alternatives:

- **A rule file in the BDK rule pack.** Lost: a pack rule is a choice among valid alternatives admitted by measurement (`rules/README.md`, Admission), and a process boundary is not one; the line also has to reach the runner, which reads rules only to cite them.
- **Record such a check `pass`.** Lost: the check exited non-zero, and a `pass` needs a citation of the line that shows the result, which does not exist.

The bodies of `implementer` (4 005 bytes) and `integration-reviewer` (4 080 bytes) were close to the 4 096-byte budget, so the line came with rewording that keeps every rule: the implementer's `Craft` and `review-fix` bullets are shorter and "leave your changes uncommitted" joined the git sentence; the integration reviewer lost the sentence on other reviewers, the human-decides clause the P3 bullet already carries, and a shorter gate sentence.

### D5. The acceptance runs on the eval fixture

The `fresh-project` setup case answers the exclusion question with yes and expects `.markdownlint-cli2.mjs` to name `.bdk` and its last commit to be the setup's. The `run-auto` case prepares the fixture as setup leaves it (the markdownlint `ignores` entry and the `git ls-files` pathspec of the two Markdown check scripts, committed), sets `tools.lint` to `npm run lint`, and expects that no commit after the preparation touches `.markdownlint-cli2.mjs`, `eslint.config.js`, `package.json` or `scripts/`. Both are measured with `pnpm eval` only after the user approves the spend.

## Risks

- A tool BDK's table does not list. Mitigation: the step tells the model to check any tool that reads Markdown, YAML or JSON, and the run of the lint commands shows what is left.
- The setup step edits files the user owns. Mitigation: nothing is written without the multi-select answer, and the commit holds only those files.
