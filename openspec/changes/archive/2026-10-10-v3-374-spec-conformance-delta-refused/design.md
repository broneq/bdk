## Context

See proposal.md - Why. `spec-conformance` (spec `bdk-spec-conformance`) lists six `Must address` problems, all comparing the deltas with the product. Whether a delta is one OpenSpec accepts at all was nobody's check: `/bdk:close` learned it only from `openspec archive`, or from a verifier that ran `openspec validate` on its own initiative and filed the error where it saw fit. #265 design D1 makes the round check the same check close runs; D5 places each round finding where its fix goes. The `bdk:verifier` agent may run commands that only read.

## Goals / Non-Goals

**Goals:**
- A round and close judge a refused delta alike: `Must address`, `Verdict: FAIL`.
- The round's finding lands on the delta and is levelled `blocker`, so the round fixes it.

**Non-Goals:**
- How `plan-fixes` writes a requirement (#373).
- The order of the round's workers (#370).
- A check of the delta's structure by reading it: OpenSpec owns its rules.

## Decisions

### D1. The validation is a step of `spec-conformance`, not a check item of the round

The block runs `openspec validate <change> --strict` itself, in both modes.

- Alternative: a `tools.checks` item or a fixed step of `review-round` (`bdk check run --at review`). Lost: close would then need its own copy, the two could drift again (the cause of #374), and a red check is levelled by the check source, placed on no requirement. The spec check already owns "archive can merge these deltas into true main specs"; whether archive can merge them at all belongs to the same question.
- Alternative: leave the validation to `openspec archive` in close. Lost: that is the stop #368 measured.

### D2. Its place: first check of step 3, one `Must address` item per error, a `Checked` line when clean

It runs before the scenarios are traced: it costs about a second and its errors name requirements the trace then reads. Each error line is one item (`Delta OpenSpec refuses`, problem 7), naming the delta file and the requirement the error names, with the command and the error line as `Evidence:`. A clean run adds `openspec validate <change> --strict: valid` to `Checked`, so a reader sees the verdict covers it.

- Alternative: one item for the whole validation. Lost: two errors on two requirements need two fixes in two places, and the fix planner plans per finding.
- Alternative: run it only when a delta changed since the last round. Lost: saves a second, adds a decision the verifier can get wrong.

### D3. A command that does not run is an environment problem, not a refused delta

When `openspec validate` cannot run (not installed, denied), the verifier agent's rule applies: no `Must address` item; a denied command returns the denial instead of a verdict. A BDK project has the OpenSpec CLI (`/bdk:setup` installs it) and close needs it for `openspec archive`, so a missing CLI is not a case to design around. The skill's `allowed-tools` gains `Bash(openspec validate *)` so the run is not denied.

### D4. The round finding goes on the delta, at the requirement the error names

The fix is always a delta edit: adding a scenario, fixing a heading. D5 of #265 already sends "the delta misses what the design settles" to the delta; a refused delta is the same placement. Line: the requirement's heading; when the error names no requirement, the delta's first `## ... Requirements` heading.

### D5. The judge levels it `blocker`; its text needs no change

`judge` levels a holding `spec-conformance` finding `blocker` when "the spec deltas would not describe the product after archive". A refused delta has no spec-versus-product disagreement (in #368 the product did what the scenario-less requirement said), so the risk was that it falls to `nice-to-have` or `not-a-problem`. Measured before any change: `judge-delta-refused` on the judge of `staging/v3` scored 1.00 in 3 of 3 runs, the finding levelled `blocker`. Per the repository rule (a skill change only for a measured problem), `plugins/bdk/skills/judge/SKILL.md` stays as it is; the spec `review-blocks` states the behaviour and the case guards it.

- Alternative: add a sentence for refused deltas to the judge anyway. Lost: no measured problem; text that changes no outcome is cost in every judge run.
- Alternative: let the judge run `openspec validate` too. Lost: reading the requirement is enough to see the defect OpenSpec reports.

### D6. Evidence: two block cases on a new fixture

`tally-delta-refused` reproduces #368 in the tally fixture: a requirement without a scenario whose behaviour the product has, so the only problem is the refused delta. `spec-conformance-delta-refused` grades the round's verdict and the finding on the delta; `judge-delta-refused` grades `blocker`. A separate fixture keeps the existing `tally-ledger-path` cases unchanged (their deltas validate).

## Risks / Trade-offs

- [The verifier treats a validation error about the proposal, not a delta, as a delta item] → the item names the file the error names; archive refuses either way, so `Must address` is right in both.
- [OpenSpec changes its error wording] → the skill keys on the command's exit and its error lines, not on a message text.
