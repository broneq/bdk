import { describe, expect, it } from "vitest";

import { memoryStore } from "../../store.ts";
import { readDocument } from "../documents.ts";
import { entryPath, writeEntry } from "../ledger.ts";

const DIR = "/repo/.bdk/changes/2026-09-25-add-login";

function draft(id: string) {
  return {
    schema: 1,
    id,
    type: "finding",
    summary: "expired link accepted",
    status: "proposed",
    source: "kernel",
    author: "Ada <ada@example.com>",
    at: "2026-09-25T10:15:02.000Z",
    refs: ["src/a.ts"],
  };
}

/** A random source that yields the digits of `ids` one after the other. */
function sequence(...ids: string[]): () => number {
  const digits = ids.flatMap((id) =>
    (id.slice(2).match(/./g) ?? []).map((c) => parseInt(c, 36) / 36 + 0.001),
  );
  return () => digits.shift() ?? 0;
}

describe("entryPath", () => {
  it("is log/<ts>-<type>-<id>.md", () => {
    expect(entryPath(DIR, draft("L-e8k2s5vw"))).toBe(
      `${DIR}/log/20260925T101502Z-finding-L-e8k2s5vw.md`,
    );
  });

  it("keeps the second of an at with milliseconds", () => {
    expect(entryPath(DIR, { ...draft("L-e8k2s5vw"), at: "2026-09-25T10:15:02.345Z" })).toBe(
      `${DIR}/log/20260925T101502Z-finding-L-e8k2s5vw.md`,
    );
  });
});

describe("writeEntry", () => {
  it("writes a validated entry with a fresh id", () => {
    const store = memoryStore();
    const written = writeEntry(store, DIR, draft, "body\n", sequence("L-aaaaaaaa"));
    expect(written.id).toBe("L-aaaaaaaa");
    const document = readDocument(store, written.path);
    expect(document).toMatchObject({ kind: "entry", body: "body\n" });
  });

  it("draws another id when the first exists in log/", () => {
    const store = memoryStore({
      [`${DIR}/log/20260101T000000Z-risk-L-aaaaaaaa.md`]: "x",
    });
    const written = writeEntry(store, DIR, draft, "", sequence("L-aaaaaaaa", "L-bbbbbbbb"));
    expect(written.id).toBe("L-bbbbbbbb");
  });

  it("refuses an invalid entry and writes nothing", () => {
    const store = memoryStore();
    expect(() => writeEntry(store, DIR, (id) => ({ ...draft(id), summary: "" }), "")).toThrow(
      /summary/,
    );
    expect(store.list(`${DIR}/log`)).toStrictEqual([]);
  });
});
