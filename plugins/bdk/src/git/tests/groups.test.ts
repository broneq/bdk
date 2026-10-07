import { describe, expect, it } from "vitest";

import { reviewGroups } from "../domain/groups.ts";
import { partFiles, partId } from "../domain/plan.ts";

// Part grouping and plan part parsing of spec `bdk-cli/git`, "Review groups".

const many = (dir: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `${dir}/f${String(i).padStart(3, "0")}.ts`);

describe("reviewGroups", () => {
  it("follows the plan parts, then unplanned, then integration", () => {
    const groups = reviewGroups(
      ["src/util/date.ts", "src/mail/send.ts", "src/auth/login.ts"],
      [
        { id: "01", files: ["src/auth/login.ts"] },
        { id: "02", files: ["src/mail/send.ts", "src/never/changed.ts"] },
      ],
      30,
    );
    expect(groups).toEqual([
      { id: "p01", kind: "part", part: "01", files: ["src/auth/login.ts"] },
      { id: "p02", kind: "part", part: "02", files: ["src/mail/send.ts"] },
      { id: "unplanned", kind: "unplanned", files: ["src/util/date.ts"] },
      {
        id: "integration",
        kind: "integration",
        files: ["src/auth/login.ts", "src/mail/send.ts", "src/util/date.ts"],
      },
    ]);
  });

  it("gives a file listed by two parts to the first and skips a part with no file", () => {
    const groups = reviewGroups(
      ["src/a.ts"],
      [
        { id: "01", files: ["src/a.ts"] },
        { id: "02", files: ["src/a.ts"] },
      ],
      30,
    );
    expect(groups.map((g) => g.id)).toEqual(["p01", "integration"]);
  });

  it("splits a part above the tolerance by module with suffixes", () => {
    const files = [...many("src/api", 25), ...many("src/db", 20)];
    const groups = reviewGroups(files, [{ id: "02", files }], 30);
    expect(groups.map((g) => [g.id, g.files.length])).toEqual([
      ["p02-1", 25],
      ["p02-2", 20],
      ["integration", 45],
    ]);
    expect(groups[1]).toMatchObject({ kind: "part", part: "02" });
  });

  it("keeps a part up to the tolerance whole and splits a large unplanned group", () => {
    const groups = reviewGroups(
      [...many("a/x", 35), ...many("b/y", 25), ...many("c/z", 20)],
      [{ id: "01", files: many("a/x", 35) }],
      30,
    );
    expect(groups.map((g) => [g.id, g.files.length])).toEqual([
      ["p01", 35],
      ["unplanned-1", 25],
      ["unplanned-2", 20],
      ["integration", 80],
    ]);
  });

  it("groups by module without a plan", () => {
    const groups = reviewGroups(["web/forms/a.ts", "src/auth/b.ts"], undefined, 30);
    expect(groups).toEqual([
      { id: "m1", kind: "module", files: ["src/auth/b.ts", "web/forms/a.ts"] },
      { id: "integration", kind: "integration", files: ["src/auth/b.ts", "web/forms/a.ts"] },
    ]);
  });

  it("has no group without a changed text file", () => {
    expect(reviewGroups([], undefined, 30)).toEqual([]);
    expect(reviewGroups([], [{ id: "01", files: ["a.ts"] }], 30)).toEqual([]);
  });
});

describe("partId", () => {
  it("is the two or more digit stem of a .md file", () => {
    expect(partId("01.md")).toBe("01");
    expect(partId("123.md")).toBe("123");
    expect(partId("1.md")).toBeUndefined();
    expect(partId("01.txt")).toBeUndefined();
    expect(partId("README.md")).toBeUndefined();
  });
});

describe("partFiles", () => {
  it("reads files from the frontmatter and ignores other keys", () => {
    const text =
      '---\nid: "01"\ndepends-on: []\nfiles:\n  - src/a.ts\n  - "src/b c.ts"\n---\n# Part\n';
    expect(partFiles(text)).toEqual({ files: ["src/a.ts", "src/b c.ts"] });
  });

  it("gives no files when files is absent", () => {
    expect(partFiles('---\nid: "01"\n---\n')).toEqual({ files: [] });
    expect(partFiles("---\n---\nbody")).toEqual({ files: [] });
  });

  it("names a missing frontmatter, invalid YAML and files that is no list of strings", () => {
    const problem = (text: string): string | undefined => {
      const result = partFiles(text);
      return "problem" in result ? result.problem : undefined;
    };
    expect(problem("# no frontmatter\n")).toMatch(/no frontmatter/);
    expect(problem("---\nfiles: [a\n---\n")).toMatch(/not YAML/);
    expect(problem("---\nfiles: src/a.ts\n---\n")).toMatch(/not a list of strings/);
    expect(problem("---\nfiles: [1, 2]\n---\n")).toMatch(/not a list of strings/);
  });
});
