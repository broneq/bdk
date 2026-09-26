// `kernel-settings`, Registry and consumers: the key tables of the spec and
// the registry agree (design D-3 of v3-t12-layered-config). A registered leaf
// has a row with the same type, default, owner and consumer; a row that is
// not registered is a planned key of the same owner; the removed v2 keys and
// the prompt keys match their tables.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../src/registrations.ts";
import { PLANNED_KEYS, REMOVED_KEYS } from "../../src/shared/config/index.ts";
import { REPO_ROOT } from "../support/run.ts";
import { registeredLeaves } from "../support/settings-table.ts";
import type { RegisteredLeaf } from "../support/settings-table.ts";
import { backticked, column, tableRows } from "../support/specs.ts";

const spec = readFileSync(join(REPO_ROOT, "openspec/specs/kernel-settings/spec.md"), "utf8");

/** A default cell: its code span when it is one, else the cell text. */
function defaultOf(cell: string): string {
  const spans = backticked(cell);
  return spans.length === 1 && cell === `\`${spans[0] ?? ""}\`` ? (spans[0] ?? "") : cell;
}

const settings = settingsRegistry();
const keyRows = tableRows(spec, "Key");
const tableKeys = new Map(keyRows.map((row) => [backticked(column(row, "Key"))[0] ?? "", row]));

describe("key tables", () => {
  it("are found", () => {
    expect(tableKeys.size).toBeGreaterThan(30);
  });

  it.each(registeredLeaves(settings).map((leaf) => [leaf.key, leaf] as const))(
    "hold the registered key %s as the registry declares it",
    (key, leaf: RegisteredLeaf) => {
      const row = tableKeys.get(key);
      expect(row, `no row for ${key}`).toBeDefined();
      if (row === undefined) return;
      expect({
        key,
        type: column(row, "Type"),
        default: defaultOf(column(row, "Default")),
        owner: column(row, "Owner"),
        consumer: backticked(column(row, "Consumer")).join(", "),
      }).toStrictEqual({ ...leaf });
    },
  );

  it("hold every planned key with its owner, and nothing else unregistered", () => {
    const registered = new Set(registeredLeaves(settings).map((leaf) => leaf.key));
    const unregistered = [...tableKeys]
      .filter(([key]) => !registered.has(key))
      .map(([key, row]) => ({ key, owner: column(row, "Owner") }));
    expect(unregistered).toStrictEqual(PLANNED_KEYS.map((entry) => ({ ...entry })));
  });
});

describe("removed v2 keys", () => {
  it("equal the table", () => {
    const table = tableRows(spec, "v2 key").map((row) => backticked(column(row, "v2 key"))[0]);
    expect(table).toStrictEqual(REMOVED_KEYS.map((entry) => entry.key));
  });
});

describe("prompt keys", () => {
  it("equal the table with default file, owner and consumer", () => {
    const table = tableRows(spec, "Prompt key").map((row) => ({
      key: backticked(column(row, "Prompt key"))[0],
      defaultFile: backticked(column(row, "Default file (plugin)"))[0],
      owner: column(row, "Owner"),
      consumer: backticked(column(row, "Consumer")).join(", "),
    }));
    expect(table).toStrictEqual(
      settings.prompts.map((prompt) => ({
        key: prompt.key,
        defaultFile: prompt.defaultFile?.replace("{name}", "<name>"),
        owner: prompt.owner,
        consumer: prompt.consumer,
      })),
    );
  });
});
