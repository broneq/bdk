// `kernel-cli/review`, bdk review plan: the reviewer groups as a pure
// function of the changed files, the plan parts' `Files:` and the size limit.
import { describe, expect, it } from "vitest";

import { moduleOf } from "../../measure/index.ts";
import { reviewGroups } from "../domain/groups.ts";
import type { PartFiles } from "../domain/groups.ts";

const groups = (changed: string[], parts: PartFiles[] = [], maxFiles = 30) =>
  reviewGroups({ changed, parts, maxFiles, moduleOf });

const files = (dir: string, count: number) =>
  Array.from({ length: count }, (_, at) => `${dir}/f${String(at).padStart(2, "0")}.ts`);

describe("reviewGroups", () => {
  it("has no groups for an empty range", () => {
    expect(groups([], [{ id: "01", files: ["src/a.ts"] }])).toStrictEqual([]);
  });

  it("follows the plan parts, then unplanned, then integration", () => {
    const changed = ["src/auth/login.ts", "src/mail/send.ts", "src/util/date.ts"];
    expect(
      groups(changed, [
        { id: "01", files: ["src/auth/login.ts"] },
        { id: "02", files: ["src/mail/send.ts", "src/mail/unchanged.ts"] },
      ]),
    ).toStrictEqual([
      { id: "p01", kind: "part", part: "01", files: ["src/auth/login.ts"] },
      { id: "p02", kind: "part", part: "02", files: ["src/mail/send.ts"] },
      { id: "unplanned", kind: "unplanned", files: ["src/util/date.ts"] },
      { id: "integration", kind: "integration", files: changed },
    ]);
  });

  it("gives a file named by two parts to the first in plan order, and skips a part without changes", () => {
    expect(
      groups(
        ["src/shared.ts"],
        [
          { id: "01", files: [] },
          { id: "02", files: ["src/shared.ts"] },
          { id: "03", files: ["src/shared.ts"] },
        ],
      ).map((group) => [group.id, group.files]),
    ).toStrictEqual([
      ["p02", ["src/shared.ts"]],
      ["integration", ["src/shared.ts"]],
    ]);
  });

  it("splits a large part by module into numbered groups", () => {
    const api = files("src/api", 25);
    const db = files("src/db", 20);
    const result = groups([...db, ...api], [{ id: "02", files: [...api, ...db] }]);
    expect(
      result.map((group) => [group.id, group.kind, group.part, group.files.length]),
    ).toStrictEqual([
      ["p02-1", "part", "02", 25],
      ["p02-2", "part", "02", 20],
      ["integration", "integration", undefined, 45],
    ]);
    expect(result[0]?.files).toStrictEqual(api);
  });

  it("packs whole modules up to the limit and cuts a module above it into runs", () => {
    const big = files("src/big", 12);
    const small = [...files("src/a", 3), ...files("src/b", 4)];
    const result = groups([...big, ...small], [], 5);
    expect(result.map((group) => [group.id, group.files])).toStrictEqual([
      ["m1", files("src/a", 3)],
      ["m2", files("src/b", 4)],
      ["m3-1", big.slice(0, 5)],
      ["m3-2", big.slice(5, 10)],
      ["m3-3", big.slice(10)],
      ["integration", [...small, ...big].sort()],
    ]);
  });

  it("splits unplanned too, keeping packed modules whole", () => {
    const result = groups(
      [...files("lib/x", 3), ...files("lib/y", 2), ...files("web/z", 2)],
      [{ id: "01", files: [] }],
      5,
    );
    expect(result.map((group) => [group.id, group.kind, group.files.length])).toStrictEqual([
      ["unplanned-1", "unplanned", 5],
      ["unplanned-2", "unplanned", 2],
      ["integration", "integration", 7],
    ]);
  });

  it("groups by module without plan parts", () => {
    expect(
      groups(["web/forms/a.ts", "src/auth/b.ts", "src/auth/c.ts", "README.md"]).map((group) => [
        group.id,
        group.kind,
        group.files,
      ]),
    ).toStrictEqual([
      ["m1", "module", ["README.md"]],
      ["m2", "module", ["src/auth/b.ts", "src/auth/c.ts"]],
      ["m3", "module", ["web/forms/a.ts"]],
      [
        "integration",
        "integration",
        ["README.md", "src/auth/b.ts", "src/auth/c.ts", "web/forms/a.ts"],
      ],
    ]);
  });
});
