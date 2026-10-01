// Real repositories for the bundle-driven graph tests: a Change opened with
// `bdk change new`, its artifacts and ledger entries written the way a skill
// or a hook writes them.
import { readdirSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

import { answered, bdk, repository } from "../../../tests/support/repo.ts";
import { secondStamp, fileStore, writeDocument } from "../../shared/store/index.ts";

export interface Opened {
  readonly root: string;
  readonly dir: string;
}

export function opened(...flags: string[]): Opened {
  const root = repository();
  const result = bdk(
    ["change", "new", "Users log in with a one-time link", ...flags, "--json"],
    root,
  );
  expect(result.code, result.stdout).toBe(0);
  const id = (result.json as { change: string }).change;
  return { root, dir: join(root, ".bdk/changes", id) };
}

function write(dir: string, path: string, text: string): void {
  fileStore().write(join(dir, path), text);
}

export function writeDesign(dir: string, name: "design" | "architecture", body = "Text.\n"): void {
  write(dir, `${name}.md`, `---\nschema: 1\ntitle: ${name}\n---\n${body}`);
}

export function writePart(dir: string, where: "plan" | "design", nn: string): void {
  const fields =
    where === "plan"
      ? "goal: g\nsuccess-measure: m\ndo-not-touch: []\ndepends-on: []\nspec-impact: none\n"
      : "depends-on: []\n";
  const body =
    where === "plan"
      ? `## ${nn}-1 Store the token\n\n**Files:**\n\n- \`src/part-${nn}.ts\`\n\n**Test cases:**\n\n- stores a token\n`
      : "Text.\n";
  write(
    dir,
    `${where}/parts/${nn}-part.md`,
    `---\nschema: 1\nid: "${nn}"\ntitle: Part ${nn}\n${fields}---\n${body}`,
  );
}

let serial = 0;

/** An entry file stamped `at`, the way a skill or a hook writes it. */
export function entry(dir: string, at: string, fields: Record<string, unknown>): void {
  serial += 1;
  const id = `L-a${String(serial).padStart(7, "0")}`;
  const type = String(fields.type);
  writeDocument(fileStore(), join(dir, `log/${secondStamp(at)}-${type}-${id}.md`), {
    data: {
      schema: 1,
      id,
      summary: `${type} fixture`,
      status: "accepted",
      source: "user",
      author: "BDK Test <test@example.com>",
      at,
      refs: ["change.md"],
      ...fields,
    },
    body: "",
  });
}

/** One second ahead, so the entry is never older than a `done` of this second. */
export function soon(seconds = 1): string {
  return new Date(Date.now() + seconds * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function passGate(
  dir: string,
  gate: string,
  to: string,
  source = "user",
  at = soon(),
): void {
  entry(dir, at, { type: "transition", source, gate, to, refs: [gate] });
}

/**
 * Backdates `dir` and everything below it past the index's 2 s racy-time
 * guard, the state a session's `next` meets long after the files were written.
 */
export function settle(dir: string): void {
  const past = new Date(Date.now() - 60_000);
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) settle(path);
    else utimesSync(path, past, past);
  }
  utimesSync(dir, past, past);
}

export function next(root: string): Record<string, unknown> {
  return answered(bdk(["next", "--json"], root), "output/next.json");
}

export function done(root: string, id: string): Record<string, unknown> {
  return answered(bdk(["done", id, "--json"], root), "output/done.json");
}

let tickets = 0;

/** A passing design-verifier report naming `design-verify`, then `bdk done design-verify`. */
export function verifyDesign(change: Opened, at = new Date().toISOString()): void {
  tickets += 1;
  const ticket = `A-${String(tickets).padStart(8, "0")}`;
  const report = `reports/design-verify-design-verifier-${ticket}.md`;
  write(
    change.dir,
    report,
    `---\nschema: 1\nticket: ${ticket}\nrole: design-verifier\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\nPASS\n`,
  );
  entry(change.dir, at, {
    type: "report",
    source: "agent:design-verifier",
    refs: ["design-verify"],
    report,
  });
  done(change.root, "design-verify");
}

/** design, architecture and design-verify done on a new small Change. */
export function designed(): Opened {
  const change = opened();
  writeDesign(change.dir, "design");
  writeDesign(change.dir, "architecture");
  done(change.root, "design");
  done(change.root, "architecture");
  verifyDesign(change);
  return change;
}
