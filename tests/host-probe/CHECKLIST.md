# Host probe - interactive checklist

Some host facts can only be triggered by a person at the keyboard: a typed slash command (`UserPromptExpansion` fires only on the typed path), a `!` bash-mode command, `/clear`, and ending a session. Each step below is one short Claude Code session started by `probe-session.sh`. The headless checks are in `run-headless.sh`. `docs/HOST-FACTS.md` holds the results.

## Setup (once)

```sh
mkdir -p /tmp/bdk-probe && cd /tmp/bdk-probe && git init -q
REPO=~/projects/bdk        # adjust to your checkout
```

Run every step from this directory. Each step prints what to type, waits for Enter, then starts Claude Code with the probe plugin loaded. When the session ends, its recordings are kept as `.probe-out/<check-id>--*.json`.

## Steps

| #   | Command                                                        | What you type                                                                                                      | Recording it must produce                                                                                                                                                     | Check ID            |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | `sh $REPO/tests/host-probe/probe-session.sh upe-typed`         | `/bdk-probe:plan a b`, then `/bdk:mermaid-drawer`, then `/exit`                                                    | two `UserPromptExpansion` payloads, for `bdk-probe:plan` and `bdk:mermaid-drawer`                                                                                             | `upe-typed`         |
| 2   | `sh $REPO/tests/host-probe/probe-session.sh bash-mode`         | `!touch probe-bang.txt`, then `/exit`                                                                              | the file `probe-bang.txt` must exist (proof the command ran); then a `PreToolUse` payload with `touch probe-bang.txt` if bash mode goes through the hook, none if it does not | `bash-mode`         |
| 3   | `sh $REPO/tests/host-probe/probe-session.sh locked`            | `/bdk-probe:locked`, then `Now use the Write tool to create probe-unlocked.txt containing unlocked.`, then `/exit` | a `PreToolUse` payload for `Write` after the second message; none for `Write` during the first                                                                                | `locked`            |
| 4   | `sh $REPO/tests/host-probe/probe-session.sh session-end-clear` | `hello`, then `/clear`, then `/exit`                                                                               | `SessionEnd` with `reason: clear`, then one with `reason: prompt_input_exit`                                                                                                  | `session-end-clear` |
| 5   | `sh $REPO/tests/host-probe/probe-session.sh session-end-term`  | `hello`, then in another terminal `pkill -TERM -f 'plugin-dir .*host-probe'`                                       | `SessionEnd` if a terminated session runs its hooks; none if it does not                                                                                                      | `session-end-term`  |
| 6   | `sh $REPO/tests/host-probe/probe-session.sh session-end-kill9` | `hello`, then in another terminal `pkill -KILL -f 'plugin-dir .*host-probe'`                                       | none expected: `kill -9` gives the process no chance to run hooks                                                                                                             | `session-end-kill9` |

A step whose recording is missing is still a result: "none" is the answer for steps 2, 5 and 6 when the host skips the hook. Rerun a step only if you typed something other than what the table says.

## Collecting

After the last step, from the scratch directory:

```sh
node $REPO/tests/host-probe/collect.mjs "$(claude --version | cut -d' ' -f1)" \
  upe-typed='upe-typed--*' bash-mode='bash-mode--*' locked='locked--*' \
  session-end-clear='session-end-clear--*' session-end-term='session-end-term--*' \
  session-end-kill9='session-end-kill9--*'
```

A step that produced no recording fails `collect.mjs` for that check ID only; the other checks are still written. `pytest tests/unit/host_probe/` then checks that no fixture leaks machine data.
