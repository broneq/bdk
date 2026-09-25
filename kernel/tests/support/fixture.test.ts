import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createFixture } from "./fixture.ts";
import type { Fixture } from "./fixture.ts";

let fixture: Fixture | undefined;
afterEach(() => fixture?.remove());

describe("createFixture", () => {
  it("creates a git work tree with the requested files and directories", () => {
    fixture = createFixture({ files: { ".bdk/settings.json": "{}", ".bdk/plans/": "" } });
    expect(existsSync(join(fixture.root, ".git"))).toBe(true);
    expect(readFileSync(join(fixture.root, ".bdk/settings.json"), "utf8")).toBe("{}");
    expect(statSync(join(fixture.root, ".bdk/plans")).isDirectory()).toBe(true);
  });

  it("skips git init on request and removes everything", () => {
    fixture = createFixture({ git: false });
    const root = fixture.root;
    expect(existsSync(join(root, ".git"))).toBe(false);
    fixture.remove();
    expect(existsSync(root)).toBe(false);
  });
});
