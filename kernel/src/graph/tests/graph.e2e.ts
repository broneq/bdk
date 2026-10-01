// `kernel-cli/graph` (T21 records) through the committed bundle in real
// repositories: one case per exit code and per declared rule of `next`,
// `explain`, `validate` and `done`, every output validated against its schema.
// `policy/spec-invalid` is covered with the spec fixtures in `spec/tests/spec.e2e.ts`.
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
import {
  done,
  opened,
  passGate,
  pastDesignGate,
  soon,
  taskBody,
  verdict,
  write,
  writeDesign,
  writePlanPart,
} from "./e2e-support.ts";

/** A `tests-scoped` pass manifest of the Change without citations, as no command writes it. */
function uncited(dir: string): string {
  const id = "E-uncited1";
  writeDocument(fileStore(), join(dir, `evidence/01-${id}.md`), {
    data: {
      schema: 1,
      id,
      kind: "tests-scoped",
      ticket: "A-00000001",
      target: "01",
      at: soon(),
      author: "BDK Test <test@example.com>",
      source: "agent:runner",
      "tree-hash": `sha256:${"0".repeat(64)}`,
      tree: [],
      files: [{ path: "out.json", hash: `sha256:${"1".repeat(64)}`, stored: "machine" }],
      verdict: "pass",
    },
    body: "",
  });
  return id;
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
      artifact: { id: "design-verify" },
    });
    verdict(dir, [], "design-verify");
    done(root, "design-verify");
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
      "design-verify",
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
    verdict(dir, [], "design-verify");
    done(root, "design-verify");
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

describe("a verifier round through the commands", () => {
  // The path verify-design runs: no fixture writes the report or its entry.
  it("exit 0: design-verify is done after ingest, log add report and attempt close", () => {
    const { root, dir } = opened();
    writeDesign(dir, "design");
    writeDesign(dir, "architecture");
    done(root, "design");
    done(root, "architecture");
    const opening = answered(
      bdk(["attempt", "open", "verifier", "design-verify", "--json"], root),
      "output/attempt-open.json",
    );
    const ticket = String(opening.ticket);
    const built = answered(
      bdk(["dispatch", "build", "design-verify", "design-verifier", ticket, "--json"], root),
      "output/dispatch-build.json",
    );
    refused(
      bdk(
        [
          "log",
          "add",
          "report",
          "design verified",
          "--ref",
          "design.md",
          "--ticket",
          ticket,
          "--json",
        ],
        root,
      ),
      3,
      "input/not-found",
    );
    const envelope = "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\nPASS\n";
    expect(
      bdk(["log", "ingest", "--ticket", ticket, "--json"], root, { stdin: envelope }).code,
    ).toBe(0);
    const added = answered(
      bdk(
        [
          "log",
          "add",
          "report",
          "design verified",
          "--ref",
          "design.md",
          "--ticket",
          ticket,
          "--json",
        ],
        root,
      ),
      "output/log-add.json",
    );
    expect(added).toMatchObject({
      entry: {
        source: "agent:design-verifier",
        refs: ["design.md", "design-verify"],
        report: String(built.report).slice(String(built.report).indexOf("reports/")),
      },
    });
    expect(
      bdk(["attempt", "close", ticket, "ok", "--envelope", String(built.report), "--json"], root)
        .code,
    ).toBe(0);
    expect(done(root, "design-verify")).toMatchObject({ state: "done" });
    expect(answered(bdk(["next", "--json"], root), "output/next.json")).toMatchObject({
      waiting: "gate",
    });
  });

  it("exit 2: a blocker the verifier raised on a design file keeps design-verify open", () => {
    const { root, dir } = opened();
    writeDesign(dir, "design");
    writeDesign(dir, "architecture");
    done(root, "design");
    done(root, "architecture");
    const opening = answered(
      bdk(["attempt", "open", "verifier", "design-verify", "--json"], root),
      "output/attempt-open.json",
    );
    const ticket = String(opening.ticket);
    bdk(["dispatch", "build", "design-verify", "design-verifier", ticket, "--json"], root);
    const blocker = answered(
      bdk(
        [
          "log",
          "add",
          "blocker",
          "the design names a class the code lacks",
          "--ref",
          "design.md",
          "--category",
          "false-code-claim",
          "--ticket",
          ticket,
          "--json",
        ],
        root,
      ),
      "output/log-add.json",
    );
    expect(blocker).toMatchObject({ entry: { refs: ["design.md", "design-verify"] } });
    const envelope =
      "---\nstatus: done-with-concerns\nfiles: []\nentries: []\nevidence: []\n---\nFAIL\n";
    expect(
      bdk(["log", "ingest", "--ticket", ticket, "--json"], root, { stdin: envelope }).code,
    ).toBe(0);
    expect(
      bdk(
        ["log", "add", "report", "one blocker", "--ref", "design-verify", "--ticket", ticket],
        root,
      ).code,
    ).toBe(0);
    refused(bdk(["done", "design-verify", "--json"], root), 2, "policy/validation-failed");
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

  it("exit 0: plan-verify on a verdict, stale after a plan part edit", () => {
    const { root, dir } = pastDesignGate();
    writePlanPart(dir, "01");
    done(root, "plan");
    verdict(dir);
    expect(done(root, "plan-verify")).toMatchObject({ artifact: "plan-verify", state: "done" });
    writePlanPart(dir, "01", { body: taskBody("01", "stores a hashed token") });
    const report = answered(bdk(["explain", "plan-verify", "--json"], root), "output/explain.json");
    expect(report).toMatchObject({ state: "stale" });
  });

  it("exit 2 policy/missing-citation: the verdict lists a pass without a citation", () => {
    const { root, dir } = pastDesignGate();
    writePlanPart(dir, "01");
    done(root, "plan");
    verdict(dir, [uncited(dir)]);
    refused(bdk(["done", "plan-verify", "--json"], root), 2, "policy/missing-citation");
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
