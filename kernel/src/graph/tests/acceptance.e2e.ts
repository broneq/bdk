// The T21 acceptance signal through the committed bundle in real
// repositories, one case per item. The `when:` pipeline fixture is rejected by
// the content test in `kernel/tests/contract/pipeline.test.ts`, which is where
// the shipped file is checked.
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, repository } from "../../../tests/support/repo.ts";
import { BUNDLE, REPO_ROOT } from "../../../tests/support/run.ts";
import { fileStore, writeDocument } from "../../shared/store/index.ts";

interface Opened {
  readonly root: string;
  readonly dir: string;
}

function opened(...flags: string[]): Opened {
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

function writeDesign(dir: string, name: "design" | "architecture", body = "Text.\n"): void {
  write(dir, `${name}.md`, `---\nschema: 1\ntitle: ${name}\n---\n${body}`);
}

function writePart(dir: string, where: "plan" | "design", nn: string): void {
  const fields =
    where === "plan"
      ? "goal: g\nsuccess-measure: m\ndo-not-touch: []\ndepends-on: []\nspec-impact: none\n"
      : "depends-on: []\n";
  write(
    dir,
    `${where}/parts/${nn}-part.md`,
    `---\nschema: 1\nid: "${nn}"\ntitle: Part ${nn}\n${fields}---\nText.\n`,
  );
}

let serial = 0;

/** An entry file stamped `at`, the way a skill or a hook writes it. */
function entry(dir: string, at: string, fields: Record<string, unknown>): void {
  serial += 1;
  const id = `L-a${String(serial).padStart(7, "0")}`;
  const type = String(fields.type);
  writeDocument(
    fileStore(),
    join(dir, `log/${at.replaceAll("-", "").replaceAll(":", "")}-${type}-${id}.md`),
    {
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
    },
  );
}

/** One second ahead, so the entry is never older than a `done` of this second. */
function soon(seconds = 1): string {
  return new Date(Date.now() + seconds * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function passGate(dir: string, gate: string, to: string, source = "user", at = soon()): void {
  entry(dir, at, { type: "transition", source, gate, to, refs: [gate] });
}

/**
 * Backdates `dir` and everything below it past the index's 2 s racy-time
 * guard, the state a session's `next` meets long after the files were written.
 */
function settle(dir: string): void {
  const past = new Date(Date.now() - 60_000);
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) settle(path);
    else utimesSync(path, past, past);
  }
  utimesSync(dir, past, past);
}

function next(root: string): Record<string, unknown> {
  return answered(bdk(["next", "--json"], root), "output/next.json");
}

function done(root: string, id: string): Record<string, unknown> {
  return answered(bdk(["done", id, "--json"], root), "output/done.json");
}

/** design and architecture done on a new small Change. */
function designed(): Opened {
  const change = opened();
  writeDesign(change.dir, "design");
  writeDesign(change.dir, "architecture");
  done(change.root, "design");
  done(change.root, "architecture");
  return change;
}

describe("T21 acceptance", () => {
  it("a new small Change: next returns design", () => {
    expect(next(opened().root)).toMatchObject({ artifact: { id: "design" } });
  });

  it("design and architecture done plus a user transition: next returns plan", () => {
    const { root, dir } = designed();
    passGate(dir, "gate:design", "plan");
    expect(next(root)).toMatchObject({ artifact: { id: "plan", kind: "plan-part" } });
  });

  it("a log add entry faking approval does not open the gate", () => {
    const { root } = designed();
    const added = bdk(
      ["log", "add", "decision", "Design approved by the user", "--ref", "gate:design", "--json"],
      root,
    );
    expect(added.code, added.stdout).toBe(0);
    expect(next(root)).toMatchObject({ waiting: "gate" });
    expect(next(root)).not.toHaveProperty("artifact");
  });

  it("a loop-back (done design with a new hash) needs a newer user entry", () => {
    const { root, dir } = designed();
    // Moves the first pass into the past, so the loop-back's done is strictly newer.
    for (const name of readdirSync(join(dir, "log"))) {
      const path = join(dir, "log", name);
      const text = fileStore().read(path) ?? "";
      rmSync(path);
      fileStore().write(
        join(dir, "log", name.replace(/^\d{8}T\d{6}Z/, "20260101T000000Z")),
        text.replace(/^at: .*$/m, "at: 2026-01-01T00:00:00Z"),
      );
    }
    passGate(dir, "gate:design", "plan", "user", "2026-01-01T00:01:00Z");
    expect(next(root)).toMatchObject({ artifact: { id: "plan" } });
    writeDesign(dir, "design", "Changed after the gate.\n");
    done(root, "design");
    expect(next(root)).toMatchObject({ waiting: "gate" });
    passGate(dir, "gate:design", "plan", "user", soon(2));
    expect(next(root)).toMatchObject({ artifact: { id: "plan" } });
  });

  it("explain plan-verify prints the chain", () => {
    const { root, dir } = designed();
    passGate(dir, "gate:design", "plan");
    writePart(dir, "plan", "01");
    const text = bdk(["explain", "plan-verify"], root);
    expect(text.code).toBe(0);
    const chain = text.stdout
      .split("\n")
      .slice(1)
      .flatMap((line) => /^ {2}(\S+) \[/.exec(line)?.[1] ?? []);
    expect(chain).toStrictEqual([
      "plan-verify",
      "plan-part:01",
      "gate:design",
      "architecture",
      "design",
      "intent",
    ]);
  });

  it("tiny has no design node", () => {
    const { root } = opened("--profile", "tiny", "--reason", "a typo");
    expect(
      answered(bdk(["explain", "design", "--json"], root), "output/explain.json"),
    ).toMatchObject({
      state: "skipped",
    });
    expect(next(root)).toMatchObject({ artifact: { id: "plan" } });
  });

  it("large has design-part nodes and next returns architecture before plan", () => {
    const { root, dir } = opened("--profile", "large", "--reason", "spans auth and mail");
    writePart(dir, "design", "01");
    writePart(dir, "design", "02");
    expect(next(root)).toMatchObject({ artifact: { id: "design-part:01", kind: "design-part" } });
    done(root, "design-parts");
    done(root, "design-index");
    expect(next(root)).toMatchObject({ artifact: { id: "architecture" } });
  });

  it("bug goes from intent to plan", () => {
    const { root } = opened("--kind", "bug");
    expect(next(root)).toMatchObject({ artifact: { id: "plan", kind: "plan-part" } });
  });

  it("policy.gates.design auto passes the gate with a policy entry, manual does not", () => {
    const { root, dir } = designed();
    passGate(dir, "gate:design", "plan", "policy");
    expect(next(root)).toMatchObject({ waiting: "gate" });
    const set = bdk(["config", "set", "policy.gates.design", "auto"], root);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    expect(next(root)).toMatchObject({
      artifact: { id: "plan" },
      gates: [{ gate: "gate:design", done: true, passedBy: "policy" }, { gate: "gate:review" }],
    });
  });

  it("next p95 is under 150 ms on 8 plan parts and 1 000 entries", () => {
    const { root, dir } = designed();
    passGate(dir, "gate:design", "plan");
    for (let nn = 1; nn <= 8; nn++) writePart(dir, "plan", `0${String(nn)}`);
    done(root, "plan");
    for (let i = 0; i < 1000; i++) {
      entry(dir, "2026-09-25T10:00:00Z", {
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
