// `bdk query` through the real registry on an in-memory repository and index
// (`kernel-cli/query`).
import { describe, expect, it } from "vitest";

import {
  AUTHOR,
  CHANGE,
  DIR,
  fakeGit,
  repository,
  ROOT,
  runBdk,
  writeChangeDoc,
} from "../../log/tests/support.ts";
import { memoryIndex, writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { statementProblem } from "../domain/query.ts";
import { queryRegistrations } from "../index.ts";
import { queryOutput } from "../schema/query.ts";

function run(store: Store, argv: readonly string[]) {
  return runBdk(queryRegistrations({ store, openIndex: memoryIndex }), store, fakeGit(), argv);
}

function writeFinding(store: Store, dir: string, n: number): void {
  const id = `L-${String(n).padStart(8, "0")}`;
  writeDocument(store, `${dir}/log/20260925T100000Z-finding-${id}.md`, {
    data: {
      schema: 1,
      id,
      type: "finding",
      summary: `finding ${String(n)}`,
      status: "proposed",
      source: "kernel",
      author: AUTHOR,
      at: "2026-09-25T10:00:00Z",
      refs: ["src/a.ts"],
    },
    body: "",
  });
}

describe("statementProblem", () => {
  it.each([
    "select 1",
    "SELECT 1;",
    "  -- the count\n select count(*) from entries ;  ",
    "/* one */ with x as (select 1) select * from x",
    "select ';' as semicolon, \"a;b\" from entries",
    "select 1; -- trailing comment",
  ])("accepts %j", (sql) => {
    expect(statementProblem(sql)).toBeUndefined();
  });

  it.each([
    ["", "the statement is empty"],
    [" ; -- nothing", "the statement is empty"],
    ["select 1; select 2", "only a single statement is accepted; 2 were given"],
    ["delete from entries", "only a single SELECT is accepted; the statement starts with DELETE"],
    ["pragma query_only = off", "starts with PRAGMA"],
    ["select 1; drop table changes", "only a single statement is accepted"],
  ])("refuses %j", (sql, why) => {
    expect(statementProblem(sql)).toContain(why);
  });
});

describe("bdk query", () => {
  it("answers columns and rows in column order", async () => {
    const store = repository();
    writeFinding(store, DIR, 1);
    writeFinding(store, DIR, 2);

    const result = await run(store, [
      "query",
      "select type, count(*) from entries group by type",
      "--json",
    ]);

    expect(result.code).toBe(0);
    expect(queryOutput.parse(result.json)).toEqual({
      columns: ["type", "count(*)"],
      items: [["finding", 2]],
      total: 1,
      truncated: false,
    });
  });

  it("renders a tab-separated table", async () => {
    const store = repository();
    writeFinding(store, DIR, 1);

    const result = await run(store, ["query", "select id, summary from entries"]);

    expect(result.stdout).toBe("id\tsummary\nL-00000001\tfinding 1\n");
  });

  it("refreshes every Change, archived ones included", async () => {
    const store = repository();
    const archived = "2026-09-20-old-work";
    const archivedDir = `${ROOT}/.bdk/changes/archive/${archived}`;
    writeChangeDoc(store, archived, archivedDir);
    writeFinding(store, archivedDir, 7);

    const result = await run(store, [
      "query",
      "select id, archived from changes order by id",
      "--json",
    ]);

    expect(result.json).toMatchObject({
      items: [
        [archived, 1],
        [CHANGE, 0],
      ],
    });
  });

  it("caps the page at 100 rows unless --all", async () => {
    const store = repository();
    for (let n = 1; n <= 120; n++) writeFinding(store, DIR, n);

    const page = await run(store, ["query", "select id from entries", "--json"]);
    expect(page.json).toMatchObject({ total: 120, truncated: true });
    expect((page.json as { items: unknown[] }).items).toHaveLength(100);

    const all = await run(store, ["query", "select id from entries", "--all", "--json"]);
    expect(all.json).toMatchObject({ total: 120, truncated: false });
    expect((all.json as { items: unknown[] }).items).toHaveLength(120);
  });

  it.each([
    ["delete from entries", "starts with DELETE"],
    ["select 1; select 2", "only a single statement"],
    ["with gone as (select 1) delete from _entries", "SQLite rejected the statement"],
    ["select nope from entries", "SQLite rejected the statement: no such column: nope"],
  ])("refuses %j as input/invalid-argument", async (sql, why) => {
    const store = repository();
    writeFinding(store, DIR, 1);

    const result = await run(store, ["query", sql, "--json"]);

    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({
      rule: "input/invalid-argument",
      why: expect.stringContaining(why) as string,
    });
  });
});
