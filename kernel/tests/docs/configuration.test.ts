// `docs-site`, Site describes only shipped mechanisms, scenario "settings
// page": `reference/configuration.md` names every key of the configuration
// registry as a code span, so a key a task registers reaches the site.
import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../src/registrations.ts";
import { registeredLeaves } from "../support/settings-table.ts";
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
