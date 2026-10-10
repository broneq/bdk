# Design

## Context

- `plugins/bdk-craft/` is the model of a plain-skill plugin admitted by evals: skills only, cases in `evals/<skill>-<case>/` for `claude plugin eval`, an admission record in `evals/RESULTS.md` checked by `tests/craft-skills.test.ts` (archived Change `v3-207-bdk-craft-plugin`, D2-D8, D10, D11).
- "Building skills (v3)" in `CLAUDE.md`: write the skill with `/skill-creator`, start as a plain skill with eval cases, add a CLI helper, hook or workflow only for a measured problem. ADR-0002 and "Target layout (v3)": one plugin per directory, wired into the marketplace and release-please in the same PR.
- The third-party mod `explain-as` (html mode) is the idea only. It has no license file, so no text or code of it is copied. Its two weak points are the reason for this plugin's output rules: it writes `.explain/` into the current directory (a dirty worktree), and its preview depends on terminal image support (nothing shows inside Herdr).
- `claude plugin eval` (Claude Code 2.1.292 pinned, 2.1.296 installed) grades a file only by a fixed path (`target: { source: file, path }`), a created path by glob (`file_exists`), the list of created paths (`target: files`) and the trace (JSON lines with the tool inputs).

## Goals / Non-Goals

**Goals:**

- One skill that turns "how does X work" into one interactive page in the browser, with nothing new in `git status`.
- Evidence that the skill changes the outcome over a plain agent asked the same thing.

**Non-Goals:**

- A screenshot step, an in-terminal preview pane, other output formats (STE text, Mermaid, video).
- Use of the skill by `bdk` orchestrators.
- A `bdk` command, hook or helper script: no eval has shown a problem one would solve.

## Decisions

### D1. Plugin shape: one portable skill, like bdk-craft

`plugins/bdk-explain/` holds `.claude-plugin/plugin.json` (version `0.1.0`), `README.md`, `LICENSE` (MIT), `skills/explain/SKILL.md` and `evals/`. The skill frontmatter has only `name`, `description` and `license`, so it stays a portable Agent Skill and the same workspace checks as `bdk-craft` apply. The skill is model-invocable: its description fires on a request to explain code, a flow or a concept visually, as a page, a diagram or an interactive explainer, and on `/bdk-explain:explain <question>`. It does not fire on every "how does X work" question: a user who installs the plugin still gets a terminal answer to a quick question unless they ask for a visual one or type the command.

- _Fire on every "how does X work":_ the issue's acceptance signal uses that phrasing, but a page and a browser tab for every quick question is intrusive; with the command typed (`/bdk-explain:explain how does X work`) the acceptance signal holds. Lost.
- _An `argument-hint` field:_ a Claude Code extension of the frontmatter; the command works without it, and the portable shape keeps one shared check for both plugins. Lost.

### D2. Output under `.bdk/tmp/explain/`, ignored by its own `.gitignore`

The page is `<worktree root>/.bdk/tmp/explain/<short-name>.html`, the root from `git rev-parse --show-toplevel`, or the current directory outside git. The skill first writes `.bdk/tmp/.gitignore` with `*` when it is missing. A `*` in that file ignores the file itself and everything below, so `git status` shows nothing new, and the project's `.gitignore` is never touched. `<short-name>` is the name the user gave, else a kebab-case name of two to four words from the topic; the same name overwrites the earlier page, which keeps the directory small without deleting anything.

- _`$TMPDIR` or `/tmp`:_ the page belongs to the worktree it explains, and a path inside it survives a reboot and is easy to find again. Lost.
- _Add `.bdk/tmp/` to the project's `.gitignore`:_ edits a tracked file the user did not ask to change. Lost.

### D3. Opening the page; when it cannot be opened

The skill runs `open <path>` on macOS, `xdg-open <path>` on Linux when `DISPLAY` or `WAYLAND_DISPLAY` is set, and nothing in an SSH session (`SSH_CONNECTION` set) or on another platform. When nothing was opened or the command failed, the reply gives the path only: no retry, no other browser, no server. The reply is two or three lines of summary and the path, never the HTML source.

- _Start a local HTTP server:_ a process to manage and a port to pick, for a file that opens from disk. Lost.
- _Try every known browser in turn:_ guesses about the machine; the path is enough for the user. Lost.

### D4. No cleanup by age

The skill never deletes a page. Pages are small, the same topic reuses its name (D2), and `.bdk/tmp/` is ignored scratch that the user may delete at any time; the Guide says so. Deleting by age would remove a page the user still keeps open or links to, for little gain.

### D5. `.bdk/tmp/` is the shared scratch directory of BDK plugins

A BDK plugin that writes throwaway files writes them under `.bdk/tmp/<tool>/` and creates `.bdk/tmp/.gitignore` with `*` when missing. `bdk-explain` is the first user. The Guide names the convention (`docs/guide/explain.md`, and the table of `docs/guide/footprint.md`), so later plugins follow it instead of inventing their own place. `.bdk/runs/` stays the `bdk` run state; it is not scratch.

### D6. Page rules the skill gives the model

The skill is a process with checkable steps and a short set of page rules, the shape that changed outcomes in `bdk-craft`:

