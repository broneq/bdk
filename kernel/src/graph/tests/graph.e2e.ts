// `kernel-cli/graph` (T21 records) through the committed bundle in real
// repositories: one case per exit code and per declared rule of `next`,
// `explain`, `validate` and `done`, every output validated against its schema.
// Rules owned by later tasks stay untested here and land with their owners'
// cases: `policy/spec-invalid` (T30, the spec delta validator) and
// `policy/missing-citation` (T23, verdict citations).
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answered,
  bdk,
  outsideRepository,
  refused,
  repository,
} from "../../../tests/support/repo.ts";
import { fileStore, readDocument, writeDocument } from "../../shared/store/index.ts";

interface Opened {
  readonly root: string;
  readonly dir: string;
}

/** A repository with an open `small` feature Change. */
function opened(): Opened {
  const root = repository();
  const result = bdk(["change", "new", "Users log in with a one-time link", "--json"], root);
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

/** One task `<nn>-1` in the plan task grammar. */
function taskBody(nn: string, testCase = "stores a token"): string {
  return `## ${nn}-1 Store the token\n\n**Files:**\n\n- Create: \`src/part-${nn}.ts\`\n\n**Test cases:**\n\n- ${testCase}\n`;
}

function writePlanPart(
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
function soon(): string {
  return new Date(Date.now() + 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** A `source: user` transition passing `gate`, the way the gate skill records it. */
function passGate(dir: string, gate: string, to: string): void {
  const at = soon();
  const id = `L-u${String(Date.now() % 10_000_000).padStart(7, "0")}`;
  writeDocument(
    fileStore(),
    join(dir, `log/${at.replaceAll("-", "").replaceAll(":", "")}-transition-${id}.md`),
    {
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
    },
  );
}

function done(root: string, id: string): Record<string, unknown> {
  return answered(bdk(["done", id, "--json"], root), "output/done.json");
}

/** design and architecture done, gate:design passed by the user. */
function pastDesignGate(): Opened {
  const change = opened();
  writeDesign(change.dir, "design");
  writeDesign(change.dir, "architecture");
  done(change.root, "design");
  done(change.root, "architecture");
  passGate(change.dir, "gate:design", "plan");
  return change;
}

function transitions(dir: string): Record<string, unknown>[] {
  return readdirSync(join(dir, "log"))
    .filter((name) => name.includes("-transition-"))
    .map((name) => {
      const document = readDocument(fileStore(), join(dir, "log", name));
      if (document === undefined || !("data" in document)) throw new Error(name);
      return document.data;
    });
}

describe("bdk next", () => {
  it("exit 0: a new small Change returns design with its instruction", () => {
    const { root } = opened();
    const report = answered(bdk(["next", "--json"], root), "output/next.json");
    expect(report).toMatchObject({ artifact: { id: "design", state: "ready" }, stage: "intent" });
    const text = bdk(["next"], root);
    expect(text.code).toBe(0);
    expect(text.stdout).toMatch(/^# design \(design\)\n/);
    expect(text.stdout).toContain("## When finished");
  });

  it("exit 0: waits at the design gate, then returns plan after the user passes it", () => {
    const { root, dir } = opened();
    writeDesign(dir, "design");
    writeDesign(dir, "architecture");
    done(root, "design");
    done(root, "architecture");
    expect(answered(bdk(["next", "--json"], root), "output/next.json")).toMatchObject({
      waiting: "gate",
      gates: [
        { gate: "gate:design", ready: true, done: false, command: "/bdk:plan" },
        { gate: "gate:review" },
      ],
    });
    passGate(dir, "gate:design", "plan");
    expect(answered(bdk(["next", "--json"], root), "output/next.json")).toMatchObject({
      artifact: { id: "plan" },
      gates: [{ gate: "gate:design", done: true, passedBy: "user" }, { gate: "gate:review" }],
    });
  });

  it("exit 0: a parked Change waits for the user", () => {
    const { root } = opened();
    expect(bdk(["change", "park", "--option", "accept as debt", "--json"], root).code).toBe(0);
    expect(answered(bdk(["next", "--json"], root), "output/next.json")).toMatchObject({
      waiting: "user",
    });
  });

  it("exit 0: a STOP block without an active Change", () => {
    const result = bdk(["next"], repository());
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^BDK STOP: no active Change on branch feat\/login/);
  });

  it("exit 0: a STOP block for a state error", () => {
    const { root, dir } = opened();
    write(dir, "log/20260101T000000Z-finding-L-broken00.md", "---\nschema: 1\n---\n");
    const result = bdk(["next"], root);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^BDK STOP: /);
  });

  it("exit 0: a STOP block outside a repository", () => {
    const result = bdk(["next"], outsideRepository());
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^BDK STOP: /);
  });
});

describe("bdk explain", () => {
  it("exit 0: the chain of plan-verify, latest first", () => {
    const { root, dir } = pastDesignGate();
    writePlanPart(dir, "01");
    const report = answered(bdk(["explain", "plan-verify", "--json"], root), "output/explain.json");
    expect((report.chain as { id: string }[]).map((node) => node.id)).toStrictEqual([
      "plan-verify",
      "plan-part:01",
      "gate:design",
      "architecture",
      "design",
      "intent",
    ]);
  });

  it("exit 0: a node outside the variant is skipped", () => {
    const root = repository();
    bdk(["change", "new", "Fix the login typo", "--kind", "bug", "--json"], root);
    expect(
      answered(bdk(["explain", "design", "--json"], root), "output/explain.json"),
    ).toMatchObject({
      state: "skipped",
    });
  });

  it("exit 3 input/not-found", () => {
    const { root } = opened();
    refused(bdk(["explain", "plan-verfy", "--json"], root), 3, "input/not-found");
  });

  it("exit 2 policy/no-active-change", () => {
    refused(bdk(["explain", "design", "--json"], repository()), 2, "policy/no-active-change");
  });

  it("exit 4 state/change-dir-missing", () => {
    const { root, dir } = opened();
    rmSync(dir, { recursive: true });
    refused(bdk(["explain", "design", "--json"], root), 4, "state/change-dir-missing");
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(bdk(["explain", "design", "--json"], outsideRepository()), 5, "runtime/not-a-repo");
  });
});

describe("bdk validate", () => {
  it("exit 0: valid design, the hash, no write", () => {
    const { root, dir } = opened();
    writeDesign(dir, "design");
    const before = readdirSync(join(dir, "log"));
    const report = answered(bdk(["validate", "--json"], root), "output/validate.json");
    expect(report).toMatchObject({ artifact: "design", valid: true });
    expect(report.inputHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(readdirSync(join(dir, "log"))).toStrictEqual(before);
  });

  it("exit 0 valid: false under --json; exit 2 policy/validation-failed in text mode", () => {
    const { root } = opened();
    expect(
      answered(bdk(["validate", "design", "--json"], root), "output/validate.json"),
    ).toMatchObject({
      valid: false,
    });
    const text = bdk(["validate", "design"], root);
    expect(text.code).toBe(2);
    expect(text.stdout + text.stderr).toContain("policy/validation-failed");
  });

  it.each([
    ["policy/part-too-large", { body: `${taskBody("01")}\n${"x".repeat(8192)}\n` }],
    ["policy/part-too-many-tasks", { body: "No tasks yet.\n" }],
    ["policy/do-not-touch-overlap", { doNotTouch: '"src/**"' }],
    ["policy/placeholder", { body: taskBody("01", "TODO") }],
  ])("exit 2 %s in text mode; valid: false under --json", (rule, fields) => {
    const { root, dir } = opened();
    writePlanPart(dir, "01", fields);
    expect(
      answered(bdk(["validate", "plan-part:01", "--json"], root), "output/validate.json"),
    ).toMatchObject({ valid: false });
    const text = bdk(["validate", "plan-part:01"], root);
    expect(text.code).toBe(2);
    expect(text.stdout + text.stderr).toContain(rule);
  });

  it("exit 3 input/not-found: nothing is actionable", () => {
    const { root, dir } = opened();
    writeDesign(dir, "design");
    writeDesign(dir, "architecture");
    done(root, "design");
    done(root, "architecture");
    refused(bdk(["validate", "--json"], root), 3, "input/not-found");
  });

  it("exit 2 policy/no-active-change", () => {
    refused(bdk(["validate", "--json"], repository()), 2, "policy/no-active-change");
  });

  it("exit 4 state/ledger-invalid", () => {
    const { root, dir } = opened();
    write(dir, "log/20260101T000000Z-finding-L-broken00.md", "---\nschema: 1\n---\n");
    refused(bdk(["validate", "--json"], root), 4, "state/ledger-invalid");
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(bdk(["validate", "--json"], outsideRepository()), 5, "runtime/not-a-repo");
  });
});

describe("bdk done", () => {
  it("exit 0: records the hash, change status shows done, a re-run writes nothing", () => {
    const { root, dir } = opened();
    writeDesign(dir, "design");
    const report = done(root, "design");
    expect(report).toMatchObject({ artifact: "design", state: "done", next: "architecture" });
    expect(transitions(dir)).toStrictEqual([
      expect.objectContaining({
        to: "design",
        source: "kernel",
        "input-hash": report.inputHash,
        id: report.entry,
      }),
    ]);
    expect(done(root, "design")).toStrictEqual(report);
    expect(transitions(dir)).toHaveLength(1);
    writeDesign(dir, "design", "Edited.\n");
    expect(
      answered(bdk(["explain", "design", "--json"], root), "output/explain.json"),
    ).toMatchObject({
      state: "stale",
    });
  });

  it("exit 0: marks the plan parts and writes plan/index.md", () => {
    const { root, dir } = pastDesignGate();
    writePlanPart(dir, "01");
    writePlanPart(dir, "02");
    expect(done(root, "plan")).toMatchObject({ artifact: "plan", next: "plan-verify" });
    expect(fileStore().read(join(dir, "plan/index.md"))).toContain("| 02 |");
  });

  it("exit 3 input/not-found", () => {
    const { root } = opened();
    refused(bdk(["done", "plan-part:09", "--json"], root), 3, "input/not-found");
  });

  it("exit 2 policy/not-ready", () => {
    const { root } = opened();
    refused(bdk(["done", "architecture", "--json"], root), 2, "policy/not-ready");
  });

  it("exit 2 policy/validation-failed", () => {
    const { root } = opened();
    refused(bdk(["done", "design", "--json"], root), 2, "policy/validation-failed");
  });

  it("exit 2 policy/gate-not-ready", () => {
    const { root } = opened();
    refused(bdk(["done", "gate:design", "--json"], root), 2, "policy/gate-not-ready");
  });

  it("exit 2 policy/invalid-transition: execute-part:01 names bdk part done 01", () => {
    const { root, dir } = opened();
    writePlanPart(dir, "01");
    const refusal = refused(
      bdk(["done", "execute-part:01", "--json"], root),
      2,
      "policy/invalid-transition",
    );
    expect(refusal.instead).toContain("bdk part done 01");
  });

  it("exit 2 policy/no-active-change", () => {
    refused(bdk(["done", "design", "--json"], repository()), 2, "policy/no-active-change");
  });

  it("exit 4 state/ledger-invalid", () => {
    const { root, dir } = opened();
    writeDesign(dir, "design");
    write(dir, "log/20260101T000000Z-finding-L-broken00.md", "---\nschema: 1\n---\n");
    refused(bdk(["done", "design", "--json"], root), 4, "state/ledger-invalid");
  });

  it("exit 5 runtime/git-missing", () => {
    const { root, dir } = opened();
    writeDesign(dir, "design");
    refused(bdk(["done", "design", "--json"], root, { git: false }), 5, "runtime/git-missing");
  });
});
