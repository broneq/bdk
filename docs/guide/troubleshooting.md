# Troubleshooting

::: warning Describes BDK v2
This page describes BDK v2. The v3 documentation replaces it (T50).
:::

Symptom, cause, and fix for the messages BDK can actually show you, grouped by the hook or script that prints them. Message text is quoted verbatim from source.

## A project tool reports files under `.bdk/`

**Symptom:** your linter or formatter reports `.bdk/changes/...` or `.bdk/specs/...`, an agent logs a `question` naming `/bdk:setup`, or a finished Change shows a step as `stale` with "inputs changed" after a formatter run.

**Cause:** the tool reads the whole tree, and `.bdk/` is not in its ignore list. The files are committed, so `.gitignore` never covers them.

**Fix:** run `/bdk:setup` and accept the exclusions it proposes. When a formatter already rewrote `.bdk/` files and you have not committed them, restore them with `git restore .bdk/`; for a living spec already committed, `bdk doctor` prints the restore command.

## BDK files ignored by git

**Symptom (`bdk doctor`):**

```
fail bdk-ignored: .gitignore ignores .bdk/settings.yaml with /.bdk/ (line 2), so the files BDK commits never reach git
  repair: /bdk:setup
```

**Cause:** BDK 2 wrote `/.bdk/` into `.gitignore`. BDK 3 commits `.bdk/settings.yaml`, `.bdk/rules/` and the Changes, and that rule keeps all of them out of git, so the team never sees them.

**Fix:** run `/bdk:setup`. It shows the rule, replaces it after you confirm with the two paths BDK 3 keeps out of git (`/.bdk/.machine/`, `/.bdk/settings.local.yaml`), and commits `.gitignore` on its own. See [Artifacts](reference/artifacts.md#the-bdk-2-ignore-rule).

## Skill dependency missing

**Symptom (session content, exit code 0):**

```
[BDK] skill <name> is not installed; the skill that needs it falls back to its own behaviour.
```

**Cause:** `bdk hooks skill-exists <name>` runs from a skill's own `UserPromptSubmit` frontmatter hook, when that skill needs another skill to be installed. No BDK skill declares one today; a project or a plugin skill may. No `SKILL.md` under `~/.claude/skills/`, `.claude/skills/`, a plugin marketplace or an installed plugin version declares that `name:` in its frontmatter. See [Hooks reference](reference/hooks.md).

**Fix:** Install the plugin that provides the missing skill, or remove the hook from the skill that declares it.

## Guard blocked a tool call or a stage command

**Symptom (the model's tool call is denied):**

```
guard/<rule>: <reason>
```

**Cause:** the `PreToolUse` hook denied the call; the rules are listed in the [Hooks reference](reference/hooks.md#pretooluse). The reason names what to do instead, for example a subagent returns blocked rather than running `git stash`.

**Fix:** None for the guard itself: the model follows the reason. Run the denied command yourself if you want it.

**Symptom (typing a stage command is blocked):**

```
policy/gate-not-ready: gate:design is not ready for /bdk:plan: architecture is ready
```

**Cause:** the `UserPromptExpansion` hook checks the gate before the stage it opens. Each named requirement must be done first.

**Fix:** Finish the named artifacts (`bdk next` prints the instruction), then type the command again.

**Symptom (a skill stops at its first line):**

```
BDK STOP: kernel unavailable (exit 5). Install Node >= 22.13 and run /bdk:setup.
```

**Cause:** the skill's context line runs `bdk ctx skill <name>` and it failed. Exit 5: the plugin's `bin/bdk` found no `node` on `PATH` or no `dist/bdk.mjs`, and the `bdk: kernel unavailable: ...` line above says which. Exit 127: no `bdk` on the Bash tool's `PATH`, so the plugin is disabled or the host does not install its `bin/`. Another code: an executable named `bdk` earlier on your `PATH` than the plugin's `bin/` ran instead.

**Fix:** Install Node >= 22.13, reinstall the BDK plugin when a file is missing, or rename the other `bdk` executable. Run `bdk --version` in a `!` command to see which one answers.

**Symptom (every guarded call is blocked):**

```
guard/kernel-unavailable: node is not on PATH, so BDK cannot check this tool call; install Node >= 22.13 and run /bdk:setup
```

or the same rule naming a missing `dist/bdk.mjs` or guard script.

**Cause:** the guard hooks fail closed. Without Node or the kernel bundle they cannot decide, so they block every call the prefilter keeps and every stage command.

**Fix:** Install Node >= 22.13, or reinstall the BDK plugin when a file is missing.
