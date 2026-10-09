import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A merge that commits unresolved conflict blocks passes every other check: Markdown lint reads
// the markers as text (design D8 of v3-280-pr-review-verify-new-commits).

const root = join(import.meta.dirname, "..");
const marker = /^(?:<{7}|>{7})(?: |$)/;

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((path) => path !== "");
}

describe("tracked files", () => {
  it("hold no git conflict marker", () => {
    const found: string[] = [];
    for (const path of trackedFiles()) {
      let text: string;
      try {
        text = readFileSync(join(root, path), "utf8");
      } catch {
        continue; // deleted in the working tree, or a submodule
      }
      if (text.includes("\0")) continue; // binary
      text.split("\n").forEach((line, index) => {
        if (marker.test(line)) found.push(`${path}:${index + 1}`);
      });
    }
    expect(found).toEqual([]);
  });
});
