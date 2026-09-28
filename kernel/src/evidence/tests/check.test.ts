// `bdk evidence check` (`kernel-cli/evidence`; T23-D16, D45, D54): the latest
// manifest of each kind of a target, or one manifest by its `E-` id, against
// the current tree hash of its target.
import { describe, expect, it } from "vitest";

import { tasks } from "../../part/tests/support.ts";
import { treeOf } from "../use-cases/tree.ts";
import { ROOT, check, record, refusal, started, ticketOf } from "./support.ts";
import type { Harness } from "./support.ts";

interface Checked {
  fresh: boolean;
  treeHash: string;
  evidence: {
    evidence: string;
    kind: string;
    treeHash: string;
    fresh: boolean;
    verdict?: string;
    changedSince: string[];
  }[];
}

async function recorded(h: Harness, ticket: string, kind = "lint"): Promise<string> {
  h.put("lint.txt", "clean\n");
  const result = await record(h, kind, "lint.txt", "--ticket", ticket, "--verdict", "fail");
  expect(result.code, result.stdout).toBe(0);
  return (result.json as { evidence: string }).evidence;
}

async function checked(h: Harness, target: string): Promise<Checked> {
  const result = await check(h, target);
  expect(result.code, result.stdout).toBe(0);
  return result.json as Checked;
}

function treeHashOf(h: Harness, paths: string[]): string {
  return treeOf(paths, (path) => h.store.readBytes(`${ROOT}/${path}`)).treeHash;
}

describe("evidence check", () => {
  it("answers fresh for evidence recorded on the current tree", async () => {
    const h = await started();
    const id = await recorded(h, await ticketOf(h));
    const out = await checked(h, "01-1");
    expect(out).toStrictEqual({
      fresh: true,
      treeHash: treeHashOf(h, ["src/01-1.ts", "src/01-2.ts"]),
      evidence: [
        {
          evidence: id,
          kind: "lint",
          treeHash: out.treeHash,
          fresh: true,
          verdict: "fail",
          changedSince: [],
        },
      ],
    });
  });

  it("answers stale with the changed path when a sibling task's file changes", async () => {
    const h = await started();
    await recorded(h, await ticketOf(h));
    h.put("src/01-2.ts", "// changed\n");
    const out = await checked(h, "01-1");
    expect(out.fresh).toBe(false);
    expect(out.evidence[0]).toMatchObject({ fresh: false, changedSince: ["src/01-2.ts"] });
    expect(out.treeHash).not.toBe(out.evidence[0]?.treeHash);
  });

  it("keeps evidence fresh when only a non-executable Files: path changes", async () => {
    const body = `${tasks("01", 2)}\n## 01-3 Docs\n\n**Files:**\n\n- \`docs/login.md\`\n\n**Verification:** none\n`;
    const h = await started(body);
    h.put("docs/login.md", "# Login\n");
    await recorded(h, await ticketOf(h));
    h.put("docs/login.md", "# Login, reworded\n");
    expect((await checked(h, "01-1")).fresh).toBe(true);
  });

  it("makes evidence stale when a build-config file outside every Files: list changes", async () => {
    const h = await started();
    h.put("package.json", "{}\n");
    await recorded(h, await ticketOf(h));
    h.put("package.json", '{"private":true}\n');
    const out = await checked(h, "01-1");
    expect(out.fresh).toBe(false);
    expect(out.evidence[0]?.changedSince).toStrictEqual(["package.json"]);
  });

  it("names an added build-config file and a deleted source file", async () => {
    const h = await started();
    await recorded(h, await ticketOf(h));
    h.put("pnpm-lock.yaml", "lockfileVersion: 9\n");
    h.store.remove(`${ROOT}/src/01-1.ts`);
    const out = await checked(h, "01-1");
    expect(out.evidence[0]?.changedSince).toStrictEqual(["pnpm-lock.yaml", "src/01-1.ts"]);
  });

  it("answers not fresh with no evidence for a target nothing was recorded for", async () => {
    const h = await started();
    expect(await checked(h, "01-2")).toStrictEqual({
      fresh: false,
      treeHash: treeHashOf(h, ["src/01-1.ts", "src/01-2.ts"]),
      evidence: [],
    });
  });

  it("hashes a part over its tasks and the Change over every part", async () => {
    const h = await started();
    expect((await checked(h, "01")).treeHash).toBe(treeHashOf(h, ["src/01-1.ts", "src/01-2.ts"]));
    expect((await checked(h, "02")).treeHash).toBe(treeHashOf(h, ["src/02-1.ts"]));
    expect((await checked(h, "2026-09-25-login")).treeHash).toBe(
      treeHashOf(h, ["src/01-1.ts", "src/01-2.ts", "src/02-1.ts"]),
    );
  });

  it("checks the latest manifest of each kind", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    await recorded(h, ticket, "tests-scoped");
    h.put("src/01-1.ts", "// changed\n");
    const latest = await recorded(h, ticket, "tests-scoped");
    const lint = await recorded(h, ticket, "lint");
    const out = await checked(h, "01-1");
    expect(out.evidence.map((entry) => [entry.evidence, entry.kind])).toStrictEqual([
      [latest, "tests-scoped"],
      [lint, "lint"],
    ]);
    expect(out.fresh).toBe(true);
  });

  it("checks one manifest by its E- id", async () => {
    const h = await started();
    const ticket = await ticketOf(h);
    const first = await recorded(h, ticket, "tests-scoped");
    await recorded(h, ticket, "lint");
    h.put("src/01-1.ts", "// changed\n");
    const out = await checked(h, first);
    expect(out.evidence.map((entry) => entry.evidence)).toStrictEqual([first]);
    expect(out).toMatchObject({ fresh: false, evidence: [{ changedSince: ["src/01-1.ts"] }] });
  });

  it("refuses a target the Change does not hold and an unknown E- id with input/not-found", async () => {
    const h = await started();
    for (const target of ["09", "01-9", "E-zzzzzzzz"]) {
      const result = await check(h, target);
      expect(result.code).toBe(3);
      expect(refusal(result).rule).toBe("input/not-found");
    }
  });

  it("exits 2 with policy/stale-evidence in text mode, 0 when fresh", async () => {
    const h = await started();
    await recorded(h, await ticketOf(h));
    const fresh = await check(h, "01-1", false);
    expect(fresh.code).toBe(0);
    expect(fresh.stdout).toContain("fresh");
    h.put("src/01-2.ts", "// changed\n");
    const stale = await check(h, "01-1", false);
    expect(stale.code).toBe(2);
    expect(stale.stdout).toContain("policy/stale-evidence");
    expect(stale.stdout).toContain("src/01-2.ts");
  });
});
