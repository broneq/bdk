# Migration from v2

BDK 3 replaces BDK 2 completely. There is no compatibility mode: BDK 3 never
reads the v2 files, and BDK 2 gets no fixes or support after 3.0. A project
moves over once, with `/bdk:setup`, and this page is everything you need for
that move.

## Steps

1. **Install Node >= 22.13** and keep it on `PATH`. BDK 3 runs a Node kernel;
   see [Installation](installation.md#node).
2. **Update the plugin**: open `/plugin`, select `bdk` on the **Installed**
   tab and choose **Update now** (or run `claude plugin update bdk@bdk` in your
   shell), then `/reload-plugins`. The engineering skills that used to ship
   inside BDK (TDD, debugging, Mermaid) are now the separate `bdk-craft`
   plugin: `/plugin install bdk-craft@bdk`.
3. **Run `/bdk:setup`** in the project. The session start already tells you the
   project has the v2 layout, and `bdk doctor` reports it as `v2-layout`.
   Setup then:
   - replaces the v2 ignore rule, after you confirm (see
     [below](#the-v2-ignore-rule));
   - offers the values of `.bdk/settings.json` as detected settings, which you
     confirm like any detection (see [Settings](#settings));
   - imports your hand-written rules from `.claude/rules/` into `.bdk/rules/`,
     after showing you what the import would write;
   - deletes the v2 paths, after you confirm (see [Artifacts](#artifacts)).
4. **Commit** `.bdk/settings.yaml`, `.bdk/rules/` and `.gitignore`.
5. **Start working in Changes**: `/bdk:change "<what you want to build>"`. See
   [Your first feature](first-feature.md).

When you decline a step, setup changes nothing for it, and `bdk doctor` keeps
reporting what is left.

## The v2 ignore rule

BDK 2 appended this block to `.gitignore` the first time a plan ran:

```gitignore
# BDK run state - machine-owned, never committed
/.bdk/
```

In BDK 3 that rule hides the files the team must share: `.bdk/settings.yaml`,
`.bdk/rules/` and the Changes. `bdk doctor` reports it as `bdk-ignored`, also
in a project whose v2 files are gone. Setup shows the rule and its file,
removes it after you confirm, adds the two paths BDK 3 keeps out of git
(`/.bdk/.machine/` and `/.bdk/settings.local.yaml`) and commits `.gitignore`
alone.

## Settings

`.bdk/settings.json` becomes `.bdk/settings.yaml`, one confirmed value at a
time, written with `bdk config set`:

| v2 key                                            | BDK 3                                                                                                                                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `languages`                                       | `languages`                                                                                                                                                                         |
| `test-tools`, `lint-tools`, `build-tools`         | `tools.test`, `tools.lint`, `tools.build`; an item's `type` becomes its `id`, and every entry now needs a `tier`                                                                    |
| `features.lavish`                                 | `features.lavish`                                                                                                                                                                   |
| `quality.<category>`, `language-rules.<language>` | Not settings any more: your own rules are files in `.bdk/rules/` (`bdk rules accept`), a BDK rule is switched off with `rules.disabled`, and `languages` selects the language packs |
| `features.caveman`                                | Removed, no replacement                                                                                                                                                             |
| `features.serena`, `features.code-review-graph`   | Removed with the bundled MCP servers ([ADR-0001](https://github.com/broneq/bdk/blob/main/docs/adr/0001-remove-bundled-mcp-servers.md))                                              |
| `$schema`                                         | The `yaml-language-server` modeline at the top of the YAML file                                                                                                                     |

Any other key is reported as not carried over. A v2 key left in a YAML layer
fails `bdk config check` with `policy/unknown-config-key`, whose message names
its replacement. Every key BDK 3 accepts is on
[Configuration](../reference/configuration.md).

## Skills

BDK 2 kept its state in Claude Code's task tools and in per-skill files. BDK 3
keeps it in the Change, which the kernel owns, so the skills that existed to
carry state between sessions are gone:

| BDK 2                                                    | BDK 3                                                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/bdk:create-plan`, `/bdk:create-tasks`, `/bdk:refactor` | `/bdk:plan`, inside a Change opened with `/bdk:change`                                                     |
| `/bdk:execute-plan`, `/bdk:subagent-execute-plan`        | `/bdk:execute`, or `/bdk:run` to drive every stage                                                         |
| `/bdk:save-progress`, `/bdk:restore-progress`            | Nothing to invoke: the Change and the task commits hold the state, and `/bdk:run` resumes from `bdk next`  |
| `/bdk:brainstorming`, `/bdk:brainstorm-architecture`     | `/bdk:design`                                                                                              |
| `/bdk:verify-plan`                                       | `/bdk:verify-plan`, now a stage of the Change; `/bdk:verify-design` checks the design the same way         |
| `/bdk:explain-complex-code`, `/bdk:update-docs`          | `/bdk:docs`                                                                                                |
| `/bdk:create-adr`                                        | `/bdk:adr`                                                                                                 |
| `/bdk:add-rule`, `/bdk:refine-rules`                     | `/bdk:rules`                                                                                               |
| `/bdk:test-driven-development`                           | `/bdk-craft:tdd`                                                                                           |
| `/bdk:debug`                                             | `/bdk-craft:debugging`; a `bug` Change from `/bdk:change` when the fix needs a plan and a review           |
| `/bdk:mermaid-drawer`                                    | `/bdk-craft:mermaid-drawer`                                                                                |
| `/bdk:graphviz-docs-compiler`                            | Nothing: `/bdk:docs` and `/bdk:adr` embed Mermaid, which renders without a compile step                    |
| `/bdk:audit-prompt`                                      | Nothing                                                                                                    |
| the `bdk-*` skills preloaded into agents                 | Nothing to invoke: each agent gets its rules with `bdk rules show` and its context in its dispatch package |

`/bdk:setup`, `/bdk:design`, `/bdk:cr`, `/bdk:pr-review` and `/bdk:commit` keep
their names and do the v3 job; see [Skills](../reference/skills.md).

## Agents

The thirteen v2 agents became six adapters that each run a role, plus
`bdk:web-researcher`. You no longer pick them: the stage skills dispatch them.
The table names the adapter that now does the closest job.

| BDK 2                                                                   | BDK 3                                                          |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| `bdk:implementer`, `bdk:fixer`                                          | `bdk:worker` (implementer and simplifier roles)                |
| `bdk:plan-verifier`, `bdk:design-verifier`, `bdk:architecture-reviewer` | `bdk:reader` (verifier, design-verifier, integration reviewer) |
| `bdk:code-reviewer`, `bdk:dead-code-detector`, `bdk:duplicate-detector` | `bdk:reviewer` (reviewer and PR reviewer roles)                |
| `bdk:test-runner`, `bdk:static-analyse`                                 | `bdk:runner`                                                   |
| `bdk:explorer`, `bdk:log-analyzer`                                      | `bdk:scout`                                                    |
| `bdk:web-researcher`                                                    | `bdk:web-researcher`                                           |

`bdk:lead` is new: it runs one plan part of a `large` Change. See
[Agents](../reference/agents.md).

## Artifacts

BDK 2 wrote its output under `.bdk/<skill-name>/` and tracked nothing. BDK 3
keeps a Change under `.bdk/changes/<id>/` and commits it.

| v2 path                      | Written by                   | What happens                                                                                |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| `.bdk/settings.json`         | v2 setup                     | Read as hints for `.bdk/settings.yaml`, then deleted                                        |
| `.bdk/plans/`                | `/bdk:create-plan`           | Deleted; a plan lives in its Change as `plan/parts/`                                        |
| `.bdk/design/`               | v2 `/bdk:design`             | Deleted; a design you still want becomes a new `/bdk:change`                                |
| `.bdk/runs/`                 | `/bdk:subagent-execute-plan` | Deleted; progress lives in the Change and in the task commits' trailers                     |
| `.bdk/verify-plan/`          | v2 `/bdk:verify-plan`        | Deleted; a verifier's report lives in its Change                                            |
| `.bdk/cr/`                   | v2 `/bdk:cr`                 | Left alone; the review lives in its Change, and its human report in `.bdk/.machine/review/` |
| `.bdk/explain-complex-code/` | `/bdk:explain-complex-code`  | Left alone; `/bdk:docs` writes to `docs/architecture/`                                      |

The BDK 3 layout is on [Artifacts](../reference/artifacts.md).

## Not migrated

- **Plans, designs, run manifests and verification reports.** They have no BDK
  3 counterpart and are deleted. Finish or abandon a v2 plan before you
  migrate, or open a new Change for it.
- **v2 settings without a BDK 3 key**, listed above. Setup reports each one.
- **Quality and language rule overrides.** Setup names their replacement but
  writes nothing; add the rules you still want with `/bdk:rules`.
- **Hand-written rules the import skips.** The import reports each skipped
  file with its reason and leaves it in place.
