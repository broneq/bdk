## ADDED Requirements

### Requirement: bdk ctx craft

Print an installed `bdk-craft` skill for an agent that cannot load skills itself. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk ctx craft <name>`
- **Availability:** `agent`
- **Mode:** `command`
- **Arguments:**
  - `<name>` (required). A craft skill name, e.g. tdd, debugging.
- **Behaviour:** Finds the `SKILL.md` of the craft skill `<name>` in this order and takes the first hit: `plugins/bdk-craft/skills/<name>/` under the plugin root of the running kernel (a checkout of this repository); then `~/.claude/plugins/cache/<marketplace>/bdk-craft/<version>/skills/<name>/` across every marketplace, the highest `<version>` by semantic version first. Only the directory layout is read, never the host's plugin bookkeeping files. The output is Markdown: the heading `## Craft: <name>`, the skill body without its frontmatter and with its headings one level down, then each file under the skill's `references/` in name order under `### references/<file>`, so the agent gets what the skill links without resolving a path. The command reads no configuration, needs no Change and no git work tree.
- **Writes:** nothing
- **Output:** `schema/cli/output/ctx.json` for `--json`, with one part of kind `craft` whose `source` is `bdk-craft/<name>`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0, 2, 3`. Specific rules: `input/not-found` when no `bdk-craft` install holds `<name>`, its `why` naming the paths searched; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk ctx craft tdd --json
  ```

  ```json
  {
    "content": "## Craft: tdd\n\n### Red\n...",
    "parts": [
      {
        "kind": "craft",
        "source": "bdk-craft/tdd"
      }
    ]
  }
  ```

- **Owner:** T42
- **Slice:** `ctx`

#### Scenario: example run

- **WHEN** `bdk ctx craft tdd --json` runs with `bdk-craft` in the plugin cache
- **THEN** the exit code is 0 and `content` starts with `## Craft: tdd` followed by the skill body without frontmatter

#### Scenario: repository checkout first

- **WHEN** the kernel runs from a checkout that holds `plugins/bdk-craft/skills/tdd/SKILL.md` and the cache holds another version
- **THEN** the output is the checkout's skill

#### Scenario: highest cached version

- **WHEN** the cache holds `bdk-craft` versions `0.2.0` and `0.10.0`, both with `tdd`
- **THEN** the output is the `0.10.0` skill

#### Scenario: references inlined

- **WHEN** the skill has `references/builders.md`
- **THEN** the output ends with a `### references/builders.md` section holding that file

#### Scenario: input/not-found

- **WHEN** `bdk ctx craft tdd` runs and no `bdk-craft` install holds `tdd`
- **THEN** the exit code is 3 and the error is `input/not-found`, its `why` naming the searched paths
