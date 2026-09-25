// One suite, two implementations: whatever the in-memory store answers, the
// file system store answers the same, so slice unit tests on memory are honest.
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { fileStore, findProjectRoot, memoryStore } from "../index.ts";
import type { Store } from "../index.ts";

type Files = Readonly<Record<string, string>>;

interface Subject {
  readonly root: string;
  readonly store: Store;
  cleanup(): void;
}

const ROOT = "/work/repo";

const implementations: readonly (readonly [string, (files: Files) => Subject])[] = [
  [
    "memory",
    (files) => ({
      root: ROOT,
      store: memoryStore(
        Object.fromEntries(
          Object.entries(files).map(([path, content]) => [
            join(ROOT, path) + (path.endsWith("/") ? "/" : ""),
            content,
          ]),
        ),
      ),
      cleanup: () => undefined,
    }),
  ],
  [
    "file system",
    (files) => {
      const root = mkdtempSync(join(tmpdir(), "bdk-store-"));
      for (const [path, content] of Object.entries(files)) {
        const target = join(root, path);
        if (path.endsWith("/")) mkdirSync(target, { recursive: true });
        else {
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, content);
        }
      }
      return {
        root,
        store: fileStore(),
        cleanup: () => {
          rmSync(root, { recursive: true, force: true });
        },
      };
    },
  ],
];

describe.each(implementations)("%s store", (_, make) => {
  let subject: Subject | undefined;
  const open = (files: Files = {}): Subject => (subject = make(files));
  afterEach(() => subject?.cleanup());

  it("reads a file and answers undefined for an absent one", () => {
    const { root, store } = open({ "a/b.md": "hello" });
    expect(store.read(join(root, "a/b.md"))).toBe("hello");
    expect(store.read(join(root, "a/missing.md"))).toBeUndefined();
  });

  it("writes atomically, creating parents and leaving no temp file", () => {
    const { root, store } = open();
    store.write(join(root, "x/y/z.md"), "one");
    store.write(join(root, "x/y/z.md"), "two");
    expect(store.read(join(root, "x/y/z.md"))).toBe("two");
    expect(store.list(join(root, "x/y"))).toStrictEqual(["z.md"]);
  });

  it("lists direct children sorted, directories with a trailing slash", () => {
    const { root, store } = open({ "d/b.md": "", "d/a.md": "", "d/sub/c.md": "", "d/empty/": "" });
    expect(store.list(join(root, "d"))).toStrictEqual(["a.md", "b.md", "empty/", "sub/"]);
    expect(store.list(join(root, "nowhere"))).toStrictEqual([]);
  });

  it("knows files and directories, including empty ones", () => {
    const { root, store } = open({ "f.md": "", "d/": "" });
    expect(store.exists(join(root, "f.md"))).toBe(true);
    expect(store.exists(join(root, "d"))).toBe(true);
    expect(store.exists(join(root, "nope"))).toBe(false);
  });

  describe("project root", () => {
    it("is the nearest directory with .bdk/ below the work tree root", () => {
      const { root, store } = open({ ".bdk/": "", "pkg/.bdk/": "", "pkg/src/x.ts": "" });
      expect(findProjectRoot(store, join(root, "pkg/src"), root)).toBe(join(root, "pkg"));
    });

    it("falls back to the work tree root", () => {
      const { root, store } = open({ "src/x.ts": "" });
      expect(findProjectRoot(store, join(root, "src"), root)).toBe(root);
    });

    it("ignores a .bdk file, only a directory counts", () => {
      const { root, store } = open({ "src/.bdk": "not a directory" });
      expect(findProjectRoot(store, join(root, "src"), root)).toBe(root);
    });
  });
});

describe("file system store", () => {
  it("leaves no temp file when the rename fails", () => {
    const root = mkdtempSync(join(tmpdir(), "bdk-store-"));
    try {
      mkdirSync(join(root, "target.md"));
      writeFileSync(join(root, "target.md", "keep"), "");
      expect(() => {
        fileStore().write(join(root, "target.md"), "x");
      }).toThrow();
      expect(readdirSync(root)).toStrictEqual(["target.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
