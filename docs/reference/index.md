# Overview - every skill, agent, command, setting and hook, generated from the plugins

The pages of this section are generated from the plugin sources (skill and agent files, `hooks.json`, the `bdk` command declarations and the settings schema), so they always match the version this site documents. A check in the BDK repository fails when a page and the sources disagree.

## bdk

The workflow plugin.

- [Skills](./bdk/skills.md): every `/bdk:` command and block, with its arguments and who starts it.
- [Agents](./bdk/agents.md): the subagents the skills start, with their models and tools.
- [CLI](./bdk/cli.md): every `bdk` command, as `--help` prints it.
- [Settings](./bdk/settings.md): every key of `.bdk/settings.yaml`, with its type and default.
- [Rules](./bdk/rules.md): every rule of the rule pack, with its id for `rules.disabled`.
- [Hooks](./bdk/hooks.md): what runs at session start and before Bash commands.

## The other plugins

- [bdk-craft](./bdk-craft.md): engineering craft skills (TDD, debugging, refactoring, testing strategy, Mermaid diagrams).
- [bdk-skill-kit](./bdk-skill-kit.md): the skill validator and authoring guidance.
- [git-identity](./git-identity.md): GitHub account and commit identity per project.
