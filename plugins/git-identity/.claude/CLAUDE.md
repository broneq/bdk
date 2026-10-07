# git-identity

Claude Code plugin binding a project to a GitHub account and a git identity.
Rationale and measurements: `docs/decisions/0001-runtime-and-stack.md`.

This file sits in `.claude/` because `claude plugin validate --strict` rejects a
`CLAUDE.md` at the plugin root. Claude Code still loads it when working on files
of this plugin.

## Rules

These are the ones whose violation fails silently. Everything else is in the ADR.

- **Never write to a shared file.** Binding goes to `.claude/settings.local.json`,
  local exclusion to `.git/info/exclude`. Not `settings.json`, not the project's
  `.gitignore` - both are committed and carry absolute paths off this machine.
- **A skill touching a user's file reads it whole and shows a diff first.**
  There is no test behind that layer; this is what replaces one.
- **Writes to files shared between sessions are atomic** - temp file, then rename.
  A profile gitconfig can be read by another session mid-write.
- **The hook stays silent when it has nothing to say**, and its `hooks.json`
  invocation exits 0 when Node is missing.
- **The hook stays a plain `.mjs` file with JSDoc types**: the plugin has no build
  step, so a `.ts` hook would not run from the installed plugin.
- No lockfile in the plugin: `tests/plugin-toolchain.test.ts` at the repository
  root enforces it.
- **This plugin assumes no other plugin.** The marketplace schema has no
  dependency field, so a missing prerequisite cannot be declared or detected.

## Commands

From the repository root:

```
pnpm check                                    # lint, format, typecheck (checkJs), tests
claude --plugin-dir <path-to-bdk>/plugins/git-identity    # from a separate test project
```
