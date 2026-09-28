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

  it("reads and writes bytes that are not UTF-8, keeping the size", () => {
    const { root, store } = open({ "t.txt": "héllo" });
    const binary = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
    store.writeBytes(join(root, "bin/capture.png"), binary);
    expect(store.readBytes(join(root, "bin/capture.png"))).toStrictEqual(binary);
    expect(store.stat(join(root, "bin/capture.png"))?.size).toBe(6);
    expect(Buffer.from(store.readBytes(join(root, "t.txt")) ?? [])).toStrictEqual(
      Buffer.from("héllo"),
    );
    expect(store.readBytes(join(root, "missing"))).toBeUndefined();
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

  it("stats files and directories and answers undefined for an absent path", () => {
    const { root, store } = open({ "a.md": "abc", "d/": "" });
    expect(store.stat(join(root, "a.md"))).toMatchObject({ size: 3, directory: false });
    expect(store.stat(join(root, "d"))).toMatchObject({ directory: true });
    expect(store.stat(join(root, "none"))).toBeUndefined();
  });

  it("gives a rewritten file a new inode, as a rename does", () => {
    const { root, store } = open({ "a.md": "abc" });
    const path = join(root, "a.md");
    const before = store.stat(path);
    store.write(path, "abd");
    expect(store.stat(path)?.ino).not.toBe(before?.ino);
  });

  it("removes a file and ignores an absent one", () => {
    const { root, store } = open({ "a.md": "abc" });
    store.remove(join(root, "a.md"));
    store.remove(join(root, "none"));
    expect(store.exists(join(root, "a.md"))).toBe(false);
  });

  it("appends to a file, creating it and its parents", () => {
    const { root, store } = open();
    const path = join(root, "t/log.jsonl");
    store.append(path, "a\n");
    store.append(path, "b\n");
    expect(store.read(path)).toBe("a\nb\n");
  });

  it("moves a directory with nested files, creating the target's parents", () => {
    const { root, store } = open({
      "c/x/a.md": "a",
      "c/x/d/b.md": "b",
      "c/x/e/": "",
      "c/y.md": "y",
    });
    store.move(join(root, "c/x"), join(root, "c/archive/x"));
    expect(store.exists(join(root, "c/x"))).toBe(false);
    expect(store.read(join(root, "c/archive/x/a.md"))).toBe("a");
    expect(store.read(join(root, "c/archive/x/d/b.md"))).toBe("b");
    expect(store.isDirectory(join(root, "c/archive/x/e"))).toBe(true);
    expect(store.list(join(root, "c"))).toStrictEqual(["archive/", "y.md"]);
  });

  it("moves a file", () => {
    const { root, store } = open({ "a.md": "abc" });
    store.move(join(root, "a.md"), join(root, "b/a.md"));
    expect(store.exists(join(root, "a.md"))).toBe(false);
    expect(store.read(join(root, "b/a.md"))).toBe("abc");
  });

  it("refuses to move onto an existing target or from an absent source", () => {
    const { root, store } = open({ "x/a.md": "a", "y/": "" });
    expect(() => {
      store.move(join(root, "x"), join(root, "y"));
    }).toThrow(/exists/);
    expect(() => {
      store.move(join(root, "none"), join(root, "z"));
    }).toThrow(/ENOENT/);
    expect(store.read(join(root, "x/a.md"))).toBe("a");
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
