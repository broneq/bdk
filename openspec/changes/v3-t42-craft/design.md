# Design

## Context

`bdk` ships three v2 knowledge skills: `skills/debug/` (it runs as a session and writes `.bdk/debug/`), `skills/test-driven-development/` and `skills/mermaid-drawer/`. `debug` and `test-driven-development` have `ctx skill` manifest entries (`tools("test")`, `tools("lint")`, `rules("test-quality")`), and `debug` has two `skill-check` baseline entries. `skills/stages/design/references/approaches.md` names `/bdk:mermaid-drawer`. The kernel already supports `change new --kind bug` (the `bug` graph goes from `intent` to `plan`).

The `worker` adapter has no `Skill` tool, so an implementer cannot load a skill by name. A dispatch package is committed with the Change and is capped at 12 288 bytes (`policy/package-too-large`). `skill-check.config.ts` already defines the convention "Portable craft skills" (no `!` block, no `${CLAUDE_PLUGIN_ROOT}`), and the kit supports a `profile` per target. The with / without harness builds copies of the `bdk` plugin only. Marketplace sources include `git-subdir` (`url`, `path`), checked against the Claude Code marketplace docs on 2026-10-04.

User decisions on 2026-10-04: all nine craft skills in this Change, each with a probe; the kind-bug craft load goes into the kernel now; `bdk-craft` lives at `plugins/bdk-craft/` in this repository.

## Goals / Non-Goals

**Goals:**

- `bdk-craft` installable alone from the same marketplace, portable, with no build.
- Nine craft skills written, each probed, and only the measured ones shipped.
- An implementer gets `tdd`, and `debugging` on a bug Change, without a host feature it lacks.
- `bdk` without `debug`, `test-driven-development` and `mermaid-drawer`.

**Non-Goals:**

- The 3.0 release of both plugins and the final README tables (T32, T50).
- The multi-host run of the craft skills (T50).
- Craft loading for roles other than `implementer`, or for skills other than `tdd` and `debugging`. The other seven have no task-kind signal; they are user-invocable and model-invocable.
- A full with / without series. Probes only, as the user approved.

## Decisions

### D1. `plugins/bdk-craft/` with a `git-subdir` source

The plugin sits in a subdirectory of this repository, listed with `{"source": "git-subdir", "url": "broneq/bdk", "path": "plugins/bdk-craft"}`. It needs no build, so it installs from the default branch, unlike `bdk`, which installs from `release`.

- _Separate repository_ (like `bdk-skill-kit`): separate CI and releases, but the craft skills, their task files, the harness and the dispatch mapping change together. Rejected by the user.
- _A relative `source`_: works only when the marketplace itself is added from git; the `bdk` entry already uses a remote source, so one style is kept.

### D2. The worker reads a craft skill through `bdk ctx craft <name>`

The `implementer` package gets a `Craft` section that names the skills and the command; the agent runs `bdk ctx craft tdd` and gets the body with its references inlined.

- _Inline the skill body in the package_: a 200-line skill plus references can exceed the 12 288-byte cap with the task, the role body and the entries already in the package. Rejected.
- _An absolute path to the cached `SKILL.md`_: the package is committed, so a home directory and a version directory would land in git and go stale on upgrade. Rejected.
- _Preload through the adapter's `skills:` frontmatter_: static per adapter, while the choice depends on the Change kind; and it fails when `bdk-craft` is not installed. Rejected.
- _Give the worker the `Skill` tool_: the adapters are generated with a fixed tool list (T23-D19), and a `Skill` call does not work on the headless runner. Rejected.

### D3. Lookup: the repository checkout, then the plugin cache

`ctx craft` looks first under the running kernel's plugin root (`plugins/bdk-craft/skills/`), so a `claude --plugin-dir` checkout and the eval copies use the craft skills of the same commit. It then scans `~/.claude/plugins/cache/*/bdk-craft/<version>/skills/`, highest semantic version first. As with `hooks skill-exists`, it reads only the directory layout, never the host's bookkeeping files (D-9 of `kernel-cli/hooks`).

