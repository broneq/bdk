// OpenSpec compatibility of the living spec (T30-D14): a fixture Change
// merged through `dist/bdk.mjs`, its `.bdk/specs/` copied into `openspec/specs/`
// of a scratch repository, and `openspec validate --specs --strict` run on it.
// Locally the test is skipped without `openspec` on PATH; in CI (`CI` set) a
// missing `openspec` fails, so the check never passes vacuously there.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk } from "../support/repo.ts";
import { creating, reviewed } from "../../src/spec/tests/e2e-support.ts";

const found = spawnSync("openspec", ["--version"], { encoding: "utf8" }).status === 0;
const inCi = process.env.CI !== undefined && process.env.CI !== "";

if (!found && !inCi) {
  console.warn("openspec is not on PATH: the OpenSpec compatibility test is skipped");
}

describe("OpenSpec compatibility", () => {
  it("openspec is installed in CI", () => {
    expect(found || !inCi, "CI must install @fission-ai/openspec").toBe(true);
  });

  it.runIf(found)("openspec validate --specs --strict accepts the merged .bdk/specs/", () => {
    const change = reviewed({
      deltas: {
        "auth/login": creating(
          ["Magic link sent", ["link requested", "unknown address"]],
          ["Magic link expires", ["expired link"]],
        ),
        billing: creating(["Invoice issued", ["order paid"]]),
      },
    });
    answered(bdk(["spec", "merge", "--json"], change.root), "output/spec-merge.json");
    const scratch = mkdtempSync(join(tmpdir(), "bdk-openspec-"));
    try {
      cpSync(join(change.root, ".bdk/specs"), join(scratch, "openspec/specs"), {
        recursive: true,
      });
      const result = spawnSync("openspec", ["validate", "--specs", "--strict", "--json"], {
        cwd: scratch,
        encoding: "utf8",
        env: { ...process.env, OPENSPEC_TELEMETRY: "0" },
      });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const report = JSON.parse(result.stdout) as {
        items: { id: string; valid: boolean }[];
      };
      expect(report.items.map((item) => [item.id, item.valid]).sort()).toStrictEqual([
        ["auth/login", true],
        ["billing", true],
      ]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
