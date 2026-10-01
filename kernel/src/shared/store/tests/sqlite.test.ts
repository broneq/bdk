// Loading `node:sqlite` without its ExperimentalWarning.
import { describe, expect, it } from "vitest";

import { loadSqlite, withoutSqliteWarning } from "../sqlite.ts";

describe("loadSqlite", () => {
  it("loads the module and restores process.emitWarning", async () => {
    const before: unknown = Reflect.get(process, "emitWarning");
    expect(typeof (await loadSqlite()).DatabaseSync).toBe("function");
    expect(Reflect.get(process, "emitWarning")).toBe(before);
  });

  it("drops only the SQLite ExperimentalWarning", () => {
    const passed: unknown[] = [];
    const emit = withoutSqliteWarning((warning) => passed.push(warning));
    emit("SQLite is an experimental feature", "ExperimentalWarning");
    emit(new Error("SQLite is an experimental feature"), { type: "ExperimentalWarning" });
    emit("Fetch is an experimental feature", "ExperimentalWarning");
    emit("SQLite leaks", { type: "DeprecationWarning" });
    emit("plain");
    expect(passed).toEqual(["Fetch is an experimental feature", "SQLite leaks", "plain"]);
  });
});