1. Read the code that answers the question first, and note the files.
2. Pick the one picture that answers it (flow, sequence, state machine, structure, a value curve) and the interaction that helps (step-through for a sequence, a slider or input for a value, hover or click details for a structure).
3. Write the page with the `Write` tool: one file, CSS custom properties for the colors with a `prefers-color-scheme: dark` block, a system font stack, inline SVG drawn with those properties, plain JavaScript with no library, buttons and keys (arrow keys) for stepping, `prefers-reduced-motion` respected. First screen: title, one-sentence answer, key picture. Below: the steps or parts, each with the file path it comes from.
4. Write `.bdk/tmp/.gitignore` before the page; open the page (D3); reply (D3).

What the skill does not say: wording of the page, a fixed template, colors. The model writes the page for the question.

### D7. Evals: three cases, behaviour graders, the admission rule of bdk-craft

Cases in `plugins/bdk-explain/evals/explain-<case>/`, each a request a user would type, never naming the skill, in a scaffolded git repository (plain ESM JavaScript, as `bdk-craft` D5). `Bash`, `Write` and `Edit` are granted, so the plain arm can do whatever a plain agent would.

- `explain-checkout-flow`: a checkout through cart, pricing, payment and order modules; the user asks for an interactive page named `checkout`. A fixed name lets the graders read the file by path (`.bdk/tmp/explain/checkout.html`): inline SVG, a dark-scheme block, no external resource, controls wired in script, source files named.
- `explain-token-bucket`: a rate limiter; the user wants to see visually how the bucket refills. No name is given, so graders use `file_exists` with a glob, the created-paths list, and the trace for a range or number input in the written page.
- `explain-retry-backoff`: a retry helper in a project whose `.gitignore` ignores only `node_modules/`; graders check `.bdk/tmp/.gitignore`, that no created path lies outside `.bdk/tmp/`, that `.gitignore` is unchanged, the open command, and the reply.

Every case also grades the reply (short, a path, no HTML source) and holds an unscored `tool_used: Skill` grader. Admission: mean `Δ` at least `+0.10` and fired in at least half of the with-arm runs (`bdk-craft` D3), three runs per arm, agent `claude-opus-5-5`, judge `claude-sonnet-5-5` (`bdk-craft` D6), recorded in `evals/RESULTS.md`. The run uses a clean `HOME` (`bdk-craft` D11).

- _A browser render check (screenshot, console errors):_ needs a browser in the eval run and a grader type `claude plugin eval` does not have. The page structure graders and a manual check in a test project cover it. Lost.

### D8. One workspace test for every plain-skill plugin admitted by evals

`tests/craft-skills.test.ts` becomes `tests/admitted-skills.test.ts`, run once per plugin of a list (`bdk-craft`, `bdk-explain`): manifest, skills only, portable frontmatter, the marketplace entry, and the admission record rules. `tests/eval-suites.test.ts` gets `"bdk-explain": ["Write", "Edit", "Bash"]`. One test with a list beats a copy that drifts.

### D9. Wiring

`release-please-config.json` gets `"plugins/bdk-explain": {"component": "bdk-explain", "bump-minor-pre-major": true}`, `.release-please-manifest.json` `"plugins/bdk-explain": "0.1.0"`, the marketplace a `git-subdir` entry at `ref: release` (same shape as `bdk-craft`). Installing it fails until the first release writes it to the `release` branch, as for every plugin of this line.

## Risks / Trade-offs

- **A plain Opus may already write a good page when asked for one.** → The admission rule decides; the cases grade what the skill adds (location, git status, self-containment, dark theme, controls, short reply), which a plain agent rarely does all at once.
- **`open` inside the eval sandbox may fail.** → The grader checks that the command ran, not that a browser appeared; the failure path (path only) is the specified behaviour.
- **Trace regexes on HTML content are fragile.** → Only the case without a fixed name reads the trace; the others read the file by path.

## Outcome

Measured on 2026-10-10 with Claude Code 2.1.292, agent `claude-opus-5-5`, judge `claude-sonnet-5-5`, three runs per arm, 7.74 USD: `explain` WITH 0.99, W/OUT 0.08, `Δ` +0.90, fired 9/9, **admitted**. Full numbers: `plugins/bdk-explain/evals/RESULTS.md`.

What the trials before the measured run changed:

- A plain Opus asked for an interactive page writes it into the project tree (`checkout.html` in the root, `docs/token-bucket-explorer.html`), or answers in the terminal when asked only for "a visual explainer". The graders were kept as written; they separate the two arms as intended.
- The first with-skill trial wrote correct pages but replied in ten or more lines with headings and findings, and the `reply` grader failed in every case. Step 4 now limits the reply to three short lines and shows an example; all three cases then scored 1.00.
- The manual check in a test project showed edge lines crossing boxes and labels, and inactive steps dimmed below legibility; the page rules gained "A clean diagram". A narrow-window rule ("Any window width") was added after a 390 px headless screenshot looked cut; measured with Playwright at 375 px, the page had no horizontal scroll either way (the cut came from Chrome's minimum window width), and the rule stays as the cheap guard it is.
- The eval sandbox cannot open a browser, so the open step fails in every eval run; the specified fallback (the path in the reply) is what the runs show. Opening was confirmed by hand on macOS.

## Open Questions

None.
