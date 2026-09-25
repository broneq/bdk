import { describe, expect, it } from "vitest";

import { refuse } from "../../refusal/index.ts";
import { capLines, json, listPage, refusalText, stopBlock, TEXT_LINE_CAP } from "../index.ts";

const refusal = refuse("policy/budget-exhausted", "loop task-redispatch for 02-3 used 3 of 3", [
  "bdk attempt open task-escalation 02-3",
  'bdk change park --reason "02-3 exhausted"',
]);

describe("json", () => {
  it("prints exactly one object followed by a newline", () => {
    const out = json({ kernel: "3.0.0", contract: 3 });
    expect(out.endsWith("\n")).toBe(true);
    expect(JSON.parse(out)).toStrictEqual({ kernel: "3.0.0", contract: 3 });
  });
});

describe("refusalText", () => {
  it("prints the four labelled lines, one instead per action", () => {
    expect(refusalText(refusal)).toBe(
      [
        "refused: policy/budget-exhausted",
        "why: loop task-redispatch for 02-3 used 3 of 3",
        "instead: bdk attempt open task-escalation 02-3",
        'instead: bdk change park --reason "02-3 exhausted"',
        "",
      ].join("\n"),
    );
  });
});

describe("stopBlock", () => {
  it("is exactly two lines and nothing after them", () => {
    expect(stopBlock(refusal)).toBe(
      "BDK STOP: loop task-redispatch for 02-3 used 3 of 3\n" +
        'Instead: bdk attempt open task-escalation 02-3; bdk change park --reason "02-3 exhausted"\n',
    );
  });
});

describe("capLines", () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");

  it("leaves text of up to 100 lines untouched", () => {
    expect(capLines(lines(TEXT_LINE_CAP))).toBe(`${lines(TEXT_LINE_CAP)}\n`);
  });

  it("prints at most 100 lines and says how many were cut", () => {
    const out = capLines(lines(250)).trimEnd().split("\n");
    expect(out).toHaveLength(TEXT_LINE_CAP);
    expect(out[98]).toBe("line 99");
    expect(out[99]).toBe("... 151 more lines (--all prints everything)");
  });

  it("prints everything with all", () => {
    expect(capLines(lines(250), { all: true }).trimEnd().split("\n")).toHaveLength(250);
  });
});

describe("listPage", () => {
  const items = Array.from({ length: 150 }, (_, i) => i);

  it("keeps the first 100 items, the full total and truncated true", () => {
    const page = listPage(items);
    expect(page.items).toHaveLength(100);
    expect(page.total).toBe(150);
    expect(page.truncated).toBe(true);
    expect("for" in page).toBe(false);
  });

  it("returns every item with all", () => {
    const page = listPage(items, { all: true, for: "02-3" });
    expect(page).toMatchObject({ total: 150, truncated: false, for: "02-3" });
    expect(page.items).toHaveLength(150);
  });

  it("is not truncated at or below the cap", () => {
    expect(listPage([1, 2]).truncated).toBe(false);
  });
});
