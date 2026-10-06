// `docs-site`, Site describes only shipped mechanisms, scenario "settings
// page": `reference/configuration.md` names every key of the configuration
// registry as a code span, so a key a task registers reaches the site; and
// `docs-site`, Settings page states setup coverage: each key's row carries
// its setup class in a `Setup` column.
import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../src/registrations.ts";
import { registeredLeaves } from "../support/settings-table.ts";
import { backticked, column, tableRows } from "../support/specs.ts";
import { readPage } from "./site.ts";

const PAGE = "reference/configuration.md";

describe(`${PAGE} names every registered key`, () => {
  const keys = registeredLeaves(settingsRegistry()).map((leaf) => leaf.key);

  it("reads the registry", () => {
    expect(keys.length).toBeGreaterThan(30);
  });

  it("names each one", () => {
    const page = readPage(PAGE);
    expect(keys.filter((key) => !page.includes(`\`${key}\``))).toStrictEqual([]);
  });
});

describe(`${PAGE} states each key's setup class`, () => {
  it.each(
    settingsRegistry()
      .setupKeys()
      .map((entry) => [entry.key, entry.setup] as const),
  )("%s is %s", (key, setup) => {
    const row = tableRows(readPage(PAGE), "Key").find(
      (candidate) => backticked(column(candidate, "Key"))[0] === key,
    );
    expect(row, `no row for ${key}`).toBeDefined();
    if (row === undefined) return;
    expect(backticked(column(row, "Setup"))[0]).toBe(setup);
  });
});
