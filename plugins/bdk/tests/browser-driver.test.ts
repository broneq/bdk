import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// The browser driver of e2e-check as shipped (ADR-0004; specs `bdk-e2e-check` "Playwright driver"
// and `bdk-setup` "Playwright for the browser item"): one pinned Playwright version wherever the
// tester and setup name it, and no trace of the removed chrome-devtools-axi driver.

const PLUGIN = join(import.meta.dirname, "..");
const DRIVERS = "skills/e2e-check/references/drivers.md";
const SETUP_E2E = "skills/setup/references/e2e.md";
const SHIPPED = ["skills", "agents", "evals"];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const read = (path: string) => readFileSync(join(PLUGIN, path), "utf8");
const versions = (text: string) =>
  [...text.matchAll(/(?:^|[\s`'"(])(?:@playwright\/test|playwright)@(\d+\.\d+\.\d+)/g)].map(
    (match) => match[1],
  );

const files = SHIPPED.flatMap((dir) => walk(join(PLUGIN, dir)))
  .map((path) => relative(PLUGIN, path).split(sep).join("/"))
  .filter((path) => !path.startsWith("evals/results/"));

describe("browser driver", () => {
  it("pins one Playwright version in the driver and in setup", () => {
    const pinned = versions(read(DRIVERS));
    expect(pinned.length).toBeGreaterThan(0);
    expect(versions(read(SETUP_E2E)).length).toBeGreaterThan(0);
    const named = files.flatMap((path) => versions(read(path)).map((version) => [path, version]));
    expect(named.filter(([, version]) => version !== pinned[0])).toEqual([]);
  });

  it("names chrome-devtools-axi nowhere in the shipped skills, agents and evals", () => {
    expect(files.filter((path) => read(path).includes("chrome-devtools-axi"))).toEqual([]);
  });
});
