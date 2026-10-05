import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  expandTests,
  freshSeriesName,
  seriesStamp,
  literalVar,
  readPlan,
  varValue,
  writePlan,
} from "./series.ts";
import type { SeriesPlan } from "./series.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("expandTests", () => {
  it("interleaves cells within each run and pins every test to its cell", () => {
    const tests = expandTests(["a", "b"], [{ id: "q1", vars: { q: "x" } }], 2);
    expect(tests.map((test) => test.description)).toEqual([
      "a q1 run 1",
      "b q1 run 1",
      "a q1 run 2",
      "b q1 run 2",
    ]);
    expect(tests[1]).toEqual({
      description: "b q1 run 1",
      vars: { q: "x", bdk_cell: "b", bdk_item: "q1", bdk_run: "1" },
      providers: ["b"],
      options: { disableVarExpansion: true },
    });
  });

  it("adds a cell's own vars over the item's, such as its prompt", () => {
    const tests = expandTests(["a", "b"], [{ id: "t", vars: { p: "item" } }], 1, {
      b: { p: "/bdk:execute" },
    });
    expect(tests.map((test) => test.vars.p)).toEqual(["item", "/bdk:execute"]);
  });

  it("wraps a var with template syntax in a raw block, so promptfoo passes a JSX diff unchanged", () => {
    const diff = "+ <div dangerouslySetInnerHTML={{ __html: noteHtml }} />";
    const [test] = expandTests(["a"], [{ id: "p", vars: { diff } }], 1);
    expect(test?.vars.diff).toBe(`{% raw %}${diff}{% endraw %}`);
    expect(varValue(test?.vars.diff ?? "")).toBe(diff);
  });

  it("keeps an item's assertions", () => {
    const [test] = expandTests(
      ["a"],
      [{ id: "t", vars: {}, assert: [{ type: "contains", value: "x" }] }],
      1,
    );
    expect(test?.assert).toEqual([{ type: "contains", value: "x" }]);
  });
});

describe("literalVar", () => {
  it("leaves a value without template syntax as it is", () => {
    expect(literalVar("plain { text }")).toBe("plain { text }");
    expect(varValue("plain { text }")).toBe("plain { text }");
  });

  it("refuses a value a raw block cannot hold", () => {
    expect(() => literalVar("{{ x }} {%- endraw %}")).toThrow(/endraw/);
  });
});

describe("series plan", () => {
  it("round-trips through its file", () => {
    const dir = mkdtempSync(join(tmpdir(), "bdk-evals-series-"));
    dirs.push(dir);
    const plan: SeriesPlan = {
      suite: "rules-noop",
      series: "m1-2026-09-28",
      runCapUsd: 15,
      resultsFile: join(dir, "rows.jsonl"),
      rawDir: join(dir, "raw"),
      cells: {},
    };
    writePlan(join(dir, "plan.json"), plan);
    expect(readPlan(join(dir, "plan.json"))).toEqual(plan);
  });

  it("refuses a missing plan, naming the variable", () => {
    expect(() => readPlan(undefined)).toThrow(/BDK_EVAL_SERIES/);
    expect(() => readPlan("/nonexistent/plan.json")).toThrow(/pnpm eval/);
  });
});

describe("seriesStamp", () => {
  it("names the UTC date and time to the second", () => {
    expect(seriesStamp(new Date("2026-10-05T08:00:13.512Z"))).toBe("2026-10-05-080013");
  });
});

describe("freshSeriesName", () => {
  it("adds a counter when the name is taken", () => {
    const taken = new Set(["2026-09-28", "2026-09-28-2"]);
    expect(freshSeriesName("2026-09-29", (name) => taken.has(name))).toBe("2026-09-29");
    expect(freshSeriesName("2026-09-28", (name) => taken.has(name))).toBe("2026-09-28-3");
  });
});
