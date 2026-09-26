// `kernel-cli/service` through the committed bundle: every exit code and rule
// the two records declare, the scenarios of the spec, the JSON Schemas.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFixture } from "../../../tests/support/fixture.ts";
import type { Fixture } from "../../../tests/support/fixture.ts";
import { runBdk } from "../../../tests/support/run.ts";
import { validatorFor } from "../../../tests/support/schemas.ts";

const validVersion = validatorFor("common/version.json");
const validDoctor = validatorFor("output/doctor.json");

const fixtures: Fixture[] = [];
function fixture(...args: Parameters<typeof createFixture>): Fixture {
  const created = createFixture(...args);
  fixtures.push(created);
  return created;
}
afterEach(() => {
  for (const created of fixtures.splice(0)) created.remove();
});

describe("bdk version", () => {
  it("exit 0: the example run validates against common/version.json", () => {
    const result = runBdk(["version", "--json"], fixture().root);
    expect(result.code).toBe(0);
    expect(validVersion(result.json), JSON.stringify(validVersion.errors)).toBe(true);
    expect(result.json).toMatchObject({ contract: 3, node: process.versions.node });
  });

  it("exit 0: prints the text form outside any work tree", () => {
    const result = runBdk(["version"], fixture({ git: false }).root);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(
      `bdk ${(runBdk(["version", "--json"], fixture().root).json as { kernel: string }).kernel} (contract 3, node ${process.versions.node})\n`,
    );
  });

  it("exit 3: input/unknown-flag", () => {
    const result = runBdk(["version", "--bogus", "--json"], fixture().root);
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/unknown-flag" });
  });

  it("exit 3: input/invalid-argument", () => {
    const result = runBdk(["version", "extra", "--json"], fixture().root);
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/invalid-argument" });
  });
});

describe("bdk doctor", () => {
  it("exit 0: a healthy project is ok with no findings", () => {
    const result = runBdk(["doctor", "--json"], fixture({ files: { ".bdk/": "" } }).root);
    expect(result.code).toBe(0);
    expect(validDoctor(result.json), JSON.stringify(validDoctor.errors)).toBe(true);
    expect(result.json).toMatchObject({ ok: true, layout: "v3", findings: [] });
  });

  it("exit 0: the v2 layout is a warn finding repaired by bdk import", () => {
    const root = fixture({ files: { ".bdk/settings.json": "{}", ".bdk/plans/": "" } }).root;
    const result = runBdk(["doctor", "--json"], root);
    expect(result.code).toBe(0);
    expect(validDoctor(result.json), JSON.stringify(validDoctor.errors)).toBe(true);
    expect(result.json).toMatchObject({
      ok: false,
      layout: "v2",
      findings: [
        {
          id: "v2-layout",
          level: "warn",
          summary: ".bdk/settings.json and .bdk/plans/ found",
          repair: "bdk import",
        },
      ],
    });
  });

  it("exit 0: --fix is accepted and the text form lists the findings", () => {
    const root = fixture({ files: { ".bdk/runs/": "" } }).root;
    const result = runBdk(["doctor", "--fix"], root);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("warn v2-layout: .bdk/runs/ found\n  repair: bdk import\n");
  });

  it("exit 0: a settings file without modeline is a schema-modeline finding", () => {
    const root = fixture({ files: { ".bdk/settings.yaml": "languages: [go]\n" } }).root;
    const result = runBdk(["doctor", "--json"], root);
    expect(result.code).toBe(0);
    expect(validDoctor(result.json), JSON.stringify(validDoctor.errors)).toBe(true);
    expect(result.json).toMatchObject({ ok: false });
    expect((result.json as { findings: unknown[] }).findings).toContainEqual({
      id: "schema-modeline",
      level: "warn",
      summary: expect.stringContaining(".bdk/settings.yaml") as unknown,
      repair: "bdk doctor --fix",
    });
  });

  it("exit 0: --fix repairs the schema findings", () => {
    const content = "# mine\nlanguages: [go]\n";
    const root = fixture({ files: { ".bdk/settings.yaml": content } }).root;
    const result = runBdk(["doctor", "--fix", "--json"], root);
    expect(result.code).toBe(0);
    expect(result.json).toMatchObject({ ok: true, findings: [] });
    const url = (runBdk(["config", "schema", "--url", "--json"], root).json as { url: string }).url;
    expect(readFileSync(join(root, ".bdk/settings.yaml"), "utf8")).toBe(
      `# yaml-language-server: $schema=${url}\n${content}`,
    );
    const schema = (runBdk(["config", "schema", "--json"], root).json as { schema: unknown })
      .schema;
    expect(
      JSON.parse(readFileSync(join(root, ".bdk/.machine/schema/settings.json"), "utf8")),
    ).toStrictEqual(schema);
  });

  it("names no uv, uvx or MCP server on a machine without them", () => {
    const result = runBdk(["doctor", "--json"], fixture().root, { env: { PATH: "" } });
    expect(result.code).toBe(0);
    expect(result.stdout).not.toMatch(/\buvx?\b|mcp/i);
  });

  it("exit 3: input/unknown-flag", () => {
    const result = runBdk(["doctor", "--bogus", "--json"], fixture().root);
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/unknown-flag" });
  });

  it("exit 5: runtime/not-a-repo outside a work tree", () => {
    const result = runBdk(["doctor", "--json"], fixture({ git: false }).root);
    expect(result.code).toBe(5);
    expect(result.json).toMatchObject({ rule: "runtime/not-a-repo" });
  });

  it.todo("exit 2: policy/merge-hash-mismatch arrives with the merge-hash check of T30");
});
