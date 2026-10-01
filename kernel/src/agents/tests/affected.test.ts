// Whom a ledger entry affects (`kernel-cli/agents`, bdk agents list --affected-by).
import { describe, expect, it } from "vitest";

import { namesTarget, targetNames } from "../domain/affected.ts";

describe("affected", () => {
  it("names a task by itself, its part and its files, an anchor stripped", () => {
    const names = targetNames("02-3", { part: "02", tasks: [], files: ["src/a.ts"] });
    expect(namesTarget(["02"], names)).toBe(true);
    expect(namesTarget(["src/a.ts#L4"], names)).toBe(true);
    expect(namesTarget(["02-1", "src/b.ts"], names)).toBe(false);
  });

  it("names an artifact only by its own id", () => {
    const names = targetNames("design", { part: undefined, tasks: [], files: [] });
    expect([...names]).toEqual(["design"]);
    expect(namesTarget(["design#decisions"], names)).toBe(true);
  });
});
