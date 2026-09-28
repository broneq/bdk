// Graph E2E fixtures through the committed bundle: a `small` feature Change
// walked to its design gate, plan parts in the task grammar, and a
// `plan-verify` verdict written as `log ingest` and the gate skill write them.
import { join } from "node:path";
import { expect } from "vitest";

import { answered, bdk, repository } from "../../../tests/support/repo.ts";
import { fileStore, secondStamp, writeDocument } from "../../shared/store/index.ts";

export interface Opened {
  readonly root: string;
  readonly dir: string;
}

/** A repository with an open `small` feature Change. */
export function opened(): Opened {
  const root = repository();
  const result = bdk(["change", "new", "Users log in with a one-time link", "--json"], root);
  expect(result.code, result.stdout).toBe(0);
  const id = (result.json as { change: string }).change;
  return { root, dir: join(root, ".bdk/changes", id) };
}

export function write(dir: string, path: string, text: string): void {
  fileStore().write(join(dir, path), text);
}

export function writeDesign(dir: string, name: "design" | "architecture", body = "Text.\n"): void {
  write(dir, `${name}.md`, `---\nschema: 1\ntitle: ${name}\n---\n${body}`);
}

/** One task `<nn>-1` in the plan task grammar. */
export function taskBody(nn: string, testCase = "stores a token"): string {
  return `## ${nn}-1 Store the token\n\n**Files:**\n\n- Create: \`src/part-${nn}.ts\`\n\n**Test cases:**\n\n- ${testCase}\n`;
}

export function writePlanPart(
  dir: string,
  nn: string,
  fields: { body?: string; doNotTouch?: string } = {},
): void {
  write(
    dir,
    `plan/parts/${nn}-part.md`,
    `---\nschema: 1\nid: "${nn}"\ntitle: Part ${nn}\ngoal: g\nsuccess-measure: m\ndo-not-touch: [${fields.doNotTouch ?? ""}]\ndepends-on: []\nspec-impact: none\n---\n${fields.body ?? taskBody(nn)}`,
  );
}

/** Seconds precision, one second ahead so the entry is never older than a `done` of this second. */
export function soon(): string {
  return new Date(Date.now() + 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** A `source: user` transition passing `gate`, the way the gate skill records it. */
export function passGate(dir: string, gate: string, to: string): void {
  const at = soon();
  const id = `L-u${String(Date.now() % 10_000_000).padStart(7, "0")}`;
  writeDocument(fileStore(), join(dir, `log/${secondStamp(at)}-transition-${id}.md`), {
    data: {
      schema: 1,
      id,
      type: "transition",
      summary: `${gate} passed`,
      status: "accepted",
      source: "user",
      author: "BDK Test <test@example.com>",
      at,
      refs: [gate],
      gate,
      to,
    },
    body: "",
  });
}

export function done(root: string, id: string): Record<string, unknown> {
  return answered(bdk(["done", id, "--json"], root), "output/done.json");
}

/** design and architecture done, gate:design passed by the user. */
export function pastDesignGate(): Opened {
  const change = opened();
  writeDesign(change.dir, "design");
  writeDesign(change.dir, "architecture");
  done(change.root, "design");
  done(change.root, "architecture");
  passGate(change.dir, "gate:design", "plan");
  return change;
}

/**
 * A passing `plan-verify` verdict listing `evidence`: the report file and the
 * `report` entry naming it, as `log ingest` writes them.
 */
export function verdict(dir: string, evidence: readonly string[] = []): void {
  const at = soon();
  const report = "reports/plan-verify-plan-verifier-A-00000001.md";
  writeDocument(fileStore(), join(dir, report), {
    data: {
      schema: 1,
      ticket: "A-00000001",
      role: "plan-verifier",
      status: "done",
      files: [],
      entries: [],
      evidence: [...evidence],
    },
    body: "PASS\n",
  });
  const id = `L-r${String(Date.now() % 10_000_000).padStart(7, "0")}`;
  writeDocument(fileStore(), join(dir, `log/${secondStamp(at)}-report-${id}.md`), {
    data: {
      schema: 1,
      id,
      type: "report",
      summary: "plan-verify passed",
      status: "accepted",
      source: "agent:plan-verifier",
      author: "BDK Test <test@example.com>",
      at,
      refs: ["plan-verify"],
      report,
    },
    body: "",
  });
}
