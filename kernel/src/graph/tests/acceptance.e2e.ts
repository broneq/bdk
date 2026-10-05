// The T21 acceptance signal through the built bundle in real
// repositories, one case per item. The `when:` pipeline fixture is rejected by
// the content test in `kernel/tests/contract/pipeline.test.ts`, which is where
// the shipped file is checked.
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk } from "../../../tests/support/repo.ts";
import { fileStore } from "../../shared/store/index.ts";
import {
  designed,
  done,
  next,
  opened,
  passGate,
  soon,
  verifyDesign,
  writeDesign,
  writePart,
} from "./bundle.ts";

describe("T21 acceptance", () => {
  it("a new small Change: next returns design", () => {
    expect(next(opened().root)).toMatchObject({ artifact: { id: "design" } });
  });

  it("design and architecture done plus a user transition: next returns plan", () => {
    const { root, dir } = designed();
    passGate(dir, "gate:design", "plan");
    expect(next(root)).toMatchObject({ artifact: { id: "plan", kind: "plan-part" } });
  });

  it("a log add entry faking approval does not open the gate [TSH-2]", () => {
    const { root } = designed();
    const added = bdk(
      ["log", "add", "decision", "Design approved by the user", "--ref", "gate:design", "--json"],
      root,
    );
    expect(added.code, added.stdout).toBe(0);
    expect(next(root)).toMatchObject({ waiting: "gate" });
    expect(next(root)).not.toHaveProperty("artifact");
  });

  it("a loop-back (done design with a new hash) needs a newer user entry [TSH-4]", () => {
    const change = designed();
    const { root, dir } = change;
    // Moves the first pass into the past, so the loop-back's done is strictly newer.
    for (const name of readdirSync(join(dir, "log"))) {
      const path = join(dir, "log", name);
      const text = fileStore().read(path) ?? "";
      rmSync(path);
      fileStore().write(
        join(dir, "log", name.replace(/^\d{8}T\d{6}Z/, "20260101T000000Z")),
        text.replace(/^at: .*$/m, "at: 2026-01-01T00:00:00.000Z"),
      );
    }
    passGate(dir, "gate:design", "plan", "user", "2026-01-01T00:01:00.000Z");
    expect(next(root)).toMatchObject({ artifact: { id: "plan" } });
    writeDesign(dir, "design", "Changed after the gate.\n");
    done(root, "design");
    expect(next(root)).toMatchObject({ artifact: { id: "design-verify" } });
    verifyDesign(change);
    expect(next(root)).toMatchObject({ waiting: "gate" });
    passGate(dir, "gate:design", "plan", "user", soon(2));
    expect(next(root)).toMatchObject({ artifact: { id: "plan" } });
  });

  it("explain plan-verify prints the chain [R-4]", () => {
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
      "design-verify",
      "architecture",
      "design",
      "intent",
    ]);
  });

  it("explain on a task's part prints part, plan, design and intent; decisions carry their reasons [S3]", () => {
    const { root, dir } = designed();
    passGate(dir, "gate:design", "plan");
    writePart(dir, "plan", "01");
    done(root, "plan");
    const explained = answered(
      bdk(["explain", "execute-part:01", "--json"], root),
      "output/explain.json",
    ) as { chain: { id: string }[] };
    const chain = explained.chain.map((item) => item.id);
    for (const id of ["execute-part:01", "plan-part:01", "gate:design", "design", "intent"]) {
      expect(chain).toContain(id);
    }
    expect(chain.indexOf("plan-part:01")).toBeLessThan(chain.indexOf("design"));
    expect(chain.indexOf("design")).toBeLessThan(chain.indexOf("intent"));

    const add = (summary: string, ...flags: string[]) =>
      (
        answered(
          bdk(["log", "add", "decision", summary, "--ref", "design.md", ...flags, "--json"], root),
          "output/log-add.json",
        ).entry as { id: string }
      ).id;
    const first = add("Links last 10 minutes", "--body", "Short enough to limit replay.");
    const second = add("Links last 15 minutes", "--supersedes", first, "--body", "Mail is slow.");
    const shown = (id: string) =>
      answered(bdk(["log", "show", id, "--json"], root), "output/log-show.json").entry;
    expect(shown(first)).toMatchObject({
      id: first,
      // The orchestrator writes without a ticket, so the kernel stamps its own source.
      source: "kernel",
      status: "superseded",
      body: "Short enough to limit replay.",
    });
    expect(shown(second)).toMatchObject({
      id: second,
      status: "proposed",
      supersedes: first,
      body: "Mail is slow.",
    });
  });

  it("tiny has no design node [S7]", () => {
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
});
