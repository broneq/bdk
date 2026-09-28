## Context

The kernel has one time source, `shared/clock` (`kernel-architecture`, shared entry (a)), which cuts `Date.toISOString()` to the second, and one schema for time, `timestamp` in `shared/store/state/common.ts` (`precision: 0`). Every document kind uses that schema. The kernel orders by comparing the strings: `derived.ts` (latest transition, parked question), `graph/domain/engine.ts` (latest done marker), `graph/domain/gate.ts` (ready time), and the index (`ORDER BY e.at, e.id`, `ORDER BY opened_at, ticket`). Two records of one second tie, and the tie falls to the random id. v3 is not released, so no user project holds v3 state yet; this repository's tests and fixtures do.

## Goals / Non-Goals

**Goals:**

- Two records written by separate kernel commands never tie on `at`.
- Every existing comparison stays a plain string comparison.
- Files with second-precision times, hand-written or older, stay valid and order correctly among new ones.

**Non-Goals:**

- A total order within one millisecond; the existing tie rules keep covering it.
- Git commit times (`shared/git`), which git keeps to the second.
- Removing the existing tie rules or the ladder's ticket naming (`kernel-loops`).

## Decisions

**MS-1 Milliseconds at a fixed width.** The clock writes `YYYY-MM-DDTHH:MM:SS.mmmZ`. A fixed width keeps lexicographic order equal to time order, so no comparison site changes. Alternatives: a logical counter per Change (a sequence number in each record) - rejected: it needs a shared counter across branches and processes, which the file-per-entry ledger avoids (K4); microseconds - rejected: `Date` has millisecond resolution, and separate kernel processes are always more than a millisecond apart.

**MS-2 Normalise on read.** The `timestamp` schema accepts both forms and transforms the second form to `.000`, so every value in memory and in the index has one width. Alternatives: accept only milliseconds - rejected: a hand-written transition or a fixture with seconds would become `state/ledger-invalid` for no gain; accept both without normalising - rejected: `...:07Z` sorts after `...:07.500Z` as a string (`Z` > `.`), which would reintroduce wrong orders silently. A write validates the same schema, so a caller's second-form value is written normalised.

**MS-3 Entry file names keep the second.** `log/<yyyymmddThhmmssZ>-<type>-<id>.md` stays as it is; the file name check compares with `at` truncated to the second. Alternative: put milliseconds into the name - rejected: it changes every entry path pattern for no ordering benefit, since order comes from `at` and ids keep names unique.

**MS-4 The gate compares at one-second resolution.** The gate asks "was the approval given after the gate became ready", and a user may write a transition by hand with seconds only. Truncating both sides keeps today's "the same second counts" rule. Alternative: compare milliseconds - rejected: a hand-written transition of the ready second would be refused although the user approved after the ready state they saw.

**MS-5 Index schema version 4.** The index stores `at` as text; bumping the version drops and rebuilds every index, so no index holds a mix of widths.

**MS-6 Output schemas.** The state JSON Schemas describe committed files, so their `timestamp` takes both forms: the generator exports the zod output type, which is the millisecond form, so the `timestamp` metadata carries the pattern of both forms. The CLI output schemas describe the millisecond form (`precision: 3`). The hand-written output examples change to milliseconds.

## Risks / Trade-offs

- [Two writes of one process in one millisecond still tie] - The existing tie rules stay (stage order then id; fresh evidence first in T23 part C).
- [Tests compare exact `at` strings] - Tests use `fixedClock`, which formats with milliseconds; literal fixtures with seconds keep testing the read path.
- [T23 part C was written against seconds] - Part C rebases onto this Change; its same-second notes and its acceptance test's tie comment are removed there.

## Migration Plan

No data migration: second-form files read unchanged, and the index rebuilds on the version change. Rollback is a revert; files written with milliseconds would then fail the old `precision: 0` schema, which is acceptable before the 3.0 release.
