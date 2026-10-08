import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { committedPages, drift, writePages } from "./docs-reference/files.ts";
import { loadModel } from "./docs-reference/model.ts";
import { renderReference } from "./docs-reference/render.ts";

// Reference drift fails pnpm check (spec `docs-site`, "Reference drift fails pnpm check").

describe("docs/reference", () => {
  it("matches what pnpm docs:reference generates from the plugin sources", async () => {
    const generated = renderReference(await loadModel());
    const stale = drift(generated, committedPages(join(import.meta.dirname, "../docs/reference")));
    expect(
      stale.map((path) => `docs/reference/${path}`),
      "These Reference pages differ from the plugin sources. Run `pnpm docs:reference` and commit the result.",
    ).toEqual([]);
  });
});

describe("drift", () => {
  it("names a page that is missing, different or no longer generated", () => {
    const generated = new Map([
      ["a.md", "A"],
      ["b.md", "B"],
    ]);
    const committed = new Map([
      ["b.md", "old"],
      ["c.md", "C"],
    ]);
    expect(drift(generated, committed)).toEqual(["a.md", "b.md", "c.md"]);
  });

  it("writes changed pages, removes stale ones and keeps the hand-written index", () => {
    const dir = mkdtempSync(join(tmpdir(), "reference-"));
    try {
      mkdirSync(join(dir, "kit"));
      writeFileSync(join(dir, "index.md"), "hand");
      writeFileSync(join(dir, "kit", "gone.md"), "old");
      writePages(dir, new Map([["kit/skills.md", "new"]]));
      expect(committedPages(dir)).toEqual(new Map([["kit/skills.md", "new"]]));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
