// The post-task step nodes through the graph commands (`kernel-pipeline`,
// Artifact kinds and Node states): state from the manifests on disk, the
// validator, and `bdk done` refused naming the command that records them.
import { describe, expect, it } from "vitest";

import { DIR, harness, setChange, writeEntry, writeManifest, writePlanPart } from "./support.ts";
import type { Harness } from "./support.ts";

const T0 = "2026-09-25T10:00:00.000Z";

/** A tiny Change with one plan part whose plan and execute part are done. */
async function executed(): Promise<Harness> {
  const h = harness();
  setChange(h.store, { profile: "tiny" });
  writePlanPart(h.store, "01");
  expect((await h.run(["done", "plan", "--json"], T0)).code).toBe(0);
  const part = (await h.run(["validate", "execute-part:01", "--json"], T0)).json as {
    inputHash: string;
  };
  writeEntry(h.store, {
    type: "transition",
    source: "kernel",
    to: "execute-part:01",
    at: T0,
    "input-hash": part.inputHash,
  });
  return h;
}

async function stateOf(h: Harness, id: string): Promise<string | undefined> {
  const status = (await h.run(["change", "status", "--json"])).json as {
    nodes: { id: string; state: string }[];
  };
  return status.nodes.find((node) => node.id === id)?.state;
}

describe("post-task step nodes through the commands", () => {
  it("refuses bdk done on a step, naming the command that records it", async () => {
    const h = await executed();
    for (const [id, command] of [
      ["tests-scoped:01", "bdk evidence record tests-scoped <file> --ticket <ticket>"],
      ["simplify:01", "bdk attempt close <ticket> ok"],
    ] as const) {
      const result = await h.run(["done", id, "--json"]);
      expect(result.code).toBe(2);
      expect(result.json).toMatchObject({ rule: "policy/invalid-transition", instead: [command] });
    }
  });

  it("is done from a fresh manifest and stale after a Files: path changes", async () => {
    const h = await executed();
    expect(await stateOf(h, "simplify:01")).toBe("ready");
    await writeManifest(h.store, "simplify", "01-1");
    expect(await stateOf(h, "simplify:01")).toBe("done");
    const valid = (await h.run(["validate", "simplify:01", "--json"])).json as {
      valid: boolean;
    };
    expect(valid.valid).toBe(true);

    h.store.write("/work/repo/src/part-01.ts", "export {};\n");
    expect(await stateOf(h, "simplify:01")).toBe("stale");
    const next = (await h.run(["next", "--json"])).json as { artifact: { id: string } };
    expect(next.artifact.id).toBe("simplify:01");
    const invalid = (await h.run(["validate", "simplify:01", "--json"])).json as {
      valid: boolean;
      checks: { id: string; ok: boolean }[];
    };
    expect(invalid.valid).toBe(false);
    expect(invalid.checks.find((check) => check.id === "fresh")?.ok).toBe(false);
  });

  it("stays done when a non-executable file changes", async () => {
    const h = await executed();
    writePlanPart(h.store, "01", {
      body: "## 01-1 Store the token\n\n**Files:**\n\n- Create: `src/part-01.ts`\n- Modify: `docs/login.md`\n\n**Test cases:**\n\n- stores a token\n",
    });
    await h.run(["done", "plan", "--json"], T0);
    await writeManifest(h.store, "lint", "01");
    h.store.write("/work/repo/docs/login.md", "# Login\n");
    expect(await stateOf(h, "lint:01")).toBe("done");
    expect(h.store.list(`${DIR}/evidence`)).toHaveLength(1);
  });
});
