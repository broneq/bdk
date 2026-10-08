#!/usr/bin/env bash
# The B1-sized Change add-household-book, design approved, no plan, with one product choice
# open: recurring days run from 1 to 31, and nothing says what an entry does in a month without
# its day. Folded into the fixture's last commit. See ../README.md, "B1-sized fixture".
set -euo pipefail
bash "$(dirname "$0")/../fixtures/household-book.sh"

# Each replacement must find its text exactly once, so a changed fixture fails here instead of
# building a variant without the gap.
node - <<'JS'
import { readFileSync, writeFileSync } from "node:fs";

const change = "openspec/changes/add-household-book";
const runs = ".bdk/runs/add-household-book/design";
const edits = [
  [`${change}/specs/ledger-recurring/spec.md`, "whole number from 1 to 28, otherwise it SHALL print `ledger: day must be 1 to 28`", "whole number from 1 to 31, otherwise it SHALL print `ledger: day must be 1 to 31`"],
  [`${change}/specs/ledger-recurring/spec.md`, "`ledger recurring add -900 Rent --day 31` runs\n- **THEN** it prints `ledger: day must be 1 to 28`", "`ledger recurring add -900 Rent --day 32` runs\n- **THEN** it prints `ledger: day must be 1 to 31`"],
  [`${change}/design.md`, " The days 29-31 are refused, so every month has the due day. The day check (`day must be 1 to 28`)", " The day check (`day must be 1 to 31`)"],
  [`${change}/design.md`, " Alternative: clamp to the month's last day - lost, a rule that moves between days is harder to explain and to test.", ""],
  [`${runs}/verify-1.md`, "`day must be 1 to 28`", "`day must be 1 to 31`"],
  [`${runs}/verify-2.md`, "`day must be 1 to 28`", "`day must be 1 to 31`"],
  [`${runs}/verify-3.md`, "`ledger recurring add -900 Rent --day 31`", "`ledger recurring add -900 Rent --day 32`"],
];
for (const [path, from, to] of edits) {
  const text = readFileSync(path, "utf8");
  if (text.split(from).length !== 2) throw new Error(`${path}: expected one ${JSON.stringify(from)}`);
  writeFileSync(path, text.replace(from, to));
}
JS

export GIT_AUTHOR_DATE="2026-10-01T10:00:00Z" GIT_COMMITTER_DATE="2026-10-01T10:00:00Z"
git add -A
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet --amend --no-edit
