import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// brand.css repeats the design system's dark theme for VitePress's `.dark` class; this keeps the
// copy equal to the vendored colors.css after an update of ./design-system/.

const theme = import.meta.dirname;

/** The custom properties a rule block sets, by name, with whitespace and case normalised. */
function variables(css: string, selector: string): Map<string, string> {
  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`no block for ${selector}`);
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  return new Map(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)].map((match) => [
      match[1] ?? "",
      (match[2] ?? "")
        .replaceAll(/\s+/g, "")
        // 0.10, .10 and .1 are one number: prettier writes them differently from the source.
        .replaceAll(/\d*\.\d+/g, (number) => String(Number(number)))
        .toLowerCase(),
    ]),
  );
}

describe("brand.css", () => {
  it("sets the dark theme of the vendored colors.css, value for value", () => {
    const tokens = variables(
      readFileSync(join(theme, "design-system/colors.css"), "utf8"),
      ".bn-dark,",
    );
    const brand = variables(readFileSync(join(theme, "brand.css"), "utf8"), "html.dark,\n.VPNav,");
    expect(Object.fromEntries(brand)).toEqual(Object.fromEntries(tokens));
  });
});
