# Design

## Context

#376 made every `bdk` call of the review blocks the whole Bash command. The failing run of #395 kept no trace, and 112 more runs did not show a denial, so the cause is found by probing the permission layer, not by a trace.

## Decisions

### D1: The cause is substitution inside the quoted argument

The probe (`claude -p --allowedTools 'Bash(*/bin/bdk *)'`, clean `HOME`) denies a call whose quoted text holds a backtick pair or `$(...)`/`$5`, and passes parentheses, angle brackets and apostrophes. A skill-text gap, not a host limit: the model controls the text. It is the only denial mode left once the call is the whole command. The judge's `--reason` is the free text most likely to echo a backticked code quote from the evidence it reads; the observed rate is low (0 in 164 reasons), which fits 1 failing run in about 8 early on.

Not proven to be the original run's denial (no trace). The Change keeps `no-denied-call` in the cases, so a different denial still shows.

### D2: One sentence in each of the four blocks, not a CLI change

The four blocks pass free text through `bdk findings add|level|decide`. The rule goes in the sentence that already states the whole-command rule. A CLI helper (a `--reason-file`) would be machinery for a problem one sentence fixes (CLAUDE.md "Building skills").

### D3: Make the eval tempt the failure

`judge-previous-repeat` quotes code in backticks in both findings' evidence, so a judge that copies quoting is denied. Measured before the skill change: still 0 denials in 30 runs, so the case stays a guard, not a reproduction; the claim of 10 of 10 is met by it and by the probe.

## Measurements

See `plugins/bdk/evals/README.md` (recorded 2026-10-10).
