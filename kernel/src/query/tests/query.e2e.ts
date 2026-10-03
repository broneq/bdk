// `bdk query` through the built bundle in a real repository: every exit
// code and declared rule and the output schema.
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answered,
  bdk,
  outsideRepository,
  refused,
  repository,
} from "../../../tests/support/repo.ts";

function opened(): string {
  const root = repository();
  expect(bdk(["change", "new", "Add dark mode"], root).code).toBe(0);
  bdk(["log", "add", "finding", "contrast too low", "--ref", "src/theme.ts"], root);
  bdk(["log", "add", "decision", "Follow the OS setting", "--ref", "design.md"], root);
  return root;
}

describe("bdk query", () => {
  it("exit 0: the example run validates against query.json", () => {
    const root = opened();
    const result = answered(
      bdk(
        ["query", "select type, count(*) from entries group by type order by type", "--json"],
        root,
      ),
      "output/query.json",
    );
    expect(result).toEqual({
      columns: ["type", "count(*)"],
      items: [
        ["assumption", 1],
        ["decision", 1],
        ["finding", 1],
      ],
      total: 3,
      truncated: false,
    });
  });

  it("exit 3 input/invalid-argument: a writing statement leaves the index unchanged", () => {
    const root = opened();
    refused(bdk(["query", "delete from entries", "--json"], root), 3, "input/invalid-argument");
    refused(
      bdk(["query", "with x as (select 1) delete from _entries", "--json"], root),
      3,
      "input/invalid-argument",
    );
    expect(bdk(["query", "select count(*) from entries", "--json"], root).json).toMatchObject({
      items: [[3]],
    });
  });

  it("exit 3 input/invalid-argument: SQLite rejects the statement", () => {
    const why = refused(
      bdk(["query", "select nope from entries", "--json"], opened()),
      3,
      "input/invalid-argument",
    );
    expect(why.why).toContain("no such column");
  });

  it("exit 4 state/corrupted-index: the index path is a directory", () => {
    const root = opened();
    const index = join(root, ".bdk/.machine/index.sqlite");
    rmSync(index, { force: true });
    mkdirSync(index);
    refused(bdk(["query", "select 1", "--json"], root), 4, "state/corrupted-index");
  });

  it("exit 5 runtime/not-a-repo: outside a work tree", () => {
    refused(bdk(["query", "select 1", "--json"], outsideRepository()), 5, "runtime/not-a-repo");
  });
});
