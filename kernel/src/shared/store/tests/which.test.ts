import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { findExecutable } from "../index.ts";

describe("findExecutable", () => {
  let first: string;
  let second: string;

  beforeAll(() => {
    const root = mkdtempSync(join(tmpdir(), "bdk-which-"));
    first = join(root, "a");
    second = join(root, "b");
    mkdirSync(first);
    mkdirSync(second);
    writeFileSync(join(first, "plain"), "");
    chmodSync(join(first, "plain"), 0o644);
    mkdirSync(join(first, "tool"));
    writeFileSync(join(second, "tool"), "#!/bin/sh\n");
    chmodSync(join(second, "tool"), 0o755);
    writeFileSync(join(second, "plain"), "");
    chmodSync(join(second, "plain"), 0o644);
    writeFileSync(join(second, "win.CMD"), "");
  });

  const posix = (path: string) => ({ env: { PATH: path }, platform: "linux" });

  it("finds an executable file on PATH, skipping a directory of the same name", () => {
    expect(findExecutable("tool", posix([first, second].join(delimiter)))).toBe(
      join(second, "tool"),
    );
  });

  it("ignores a file without the executable bit", () => {
    expect(findExecutable("plain", posix([first, second].join(delimiter)))).toBeUndefined();
  });

  it("finds nothing on an empty or absent PATH", () => {
    expect(findExecutable("tool", posix(""))).toBeUndefined();
    expect(findExecutable("tool", { env: {}, platform: "linux" })).toBeUndefined();
  });

  it("tries the PATHEXT extensions on win32 and reads Path in any case", () => {
    const env = { Path: `${first};${second}`, PATHEXT: ".EXE;.CMD" };
    expect(findExecutable("win", { env, platform: "win32" })).toBe(join(second, "win.CMD"));
    expect(findExecutable("plain", { env, platform: "win32" })).toBeUndefined();
  });
});
