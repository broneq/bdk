// `bdk export agents` through the built bundle: every scenario of
// `kernel-cli/export`, including the T23 acceptance that the committed
// `agents/` is the generator's byte-identical output.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../../../tests/support/run.ts";
import { answered, bdk, read, refused, repository } from "../../../tests/support/repo.ts";

const ADAPTERS = ["lead", "worker", "reader", "reviewer", "runner", "scout"];

/** A repository with freshly generated adapters under `gen/`. */
function generatedIn(): string {
  const root = repository();
  answered(
    bdk(["export", "agents", "--host", "claude", "--out", "gen", "--json"], root),
    "output/export-agents.json",
  );
  return root;
}

describe("bdk export agents", () => {
  it("exit 0: --check on the committed agents/ of the plugin", () => {
    const result = answered(
      bdk(["export", "agents", "--host", "claude", "--check", "--json"], repository()),
      "output/export-agents.json",
    );
    expect(result).toMatchObject({ host: "claude", changed: false });
    expect((result.files as { adapter: string }[]).map((file) => file.adapter)).toEqual(ADAPTERS);
  });

  it("acceptance: the committed adapters are reproduced byte for byte", () => {
    const root = generatedIn();
    for (const name of ADAPTERS) {
      expect(read(root, `gen/${name}.md`)).toBe(
        readFileSync(join(REPO_ROOT, "agents", `${name}.md`), "utf8"),
      );
    }
  });

  it("policy/generated-drift: a hand edit under --check", () => {
    const root = generatedIn();
    writeFileSync(join(root, "gen/reader.md"), `${read(root, "gen/reader.md")}edited\n`);
    const refusal = refused(
      bdk(["export", "agents", "--host", "claude", "--out", "gen", "--check", "--json"], root),
      2,
      "policy/generated-drift",
    );
    expect(refusal.why).toContain("gen/reader.md (edited)");
    expect(read(root, "gen/reader.md").endsWith("edited\n")).toBe(true);
  });

  it("policy/generated-drift: a missing adapter file", () => {
    const root = generatedIn();
    rmSync(join(root, "gen/scout.md"));
    const refusal = refused(
      bdk(["export", "agents", "--host", "claude", "--out", "gen", "--check", "--json"], root),
      2,
      "policy/generated-drift",
    );
    expect(refusal.why).toMatch(
      /^1 generated adapter file differs from .*: gen\/scout\.md \(missing\)$/,
    );
  });

  it("leaves the v2 agents next to the adapters alone", () => {
    const root = repository();
    mkdirSync(join(root, "gen"));
    writeFileSync(join(root, "gen/implementer.md"), "v2 agent\n");
    const result = answered(
      bdk(["export", "agents", "--host", "claude", "--out", "gen", "--json"], root),
      "output/export-agents.json",
    );
    expect(read(root, "gen/implementer.md")).toBe("v2 agent\n");
    expect((result.files as { path: string }[]).map((file) => file.path)).toEqual(
      ADAPTERS.map((name) => `gen/${name}.md`),
    );
  });

  it("input/invalid-argument: a host without a tool map", () => {
    const refusal = refused(
      bdk(["export", "agents", "--host", "gemini", "--json"], repository()),
      3,
      "input/invalid-argument",
    );
    expect(refusal.why).toContain("claude");
  });

  it("input/missing-argument: no --host", () => {
    refused(bdk(["export", "agents", "--json"], repository()), 3, "input/missing-argument");
  });
});
