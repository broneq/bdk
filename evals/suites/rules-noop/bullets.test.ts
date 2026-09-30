import { describe, expect, it } from "vitest";

import { keptMapping, readBullets } from "./bullets.ts";

describe("keptMapping", () => {
  it("maps the T40 id of each kept row to its pack id and skips removed rows", () => {
    const report = [
      "| T40 id | excerpt | decision |",
      "| --- | --- | --- |",
      "| `code-quality.01.e4ed906e` | Naming | kept as BDK-CQ-1 |",
      "| `code-quality.07.98e318ea` | Dead code | removed: measured no-op |",
    ].join("\n");
    expect([...keptMapping(report)]).toStrictEqual([["code-quality.01.e4ed906e", "BDK-CQ-1"]]);
  });
});

describe("readBullets", () => {
  it("indexes every measured pack rule once, under its T40 id, the plan rules left out", () => {
    const bullets = readBullets();
    expect(bullets).toHaveLength(85);
    expect(new Set(bullets.map((bullet) => bullet.id)).size).toBe(bullets.length);
    expect(bullets.find((bullet) => bullet.rule === "BDK-CQ-1")).toMatchObject({
      id: expect.stringMatching(/^code-quality\.01\.[0-9a-f]{8}$/) as unknown,
      file: "rules/code-quality/BDK-CQ-1.md",
      text: expect.stringMatching(/^\*\*Naming\.\*\*/) as unknown,
    });
    expect(bullets.some((bullet) => bullet.rule.startsWith("BDK-PL-"))).toBe(false);
  });
});
