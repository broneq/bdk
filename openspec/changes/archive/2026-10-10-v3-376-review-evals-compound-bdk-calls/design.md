# Design

## Context

See proposal.md, "Why". Reproduced 2026-10-10 on Claude Code 2.1.292, clean `HOME`, the `git` shell prefix of "Host limits", `--allow-tools "Bash(*/bin/bdk *)" "Bash(git *)" --case 'judge-*' --runs 2 -j 5 --ablation none --model sonnet --keep-temp`: every case 1.00 ($1.52), no denied call, but in 4 of 10 runs the judge sent `B="<plugin>/bin/bdk"; L=<log>; "$B" findings level $L ...` as one Bash call, and in others `grep ...; ls ...; "<bdk>" ...` and `cat a; echo ----; cat b`. The variable form is the one denied in the #371 measurement; whether Claude Code allows it depends on how it splits the command, so it is allowed in some runs and denied in others.

A probe (`claude -p --model haiku --permission-mode dontAsk --allowedTools "Bash(*/bin/bdk *)"`, 2 tries per command, `<P>` the plugin root):

| Command | Result |
|---|---|
| `"<P>/bin/bdk" --version` | allowed 2/2 |
| `B="<P>/bin/bdk"; "$B" --version` | allowed 2/2 |
| `cd <S>/probe; B="<P>/bin/bdk"; L=x.jsonl; "$B" findings list $L --level unleveled` | denied 2/2 |
| `"<P>/bin/bdk" findings list $L --level unleveled` | denied 2/2 |
| `cd <S>/probe; "<P>/bin/bdk" --version` (the working directory) | allowed 2/2 |
| `cd /tmp && "<P>/bin/bdk" --version` (another directory) | denied 2/2 |
| `cat x.jsonl; "<P>/bin/bdk" --version` | allowed 2/2 |
| `"<P>/bin/bdk" --version \| head -3` | allowed 2/2 |

So the denial of #376 comes from the shell variable in an argument (`$L`): Claude Code cannot tell what the expanded argument is and denies the call, even with nothing before or after it. A variable that only holds the program (`"$B"`) passes, and so do some compound forms, which is why the same judge text passed in some runs and failed in others. A `cd` to a directory other than the working one is denied without a `Bash(cd *)` rule. The only form allowed in every probe is the `bdk` call alone, with literal arguments.

## Decisions

- **D1. Forbid compound and variable `bdk` calls in the text, do not widen the grant.** As #342 D1: a wider eval grant would hide the problem; a real session runs on the skill's `allowed-tools` and the user's rules. Each `bdk` call is the whole Bash command: nothing before or after it, no `cd`, `;`, `&&`, `|`, `echo` or shell variables, the plugin path and every argument written out. Files are read and listed with Read, Grep and Glob, not `cat`, `ls` or `grep` through Bash (the form `agents/verifier.md` already has).
- **D2. The rule goes into each block's skill text, not one shared line the blocks cite** (the issue's open question). Each block runs alone (`/bdk:judge` typed by a user, or preloaded into its agent through `skills:`), and the skill text is what the model has in context; a shared file it must first Read is a step the model can skip, and the blocks must work alone (CLAUDE.md, "one block, one job"). Four short sentences are cheaper than a cross-file reference that can drift. Alternative rejected: the rule in the three agent files only - `triage` has no agent and a typed block runs without its agent.
- **D3. The `--workdir` form stays the one exception.** `cd <path> && "<bdk>" ...` under `/bdk:pr-review`: both pieces are granted (`Bash(cd *)` is in the skills' `allowed-tools` and the `pr-review-*` grants), and `bdk rules for` needs the checkout as its working directory. A `--cwd` option of the CLI would remove it but is a CLI change no measurement asked for.
- **D4. Inline `bdk ...` mentions get the full path.** Steps that write `bdk findings list <log>` invite a shorthand (`B=...`); every call in the four skills is written as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" ...`.
- **D5. Grader `no-denied-call` on every `judge-*`, `review-group-*`, `review-integration-*` and `triage-*` case**, the regex of `plan-fresh` (#354), so a denial shows directly, not only through a missing `review.md`.
- **D6. The rule names no placeholder command.** A first wording carried the template `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" <command>` and the example `$L`; with it the judge sent a stray no-op Bash call (`"/Users/past/placeholder"`, `"/Users/past/dummy" 2>/dev/null; true`) next to its parallel `bdk findings level` calls in 3 of 15 runs, each denied (`no-denied-call` red, outcome still 1.00); without the example, 1 of 15. The final wording says "as the steps write it, the quoted path and each argument written out" and names no template; with it, 0 of 15. No such stray call appears in any earlier kept transcript.

## Risks / Trade-offs

- [The model still chains a command or adds a stray one] -> the grader shows it in every review block case.
- [`--workdir` still uses `cd <path> &&`] -> granted by the skills' `allowed-tools` and the `pr-review-*` grants; probe: denied without a `Bash(cd *)` rule, so it stays the named exception (D3).

## Measurements

Claude Code 2.1.292, clean `HOME`, the `git` shell prefix of "Host limits", `--ablation none`, `--keep-temp`.

- Before (skills of `staging/v3`): `judge-*` `--runs 2 --model sonnet` 1.00 on every case ($1.52), no denial, but the variable form `B=...; L=...; "$B" ... $L` in 4 of 10 runs (the form denied in the #371 measurement and in the probe).
- After, first wording (D6): `judge-*` `--runs 3 --model sonnet` 1.00 / 0.96 / 0.95 / 0.95 / 1.00, only `no-denied-call` red (stray placeholder calls); second: one case 0.96.
- After, final wording: `judge-*` `--runs 3 -j 5 --model sonnet` 1.00 on every case, `no-denied-call` passing in all 15 runs, no compound or variable `bdk` call ($2.34); `review-*` `--runs 1` 1.00 on all 4 cases ($1.31); `triage-*` `--runs 1` 1.00 on all 4 cases ($1.14).
