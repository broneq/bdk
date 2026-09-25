---
name: skill-check
description: Validates Agent Skills directories and agent files with deterministic rules - frontmatter, size, references, layout and CLI-fronting skills. Use when a skill or an agent is about to be committed, or when CI reports a skill-check finding.
license: MIT
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs *)
metadata:
  fronts-cli: skill-check
---

Run the checker from the project root after you add or change a skill or an agent, and before you commit. It reads `skill-check.config.ts` (or `.mjs`, `.js`) from the working directory.

```sh
node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs --json
```

Exit 0 means clean. Exit 1 means findings: each one names a rule ID, a file and a line. Exit 2 means the config or the arguments are wrong; the reason is on stderr.

Fix a finding in the file it names. The `skill-authoring` skill explains what each rule ID asks for and why.

`skill-check --help` is the only usage reference: run the command above with `--help` instead of `--json` for options, the baseline and exit codes.
