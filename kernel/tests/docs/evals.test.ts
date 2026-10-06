// `docs-site`, Eval page for contributors: `contributing/evals.md` names
// every suite under `evals/suites/` as a code span, so a suite added to the
// harness reaches the page that explains it.
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../support/run.ts";
import { readPage } from "./site.ts";

const PAGE = "contributing/evals.md";

const suites = readdirSync(join(REPO_ROOT, "evals", "suites"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe(`${PAGE} names every suite`, () => {
  it("reads the suites", () => {
    expect(suites.length).toBeGreaterThan(0);
  });

  it.each(suites)("names %s", (suite) => {
    expect(readPage(PAGE)).toContain(`\`${suite}\``);
  });
});
