# bdk-skill-kit

Deterministic checks and authoring guidance for [Agent Skills](https://agentskills.io/specification) and Claude Code subagent files.

- **`skill-check`**, a CLI that validates skill directories and agent files: frontmatter per host profile, size, references, layout, duplicate names and thin CLI-fronting skills. It has no runtime dependencies beyond Node.
- **Two skills** for the agent: `skill-authoring` (how to write a skill, with every guideline tied to the rule that checks it) and `skill-check` (when and how to run the checker).

## Install

### As a Claude Code plugin

The kit is listed in the BDK marketplace:

```text
/plugin marketplace add broneq/bdk
/plugin install bdk-skill-kit@bdk
```

The plugin brings both skills. The `skill-check` skill runs the bundled CLI from the plugin directory.

### As a project dev dependency

For CI and pre-commit hooks, pin a release tag. The package is not on npm; the tag carries the built bundle.

```sh
pnpm add -D github:broneq/bdk-skill-kit#v0.1.0
pnpm exec skill-check --help
```

Node 22.18 or newer is required, so that a `skill-check.config.ts` loads without a build step.

## Configure

`skill-check` reads `skill-check.config.ts` (or `.mjs`, `.js`) from the working directory. A target is a set of directories checked with one profile: `claude-code` (the default) accepts the Claude Code fields, and `portable` accepts only the six fields of the Agent Skills standard.

```ts
import { defineConfig } from "bdk-skill-kit";

export default defineConfig({
  targets: [
    { kind: "skills", dirs: ["skills"] },
    { kind: "agents", dirs: ["agents"] },
    { kind: "skills", dirs: ["craft"], profile: "portable", name: "craft" },
  ],
  rules: {
    "description-front-loaded": "error",
    "require-model": "error",
    layout: ["error", { allowed: ["references", "scripts", "assets", "examples"] }],
  },
  baseline: "skill-check.baseline.json",
});
```

A rule setting is `"off"`, `"warning"`, `"error"` or `[severity, options]`. A target can override settings with its own `rules`.

## Add project rules

A plugin adds rules under its own name, so rule `x` of plugin `acme` is `acme/x`:

```ts
import { definePlugin, defineRule } from "bdk-skill-kit";

const noTodo = defineRule({
  id: "no-todo",
  kinds: ["skills"],
  defaultSeverity: "error",
  check(doc, ctx) {
    doc.lines.forEach((line, i) => {
      if (line.includes("TODO")) ctx.report({ line: i + 1, message: "resolve the TODO", match: line });
    });
  },
});

export default definePlugin({ name: "acme", rules: [noTodo] });
```

List the plugin in the config with `plugins: [acme]`. A rule with `checkProject` instead of `check` runs once over every document of its kinds.

## Adopt on an existing tree

A baseline records today's findings so that only new ones fail. It can only shrink:

```sh
pnpm exec skill-check --baseline-init
pnpm exec skill-check --baseline-prune
```

`--baseline-init` refuses to overwrite an existing file. A baseline entry that no longer matches a finding is a `baseline-stale` error until `--baseline-prune` removes it, and prune never adds entries.

## Rules

The rule catalogue, the profiles and the exit codes are specified in the [`skill-kit` spec](openspec/specs/skill-kit/spec.md). `skill-check --help` is the usage reference, and `skill-check --list-rules` prints the rules a config enables. The `skill-authoring` skill explains what each rule asks for and why.

## Develop

```sh
pnpm install
pnpm hooks
pnpm build
pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip
pnpm test
pnpm self-check
```

`dist/` is committed and rebuilt by `pnpm build`; CI fails when it differs from the source. Releases are cut by release-please from Conventional Commits.

A change to the contract (a rule, an option, the output, the exit codes) runs as an [OpenSpec](https://github.com/Fission-AI/OpenSpec) change that updates `openspec/specs/skill-kit/spec.md` in the same PR: `/opsx:propose <name>`, then `/opsx:apply` and `/opsx:archive`.

## License

MIT
