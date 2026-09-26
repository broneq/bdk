---
name: docs-sync
description: Keeps the docs/ site true to the code. Use when a change touches what it describes - a skill, agent, hook, settings key, flag, rule or STARTUP_INSTRUCTIONS.md - before a release or PR, and on "are the docs accurate", "update the docs", "sync docs".
model: sonnet
argument-hint: "[docs page, source path, or nothing to audit the branch diff]"
---

# Docs Sync

BDK's documentation site is not narrative - it is a set of factual claims about
this repository. "BDK ships 13 subagents", "`/bdk:cr` takes `--full`",
"`.bdk/plans/<timestamp>-<slug>.md`". Every one of those is a claim that some
file either confirms or refutes, and a claim nobody re-checks quietly turns into
a lie.

Run this even when the user asked only for the code change. Drift is invisible
until a reader trusts a stale page, so a user-facing change is not finished
until the site matches it.

Two things go wrong, and they need different hunting:

- **Drift** - the page disagrees with the code. Found by checking a claim against
  its ground truth.
- **Contradiction** - the page disagrees with _another page_, or with
  `README.md`, or with `STARTUP_INSTRUCTIONS.md`. No single ground-truth check
  catches this, because each copy looks locally plausible. These are the most
  damaging findings, because a reader has no way to tell which copy is the
  correct one.

## Read the map, then read past it

`references/docs-map.md` holds three indexes: source file to endangered pages,
page to its ground truth, and the facts this repo asserts in more than one
place. Read it first - rediscovering which of 23 pages a change touches is
wasted work.

Then treat it as a **starting point and never a boundary**. Measured against an
unaided audit, the failure mode of this skill is not visiting too few pages - it
is asking each page too narrow a question, checking only what the map predicted
and skipping the wrong claim sitting in the next paragraph. So the map lists the
minimum you must verify on a page. It never lists the maximum, and a claim the
map does not mention is exactly as suspect as one it does.

The map is also an artifact you maintain. If this run adds, moves, or retires a
page, or a page starts asserting something new, update the map in the same pass.
A page absent from the map is a page this skill will never audit again.

## 1. Let the machine do the mechanical checks first

```bash
pnpm test:contract          # includes the site guards in kernel/tests/docs/
```

The guards in `kernel/tests/docs/` already enforce five invariants: every
user-invocable skill is in `README.md` and has a `## /bdk:<name>` heading in
`reference/skills.md`; every `agents/*.md` is named in `reference/agents.md`;
the `mkdocs.yml` `nav` lists exactly the pages under `docs/guide/`; every page
opens with the v2 banner; every `hooks/...` path named in prose exists. Run
them, read the failures, and do not re-derive those checks by hand - spending attention
where a test already holds the line is attention not spent on the prose, which
nothing checks.

Until T50 rewrites the site for v3, every page opens with a banner saying it
describes v2. Such a page is behind the code on purpose: report a claim about a
mechanism v3 removed (it must go), and leave v2 behaviour that the banner
covers for T50.

## 2. Scope the audit

| `$ARGUMENTS`                                                        | Scope                                                                                                                                    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A page under `docs/guide/`                                          | Audit that page in full against its ground truth.                                                                                        |
| A source path (`skills/cr/SKILL.md`, `agents/`, `hooks/hooks.json`) | Reverse-map it to pages, then widen by the shared-facts index.                                                                           |
| Empty                                                               | The branch's changes: `git diff --name-only $(git merge-base HEAD main)...HEAD` plus uncommitted files from `git status --porcelain`.    |
| Empty and the branch is clean and equal to `main`                   | Nothing to reverse-map. Sweep the whole site - 23 pages is small, and the reference pages alone are not where the interesting lies live. |

Report the candidate page list before auditing, so the user can see the blast
radius and cut it if it is wider than they want.

### When the change is a rename, grep is the whole job

If the change renames a searchable token - a flag, a settings key, a skill name,
an artifact path - then `grep -rn` over the repo finds every site that mentions
it, mechanically and exhaustively. Do that, fix every hit, and move on quickly.
Reading pages closely adds nothing here, and the budget is better spent on the
claims below that no grep can surface. The one judgement call a rename needs is
telling the renamed thing from a homonym: a settings key and a skill that share
a word must not be renamed together.

## 3. Read each page as a skeptical user