- _The host's `installed_plugins.json`_: knows the active version, but it is a host-internal file with no stability promise. Rejected.

### D4. Which craft skills a package names

`implementer` always gets `tdd`; on a Change of kind `bug` it gets `debugging` first, because the reproduction comes before the red test. The mapping is fixed in the kernel, not a setting. A project that wants another mapping has no use case yet, and a setting can be added without breaking packages. The section is computed at build time, so `dispatch show` shows what the agent was told.

### D5. `debugging` does not open a Change

The plan text says `debugging` "opens a Change with `--inferred` when `bdk` is present". That would need a kernel call and break the craft criterion "no kernel" (R-1). The `bdk` side does it instead: `/bdk:change` opens a Change of kind `bug`, and the package then hands `debugging` to the implementer (D4). The craft skill stays stateless and writes no `.bdk/` file.

### D6. Content: processes and named choices, at most 200 lines

Each skill follows the user's admission rule (R-6): a process with checkable steps, or a concrete choice among named alternatives (for example the Test Data Builder or the Page Object Model). `tdd`, `debugging` and `mermaid-drawer` are rewritten from the v2 skills:

- `tdd` loses the BDK-only parts: gates through BDK commands and project command placeholders.
- `debugging` loses the `.bdk/debug/` session file and the hand-off to `/bdk:plan`.
- `mermaid-drawer` keeps its recipes reference.

The six new skills are written from scratch. A skill is written to change behaviour on its task file, not to cover a topic.

### D7. Admission: summed assertions, probe only

Each skill gets three tasks under `evals/suites/with-without/examples/craft/<name>.yaml`, and one probe of one run per cell. It is admitted when its `with` cell passes more assertions than its `without` cell, summed over the tasks.

- _The difference rule of the full series_ (medians apart by more than the larger within-cell range): this needs five runs per cell, about five times the spend, and the user approved probes only. The verdict is recorded with its numbers, so a later series can overturn it.

A rejected skill is deleted, but its task file stays, so the decision can be re-run. The report `docs/V3-EVAL-CRAFT.md` holds the table.

### D8. Harness: `bdk-craft:<name>` builds a craft-only copy

`--skill bdk-craft:<name>` copies `plugins/bdk-craft` at `HEAD`, and the `without` copy lacks `skills/<name>`. No `bdk` plugin is loaded, so a passing `with` cell also shows that the skill works without `bdk` (acceptance signal "`bdk-craft` installs alone ... and `tdd` runs there").

### D9. Tests

`kernel/tests/contract/craft-skills.test.ts` covers:

- the manifest, the marketplace entry and the plugin's top-level contents;
- the portable shape of every skill;
- the admitted rows of the report;
- the removal of the v2 skills and the stale-name search, which reuses the "Removed skills" exemption of `tools-skills`.

The `ctx craft` command gets unit tests for the lookup order and the version sort, and an e2e test for the exit codes. Dispatch build tests cover the `Craft` section for kinds `feature` and `bug`, the absence without `bdk-craft`, and the absence for other roles. `tools-skills.test.ts` keeps its own list of removed skills.

## Risks / Trade-offs

- **A probe is one run per cell**, so a verdict can be noise. Mitigation: three tasks per skill, assertions on concrete markers, and the numbers kept in the report so a series can revisit them.
- **Some general skills may be rejected** (`oop-design`, `api-design`). That is the admission rule working. The report records it, and the plugin ships fewer skills.
- **The cache lookup picks the highest cached version**, which may not be the one the host enabled when several versions are cached. Mitigation: the host prunes old versions on update. The checkout path wins in development.
- **Spend:** roughly 2 to 13 USD per probe, 30 to 60 USD for nine, within the approved budget (about 269 USD left). Each probe runs with `--run-cap 3`.
