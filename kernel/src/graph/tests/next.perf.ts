// The T21 `next` latency budget through the built bundle. Wall-clock
// timing depends on the machine, so this runs in the `perf` project, which CI
// does not run: `pnpm build && pnpm test:perf` locally.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BUNDLE, REPO_ROOT } from "../../../tests/support/run.ts";
import { designed, done, entry, next, passGate, settle, writePart } from "./bundle.ts";

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
    const p95 = times[Math.ceil(times.length * 0.95) - 1] ?? Infinity;
    expect(p95, `next took ${times.map((t) => t.toFixed(0)).join(", ")} ms`).toBeLessThan(150);
  });
});