This is where the value is, so lead with open reading rather than with the map's
checklist. For each candidate page: read it, and list every claim a reader could
act on and be wrong about. Then, for each claim, use the map to find where it is
decided, and check it there.

The claim classes that actually drift in this repo:

- **Counts.** "13 subagents", "the four feature flags", "five capabilities".
  Count the files; the sentence is not evidence.
- **Enumerations that must be exhaustive.** A sentence listing the shipped rule
  sets, the injected chains, the hook entries. An enumeration is a count with
  names - check that nothing is missing, not just that what is named exists.
- **Mechanism claims.** _How_ something is enforced, not just that it is:
  "read-only by `disallowed-tools`" versus read-only by a `tools:` allowlist.
  These read fluently while being exactly wrong, and they are what a reader
  copies into their own project.
- **Conditional versus unconditional.** "The architecture review runs at the end
  of a plan" when it actually runs only on certain triggers. Check the skill
  body for the guard.
- **Recommended commands.** A page telling the reader to run something the
  owning skill forbids in that context (`--inline` outside a subagent caller).
- **Frontmatter facts.** `model:`, `argument-hint:`, `user-invocable:`,
  `allowed-tools:`, `disallowed-tools:`.
- **Flags, arguments, artifact paths.** Confirm against the skill body, not its
  description.
- **Quoted error strings.** `troubleshooting.md` quotes messages verbatim. Grep
  the quoted text; a reworded message orphans a whole section.
- **Copied blocks.** The `.gitignore` tracked/untracked block appears in two
  pages. Diff it against the real file.
- **Mermaid node labels**, which drift with renames.

Then run the shared-facts index from the map: for each fact asserted in more
than one place, put the copies side by side and confirm they agree. Copies drift
apart silently, and this pass is the only thing that catches it.

Classify each finding as **stale** (the code refutes the page), **missing** (the
code has something no page mentions), **contradictory** (two places disagree;
say which one you believe and why), or **accurate**. Attach evidence - file and
line - to every non-accurate finding. A finding without evidence is a guess, and
acting on a guess is how correct prose gets "fixed" into wrong prose.

Above roughly four candidate pages, split the work across subagents by section
(entry points, workflows, concepts, reference, troubleshooting). Give each one
the open-reading instruction above, not a checklist - a subagent handed a
checklist returns exactly the checklist and nothing else.

## 4. Confirm before writing

Present the findings as a table - page, claim, classification, evidence - and get
approval with a single `AskUserQuestion` (Approve / Approve with changes /
Cancel). Two reasons this gate is not ceremony: the docs carry editorial
judgement a diff cannot distinguish from drift, and a page can be _intentionally_
ahead of or behind the code during a migration
(every page under the v2 banner is exactly that).

Separate out anything that is not yours to decide, and list it rather than
patching it: a number that disagrees with the code in a way that suggests the
_code_ is wrong, a convention violation in the source, a page whose whole framing
is outdated. Silently making the docs match a bug is worse than leaving the
mismatch visible.

## 5. Apply

- **Minimal diffs.** Change the sentence that is wrong, not the paragraph around
  it. The prose voice here is consistent and hard-won; rewriting accurate text
  produces review noise and buries the real fix.
- **No update markers.** No "updated on", no changelog notes, no diff artifacts.
  The page reads as if it had always been correct.
- **No em dash.** Plain `-`, matching the rest of the site.
- **Fix every copy.** When a corrected fact is in the shared-facts index, fixing
  one copy and leaving the other is how the contradiction was born in the first
  place.
- **New page** - write it, add it to `mkdocs.yml` `nav` in the right section,
  link it from the pages that should point at it, add it to the map.
- **Moved or retired page** - fix `nav`, fix every inbound link (grep the old
  path across `docs/guide/` and `README.md`), update the map.
- **Never hand-edit** `docs/guide/changelog.md` or `docs/guide/contributing/index.md`. They
  are `--8<--` snippet includes; the content lives in `CHANGELOG.md` (which is
  release-please output and off-limits entirely) and `CONTRIBUTING.md`.

## 6. Prove the site still builds

```bash
pnpm docs:build
pnpm test:contract
```

CI runs the build on every pull request, and `--strict` promotes warnings - an orphan page, a broken
snippet path, an unresolvable link - into failures.

Then report: pages changed, claims fixed, contradictions resolved and which copy
you believed, and everything deliberately left alone with the reason. If a
finding needs a decision you could not make, say so plainly rather than leaving
it for the next reader to trip over.
