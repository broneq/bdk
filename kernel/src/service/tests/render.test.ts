import { describe, expect, it } from "vitest";

import { renderDoctor } from "../render/doctor.ts";
import { renderVersion } from "../render/version.ts";
import type { VersionReport } from "../domain/report.ts";

const VERSION: VersionReport = { kernel: "3.0.0", contract: 3, node: "24.21.0" };

describe("render", () => {
  it("prints the version line of the spec", () => {
    expect(renderVersion(VERSION)).toBe("bdk 3.0.0 (contract 3, node 24.21.0)\n");
  });

  it("prints a healthy doctor report", () => {
    expect(renderDoctor({ ok: true, version: VERSION, layout: "v3", findings: [] })).toBe(
      "bdk 3.0.0 (contract 3, node 24.21.0)\nlayout: v3\nno findings\n",
    );
  });

  it("prints one line per finding with its repair", () => {
    const text = renderDoctor({
      ok: false,
      version: VERSION,
      layout: "v2",
      findings: [
        { id: "v2-layout", level: "warn", summary: ".bdk/runs/ found", repair: "bdk import" },
      ],
    });
    expect(text).toBe(
      "bdk 3.0.0 (contract 3, node 24.21.0)\nlayout: v2\nwarn v2-layout: .bdk/runs/ found\n  repair: bdk import\n",
    );
  });
});
