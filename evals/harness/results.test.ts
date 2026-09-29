import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { appendRow, modelsOf, readRows, readSuiteRows } from "./results.ts";
import type { ResultRow } from "./results.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const SHA = "a".repeat(40);

function row(overrides: Partial<ResultRow> = {}): ResultRow {
  return {
    suite: "execute-ab",
    series: "2026-09-28",
    cell: "v3-thin",
    item: "task",
    run: 1,
    discarded: null,
    cost: 2.5,
    metrics: { acceptance: 1, steps: 0.9, "bdk-calls": 40, "exit-3": 1, "exit-2": 0 },
    provenance: {
      models: ["claude-opus-5-5", "claude-sonnet-5"],
      fixtureCommit: SHA,
      bdkCommit: SHA,
      variantHash: "b".repeat(64),
      templateHashes: ["sha256:c"],
    },
    ...overrides,
  };
}

describe("result rows", () => {
  it("appends rows as JSONL and reads them back", () => {
    const dir = mkdtempSync(join(tmpdir(), "bdk-evals-results-"));
    dirs.push(dir);
    const file = join(dir, "execute-ab/2026-09-28.jsonl");
    appendRow(file, row());
    appendRow(file, row({ run: 2, discarded: "MCP tool call mcp__x" }));
    expect(readRows(file).map((read) => [read.run, read.discarded])).toEqual([
      [1, null],
      [2, "MCP tool call mcp__x"],
    ]);
  });

  it("reads the rows of every measured series of a suite, without probes or other records", () => {
    const dir = mkdtempSync(join(tmpdir(), "bdk-evals-results-"));
    dirs.push(dir);
    appendRow(join(dir, "series-2026-09-28.jsonl"), row({ series: "series-2026-09-28" }));
    appendRow(join(dir, "series-2026-09-28-2.jsonl"), row({ series: "series-2026-09-28-2" }));
    appendRow(join(dir, "probe-2026-09-28.jsonl"), row({ series: "probe-2026-09-28" }));
    writeFileSync(join(dir, "spot-check-2026-09-28.jsonl"), '{"item":"task","agree":true}\n');
    writeFileSync(join(dir, "report.md"), "# report\n");
    expect(readSuiteRows(dir).map((read) => read.series)).toEqual([
      "series-2026-09-28",
      "series-2026-09-28-2",
    ]);
    expect(readSuiteRows(join(dir, "missing"))).toEqual([]);
  });

  it("refuses a row without provenance", () => {
    const file = join(mkdtempSync(join(tmpdir(), "bdk-evals-results-")), "x.jsonl");
    dirs.push(file.replace(/\/x\.jsonl$/, ""));
    expect(() => {
      appendRow(file, row({ provenance: { ...row().provenance, models: [] } }));
    }).toThrow(/models/);
    expect(() => {
      appendRow(file, row({ provenance: { ...row().provenance, bdkCommit: "HEAD" } }));
    }).toThrow(/bdkCommit/);
    expect(() => {
      appendRow(file, row({ provenance: { ...row().provenance, fixtureCommit: "main" } }));
    }).toThrow(/fixtureCommit/);
  });

  it("accepts a discarded row without models", () => {
    const dir = mkdtempSync(join(tmpdir(), "bdk-evals-results-"));
    dirs.push(dir);
    const file = join(dir, "x.jsonl");
    appendRow(
      file,
      row({ discarded: "provider error", provenance: { ...row().provenance, models: [] } }),
    );
    expect(readRows(file)).toHaveLength(1);
  });

  it("reads the model ids a session reports", () => {
    expect(
      modelsOf({
        response: { metadata: { modelUsage: { "claude-opus-5-5": {}, "claude-haiku-4-5": {} } } },
      }),
    ).toEqual(["claude-haiku-4-5", "claude-opus-5-5"]);
    expect(modelsOf({ response: {} })).toEqual([]);
  });
});
