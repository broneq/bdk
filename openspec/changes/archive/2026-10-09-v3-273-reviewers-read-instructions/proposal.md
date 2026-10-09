# Proposal

## Why

Tracks #273.

The judge levels a finding `should-fix` when "the change breaks a rule or a project instruction", but no reviewer reads the project instructions. `implement-part` and `conform-part` read `CLAUDE.md`, `AGENTS.md` and `.claude/rules/*.md` on the way to the files they change; `review-group` reads only the BDK rules `bdk rules for --stage review` prints, and `judge` reads only those rules too. A reviewer cannot report an instruction it never read, and the judge cannot check one it never read, so a project convention that is not also a BDK rule passes every review round unseen. Found while writing `docs/concepts/stages.md` for #268.

## What Changes

- `review-group` reads the project instructions on the way to each file of its group (the same set `conform-part` step 3 reads: `CLAUDE.md` and `AGENTS.md` in the project root and in each directory on the way to the file, and each `.claude/rules/*.md` whose `paths` match it), under `--workdir` when given, and reports a changed line that breaks one.
- A finding that breaks an instruction cites it with `--rule <instruction file>`, the path of the instruction file relative to the project root (`CLAUDE.md`, `src/AGENTS.md`, `.claude/rules/testing.md`), and quotes the instruction in its evidence. No CLI change: `--rule` already takes any text and keys the dedupe on it.
- `judge` reads the instruction file a finding cites, checks that the quoted instruction is there and applies to the finding's file, and levels a broken instruction `should-fix` at most, as it does a rule; an instruction that is not there or does not apply makes the finding `not-a-problem`.
- `review-integration` does not read the instructions: an instruction binds the lines of a file, and every changed file is in a group whose reviewer reads them (design D4).
- Two eval cases on a new fixture whose `CLAUDE.md` holds an instruction part 01 breaks: `review-group-instruction` (the finding cites `CLAUDE.md`) and `judge-instruction` (the real violation `should-fix`, a citation of an instruction the file does not hold `not-a-problem`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-blocks`: `review-group` and `judge` read the project instructions; a finding may cite an instruction file with `--rule`; two new eval cases.

## Impact

- `plugins/bdk/skills/review-group/SKILL.md`, `plugins/bdk/skills/judge/SKILL.md`.
- `plugins/bdk/evals/`: fixture `monthly-report-instructions.sh`, cases `review-group-instruction` and `judge-instruction`, README.
- User docs: `docs/concepts/stages.md` (review table), `docs/concepts/rules.md` (the instructions paragraph and the review roles), `docs/concepts/findings.md` (what a finding cites); Reference regenerated with `pnpm docs:reference`.
- Out of scope: model and effort per role (#274, #278), scoped checks (#275), `--verify` delta reviews (#280), rules for the design and plan stages (#272).
