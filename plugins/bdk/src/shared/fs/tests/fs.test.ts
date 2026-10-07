import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { files } from "../index.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "bdk-fs-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("files", () => {
  it("reads a file as UTF-8 text", () => {
    writeFileSync(join(root, "a.txt"), "zażółć\n");
    expect(files.readText(join(root, "a.txt"))).toBe("zażółć\n");
  });

  it("reads a missing file, or one under a file, as undefined", () => {
    writeFileSync(join(root, "a.txt"), "");
    expect(files.readText(join(root, "missing.txt"))).toBeUndefined();
    expect(files.readText(join(root, "a.txt", "b.txt"))).toBeUndefined();
  });

  it("throws on a directory read as a file", () => {
    expect(() => files.readText(root)).toThrow();
  });

  it("lists a directory sorted by name and marks subdirectories", () => {
    writeFileSync(join(root, "b.txt"), "");
    mkdirSync(join(root, "a"));
    expect(files.list(root)).toEqual([
      { name: "a", dir: true },
      { name: "b.txt", dir: false },
    ]);
  });

  it("lists a missing directory as undefined", () => {
    expect(files.list(join(root, "missing"))).toBeUndefined();
  });

  it("writes a file and creates its parent directories", () => {
    const path = join(root, "x", "y", "a.txt");
    files.writeText(path, "one");
    files.writeText(path, "two");
    expect(readFileSync(path, "utf8")).toBe("two");
  });

  it("appends to a file and creates its parent directories", () => {
    const path = join(root, "x", "y", "log.jsonl");
    files.appendText(path, "1\n");
    files.appendText(path, "2\n");
    expect(readFileSync(path, "utf8")).toBe("1\n2\n");
  });
});
