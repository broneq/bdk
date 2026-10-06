// `acceptance-catalogue` (T50): the real catalogue against the real test
// titles. Every item answered by its evidence, every bracketed ID of a
// catalogue prefix known, and the committed report equal to what
// `pnpm acceptance:report` writes now.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import {
  catalogueProblems,
  collectTitles,
  evidenceProblems,
  readCatalogue,
  renderReport,
} from "../support/acceptance.ts";
import type { CatalogueItem, TestTitle } from "../support/acceptance.ts";
import { REPO_ROOT } from "../support/run.ts";

const REPORT = "docs/V3-ACCEPTANCE.md";

describe("the acceptance catalogue", () => {
  let items: CatalogueItem[];
  let titles: TestTitle[];

  beforeAll(() => {
    items = readCatalogue(REPO_ROOT);
    titles = collectTitles(REPO_ROOT);
  });

  it("is well formed", () => {
    expect(catalogueProblems(items)).toEqual([]);
  });

  it("has every item answered and every bracketed id known", () => {
    expect(evidenceProblems(items, titles, (path) => existsSync(join(REPO_ROOT, path)))).toEqual(
      [],
    );
  });

  it(`matches the committed ${REPORT}; rerun pnpm acceptance:report when it does not`, () => {
    const committed = readFileSync(join(REPO_ROOT, REPORT), "utf8");
    expect(
      committed === renderReport(items, titles),
      `${REPORT} is stale: run pnpm acceptance:report and commit it`,
    ).toBe(true);
  });
});
