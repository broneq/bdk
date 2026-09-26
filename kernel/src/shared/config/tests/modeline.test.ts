import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../../registrations.ts";
import {
  modeline,
  modelineUrl,
  offlineSchemaText,
  settingsJsonSchema,
  settingsSchemaUrl,
  withModeline,
} from "../index.ts";

const LINE =
  "# yaml-language-server: $schema=https://raw.githubusercontent.com/broneq/bdk/v3.0.0/schema/settings.json";

describe("modeline", () => {
  it("points at the settings schema of the plugin version's tag", () => {
    expect(settingsSchemaUrl("3.0.0")).toBe(
      "https://raw.githubusercontent.com/broneq/bdk/v3.0.0/schema/settings.json",
    );
    expect(modeline("3.0.0")).toBe(LINE);
  });

  it("reads the URL of the first line only", () => {
    expect(modelineUrl(`${LINE}\nlanguages: []\n`)).toBe(settingsSchemaUrl("3.0.0"));
    expect(modelineUrl(`languages: []\n${LINE}\n`)).toBeUndefined();
    expect(modelineUrl("")).toBeUndefined();
  });

  it.each([
    ["an empty file", "", `${LINE}\n`],
    ["a file without one", "# mine\nlanguages: []\n", `${LINE}\n# mine\nlanguages: []\n`],
    [
      "an outdated one",
      "# yaml-language-server: $schema=https://x/v2.6.0/schema/settings.json\nlanguages: []\n",
      `${LINE}\nlanguages: []\n`,
    ],
    ["a file of only the modeline", LINE, `${LINE}\n`],
  ])("sets the modeline of %s, keeping the rest byte for byte", (_, text, expected) => {
    expect(withModeline(text, "3.0.0")).toBe(expected);
  });

  it("writes the offline copy as the running kernel's schema", () => {
    const registry = settingsRegistry();
    expect(JSON.parse(offlineSchemaText(registry))).toStrictEqual(settingsJsonSchema(registry));
  });
});
