# Design

## Context

Issue #281 asks that every new issue gets a deliberate dependency check at creation, recorded as GitHub "blocked by" relations or an explicit "none", with working commands in the **Create** step. The commands were tried on 2026-10-09 with gh 2.101.0 against `broneq/bdk`: `gh issue edit 281 --add-blocked-by 252 --add-blocking 263`, read back with `gh issue view 281 --json blockedBy,blocking` (and `gh issue view 263` showed #281 among its blockers, so one relation shows on both issues), then removed with `--remove-blocked-by 252 --remove-blocking 263`, leaving both issues as they were.

## Decisions

### D1 - Use the native `gh issue` flags, not raw API calls

`gh issue create --blocked-by/--blocking`, `gh issue edit --add-blocked-by/--add-blocking/--remove-blocked-by/--remove-blocking` and `gh issue view --json blockedBy,blocking` take issue numbers and read like the rest of the Create step.

Alternatives:
- REST `gh api repos/broneq/bdk/issues/N/dependencies/blocked_by` (GET, `POST -F issue_id=<database id>`, `DELETE .../<database id>`). Also tested and works, but needs the database id of the blocker (`gh api repos/broneq/bdk/issues/B --jq .id`), one more call per link. Kept here as the fallback for a gh older than the flags.
- GraphQL `addBlockedBy` with node ids: two lookups per link and a long query in a markdown step. Lost on length.

The tested gh version (2.101.0) is named in the step so a failing older gh is explained.

### D2 - One relation per dependency, set from either side

A GitHub "blocked by" relation is one edge that shows on both issues (#263 listed #281 as a blocker after `--add-blocking 263` on #281). "Both directions" in #281 therefore means: the new issue's blockers go in `--blocked-by`, and the existing issues the new one blocks go in `--blocking`; no second call on the other issue is needed. The step says so, so nobody adds the edge twice.

### D3 - "None." is written, never implied

The `Dependencies` section is always present. With no dependency it holds `None.`, the form #281 itself uses. A missing section is indistinguishable from a skipped analysis; an explicit `None.` is not.

### D4 - What the analysis reads

Open issues of the milestone and the last closed ones (`gh issue list --milestone v3.0 --state open` and `--state closed -L 30`), looking for: work the new issue needs merged first, an open issue that changes the same files or specs in a conflicting way, and open issues the new one must land before. A closed blocker is not linked (it no longer gates **Pick**) but may be named in the body as input. Alternative: a script that greps bodies for file paths; rejected by the global rule for infrequent operational work (direct path first, no automation without a concrete need).

### D5 - Pick reads open blockers with one command

`gh issue view N --json blockedBy --jq '[.blockedBy.nodes[] | select(.state=="OPEN") | .number]'` prints `[]` for a pickable issue. This keeps Pick consistent with Create without changing its rule.

### D6 - Where else the rule lives

`openspec/config.yaml` context describes the issue format and now says the `Dependencies` section holds the links or `None.`. `CONTRIBUTING.md` defers to the SDLC in `CLAUDE.md` and needs nothing; `docs/guide/` and `docs/concepts/` describe BDK for its users, not how this repository files issues, so no page changes.

## Risks

- A gh older than the flags fails with "unknown flag". Mitigation: the step names the tested version and the REST fallback is recorded in D1.
