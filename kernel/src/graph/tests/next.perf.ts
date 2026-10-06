// The T21 `next` latency budget through the built bundle. Wall-clock
// timing depends on the machine, so this runs in the `perf` project, which CI
// does not run: `pnpm build && pnpm test:perf` locally.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BUNDLE, REPO_ROOT } from "../../../tests/support/run.ts";
import { designed, done, entry, next, passGate, settle, writePart } from "./bundle.ts";

/** p95 of 20 `bdk next` runs in `root`, in milliseconds, each asserted to exit 0. */
function p95Of(root: string): { p95: number; times: string } {
  const env = {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
    HOME: root,
    XDG_CONFIG_HOME: join(root, ".xdg"),
  };
  const times: number[] = [];
  for (let run = 0; run < 20; run++) {
    const start = performance.now();
    const result = spawnSync(process.execPath, [BUNDLE, "next"], {
      cwd: root,
      env,
      encoding: "utf8",
    });
    times.push(performance.now() - start);
    expect(result.status).toBe(0);
  }
  times.sort((a, b) => a - b);
  return {
    p95: times[Math.ceil(times.length * 0.95) - 1] ?? Infinity,
    times: times.map((t) => t.toFixed(0)).join(", "),
  };
}

describe("T21 performance", () => {
  it("next p95 is under 150 ms on 8 plan parts and 1 000 entries [NFR-LAT-5]", () => {
    const { root, dir } = designed();
    passGate(dir, "gate:design", "plan");
    for (let nn = 1; nn <= 8; nn++) writePart(dir, "plan", `0${String(nn)}`);
    done(root, "plan");
    for (let i = 0; i < 1000; i++) {
      entry(dir, "2026-09-25T10:00:00.000Z", {
        type: "finding",
        summary: `Finding ${String(i)}`,
        status: "proposed",
      });
    }
    settle(dir);
    next(root); // records the settled files in the index, as the first call of a session does
    const { p95, times } = p95Of(root);
    expect(p95, `next took ${times} ms`).toBeLessThan(150);
  });

  // A plan node's instruction selects the plan stage's rules over the work
  // tree files: `git ls-files` and every rule's globs over 10 000 files.
  it("next p95 is under 150 ms on a plan node in a work tree of 10 000 files", () => {
    const { root, dir } = designed();
    passGate(dir, "gate:design", "plan");
    for (let d = 0; d < 100; d++) {
      const sub = join(root, "src", `m${String(d)}`);
      mkdirSync(sub, { recursive: true });
      for (let f = 0; f < 100; f++) writeFileSync(join(sub, `f${String(f)}.py`), "\n");
    }
    const first = next(root);
    expect(first.artifact).toMatchObject({ id: "plan" });
    expect(first.instruction).toContain("## Rules");
    const { p95, times } = p95Of(root);
    expect(p95, `next took ${times} ms`).toBeLessThan(150);
  });
});
