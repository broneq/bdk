// The file-class partition and the tree hash (`kernel-state`, Evidence
// manifest, Tree hash; T23-D45): non-executable files never count,
// build config always does, and the hash names every covered path.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { changedSince, coveredPaths, fileClass, treeOf } from "../use-cases/tree.ts";
import type { FilePolicy } from "../use-cases/tree.ts";

const POLICY: FilePolicy = {
  nonExecutable: ["**/*.md", "**/*.txt", "docs/**", ".bdk/**"],
  buildConfig: ["package.json", "pnpm-lock.yaml", "requirements*.txt"],
};

const sha = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

function reader(files: Record<string, string>) {
  return (path: string) => (path in files ? Buffer.from(files[path] ?? "") : undefined);
}

describe("fileClass", () => {
  it.each([
    ["src/auth/login.ts", "executable"],
    ["docs/login.md", "non-executable"],
    ["README.md", "non-executable"],
    ["docs/diagram.ts", "non-executable"],
    ["package.json", "build-config"],
    ["web/package.json", "executable"],
    ["requirements-dev.txt", "build-config"],
  ])("classes %s as %s", (path, expected) => {
    expect(fileClass(POLICY, path)).toBe(expected);
  });
});

describe("coveredPaths", () => {
  it("drops non-executable Files: paths and adds build config from the working tree", () => {
    expect(
      coveredPaths(
        POLICY,
        ["src/b.ts", "docs/login.md", "src/a.ts", "src/b.ts"],
        ["package.json", "src/other.ts", "README.md", "requirements.txt"],
      ),
    ).toStrictEqual(["package.json", "requirements.txt", "src/a.ts", "src/b.ts"]);
  });

  it("keeps a Files: path that is build config even when it looks non-executable", () => {
    expect(coveredPaths(POLICY, ["requirements.txt"], [])).toStrictEqual(["requirements.txt"]);
  });

  it("sorts in byte order, not locale order", () => {
    expect(coveredPaths(POLICY, ["src/b.ts", "src/B.ts", "src/a.ts"], [])).toStrictEqual([
      "src/B.ts",
      "src/a.ts",
      "src/b.ts",
    ]);
  });
});

describe("treeOf", () => {
  const files = { "src/a.ts": "export const a = 1;\n", "package.json": "{}\n" };

  it("lists each covered path with its file hash, in path order", () => {
    const { tree } = treeOf(["package.json", "src/a.ts"], reader(files));
    expect(tree).toStrictEqual([
      { path: "package.json", hash: sha("{}\n") },
      { path: "src/a.ts", hash: sha("export const a = 1;\n") },
    ]);
  });

  it("marks a deleted file absent and changes the hash", () => {
    const before = treeOf(["src/a.ts", "src/gone.ts"], reader({ ...files, "src/gone.ts": "x" }));
    const after = treeOf(["src/a.ts", "src/gone.ts"], reader(files));
    expect(after.tree[1]).toStrictEqual({ path: "src/gone.ts", hash: "absent" });
    expect(after.treeHash).not.toBe(before.treeHash);
  });

  it("changes the hash on a rename with the same bytes", () => {
    const one = treeOf(["src/a.ts"], reader(files));
    const two = treeOf(["src/b.ts"], reader({ "src/b.ts": files["src/a.ts"] }));
    expect(two.treeHash).not.toBe(one.treeHash);
  });

  it("is stable for the same files and answers a sha256 hash", () => {
    const one = treeOf(["package.json", "src/a.ts"], reader(files));
    expect(one.treeHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(treeOf(["package.json", "src/a.ts"], reader(files)).treeHash).toBe(one.treeHash);
  });

  it("hashes an empty scope", () => {
    expect(treeOf([], reader({})).treeHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("changedSince", () => {
  it("names changed, added and removed paths in path order", () => {
    const recorded = [
      { path: "a.ts", hash: sha("1") },
      { path: "b.ts", hash: sha("2") },
      { path: "c.ts", hash: sha("3") },
    ];
    const current = [
      { path: "a.ts", hash: sha("1") },
      { path: "b.ts", hash: "absent" },
      { path: "d.ts", hash: sha("4") },
    ];
    expect(changedSince(recorded, current)).toStrictEqual(["b.ts", "c.ts", "d.ts"]);
  });

  it("names nothing for the same tree", () => {
    const tree = [{ path: "a.ts", hash: sha("1") }];
    expect(changedSince(tree, tree)).toStrictEqual([]);
  });
});
