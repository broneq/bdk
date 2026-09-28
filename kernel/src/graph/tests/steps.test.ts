// `kernel-pipeline`, Artifact kinds and Node states (T23-D40, D51): the
// post-task step kinds on the shipped pipeline, done through the latest fresh
// evidence manifest covering their part, and paired by part.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { evaluate } from "../domain/engine.ts";
import type { Graph } from "../domain/engine.ts";
import { kindRegistry, PostTaskStepKind } from "../domain/kinds/index.ts";
import type { Kind } from "../domain/kinds/index.ts";
import type { Pipeline } from "../domain/pipeline.ts";
import { fakeHash, fakeView } from "./view.ts";
import type { ViewFixture } from "./view.ts";

const shipped = parse(
  readFileSync(join(import.meta.dirname, "../../../../pipeline/pipeline.yaml"), "utf8"),
) as Pipeline;

const PARTS = {
  "change.md": {},
  "plan/parts/01-auth.md": { data: { id: "01", "depends-on": [], "spec-impact": "none" } },
  "plan/parts/02-mail.md": { data: { id: "02", "depends-on": ["01"], "spec-impact": "none" } },
};

const TASKS = {
  "plan/parts/01-auth.md": { tasks: [{ id: "01-1", files: ["src/auth.ts"] }] },
  "plan/parts/02-mail.md": {
    tasks: [
      { id: "02-1", files: ["src/mail.ts"] },
      { id: "02-2", files: ["src/send.ts"] },
    ],
  },
};

let n = 0;
function done(to: string, hash: string) {
  n += 1;
  return { id: `L-d${String(n).padStart(7, "0")}`, type: "transition", to, inputHash: hash };
}

/** A tiny Change whose plan and both execute parts are done. */
const EXECUTED = [
  done("plan-part:01", "plan/parts/01-auth.md@1"),
  done("plan-part:02", "plan/parts/02-mail.md@1"),
  done("execute-part:01", "plan/parts/01-auth.md@1"),
  done("execute-part:02", "plan/parts/02-mail.md@1"),
];

function graph(fixture: ViewFixture = {}, pipeline = shipped, extra: Kind[] = []): Graph {
  return evaluate({
    pipeline,
    kinds: kindRegistry(extra),
    view: fakeView({
      profile: "tiny",
      files: PARTS,
      planParts: TASKS,
      entries: EXECUTED,
      ...fixture,
    }),
    features: {},
    gates: { design: "manual", review: "manual" },
    hash: fakeHash(),
  });
}

function manifest(id: string, kind: string, target: string, fields: object = {}) {
  return { id, kind, target, verdict: "pass", cited: true, ...fields };
}

describe("post-task step nodes", () => {
  it("registers the fifteen kinds, the three steps on one base", () => {
    const kinds = kindRegistry();
    expect(kinds.size).toBe(15);
    for (const name of ["simplify", "tests-scoped", "lint"]) {
      expect(kinds.get(name)).toBeInstanceOf(PostTaskStepKind);
    }
    expect(kinds.has("post-task-step")).toBe(false);
  });

  it("follow execute in pipeline order, one instance per plan part", () => {
    const ids = graph().nodes.map((node) => node.id);
    const at = (id: string) => ids.indexOf(id);
    expect(at("execute-part:01")).toBeLessThan(at("simplify"));
    expect(ids.slice(at("simplify"), at("spec-delta"))).toStrictEqual([
      "simplify",
      "simplify:01",
      "simplify:02",
      "tests-scoped",
      "tests-scoped:01",
      "tests-scoped:02",
      "lint",
      "lint:01",
      "lint:02",
    ]);
  });

  it("pair step instances by part; other instances require collections whole", () => {
    const result = graph();
    expect(result.find("simplify:02")?.requires).toStrictEqual(["execute-part:02"]);
    expect(result.find("tests-scoped:02")?.requires).toStrictEqual(["simplify:02"]);
    expect(result.find("lint:02")?.requires).toStrictEqual(["simplify:02"]);
    expect(result.find("execute-part:02")?.requires).toStrictEqual([
      "plan-part:01",
      "plan-part:02",
      "execute-part:01",
    ]);
    expect(result.find("review")?.requires).toStrictEqual(
      expect.arrayContaining([
        "tests-scoped:01",
        "tests-scoped:02",
        "lint:01",
        "lint:02",
        "simplify:01",
        "simplify:02",
      ]),
    );
  });

  it("is ready without evidence once its part's requirements are done", () => {
    const result = graph();
    expect(result.find("simplify:01")?.state).toBe("ready");
    expect(result.find("tests-scoped:01")?.state).toBe("blocked");
    expect(result.next?.id).toBe("simplify:01");
  });

  it("is done from the latest covering manifest when it is fresh and says pass or not-run", () => {
    const result = graph({
      evidence: [
        manifest("E-00000001", "simplify", "02-1", { fresh: false }),
        manifest("E-00000002", "simplify", "02-2"),
        manifest("E-00000003", "tests-scoped", "02-2", { verdict: "not-run", cited: false }),
      ],
    });
    expect(result.find("simplify:02")?.state).toBe("done");
    expect(result.find("tests-scoped:02")?.state).toBe("done");
    expect(result.find("simplify:01")?.state).toBe("ready");
  });

  it("is stale when the latest covering manifest is not fresh, and next returns it once its requirements are done", () => {
    const evidence = [
      manifest("E-00000001", "simplify", "01-1"),
      manifest("E-00000002", "simplify", "02-1"),
      manifest("E-00000004", "tests-scoped", "2026-09-25-login"),
      manifest("E-00000005", "lint", "01"),
      manifest("E-00000003", "lint", "02-2", { fresh: false }),
    ];
    const result = graph({ evidence });
    expect(result.find("lint:02")).toMatchObject({
      state: "stale",
      why: "evidence E-00000003 of 02-2 was recorded on another tree",
    });
    expect(result.next?.id).toBe("lint:02");

    const blocked = graph({ evidence: evidence.slice(4) });
    expect(blocked.find("lint:02")?.state).toBe("stale");
    expect(blocked.next?.id).toBe("simplify:01");
  });

  it("counts the fresh one of two manifests recorded in the same second as the later", () => {
    const result = graph({
      evidence: [
        manifest("E-00000001", "simplify", "01-1"),
        manifest("E-00000002", "simplify", "01-1", { fresh: false }),
        manifest("E-00000003", "simplify", "02-1", { at: "2026-09-25T10:00:00Z", fresh: false }),
        manifest("E-00000004", "simplify", "02-2", { at: "2026-09-25T10:00:01Z", fresh: false }),
      ],
    });
    expect(result.find("simplify:01")?.state).toBe("done");
    expect(result.find("simplify:02")?.state).toBe("stale");
  });

  it("is not done on a fresh fail", () => {
    const result = graph({
      evidence: [
        manifest("E-00000001", "simplify", "01"),
        manifest("E-00000002", "tests-scoped", "01-1", { verdict: "fail" }),
      ],
    });
    expect(result.find("tests-scoped:01")).toMatchObject({
      state: "ready",
      why: "evidence E-00000002 of 01-1 says fail",
    });
  });

  it("counts a manifest of the part or the Change, never one of another part or an artifact", () => {
    const result = graph({
      evidence: [
        manifest("E-00000001", "simplify", "2026-09-25-login"),
        manifest("E-00000002", "lint", "01"),
        manifest("E-00000003", "tests-scoped", "plan"),
      ],
    });
    expect(result.find("simplify:01")?.state).toBe("done");
    expect(result.find("simplify:02")?.state).toBe("done");
    expect(result.find("lint:01")?.state).toBe("done");
    expect(result.find("lint:02")?.state).toBe("ready");
    expect(result.find("tests-scoped:01")?.state).toBe("ready");
  });

  it("hashes the part's tree and validates the latest manifest", () => {
    const view = fakeView({
      files: PARTS,
      planParts: TASKS,
      partTrees: { "02": "sha256:part-02" },
      evidence: [manifest("E-00000002", "lint", "02-1", { fresh: false })],
    });
    const lint = kindRegistry().get("lint");
    expect(lint?.inputs(view, "02")).toStrictEqual({ tree: "sha256:part-02" });
    expect(lint?.inputs(view, "01")).toStrictEqual({ none: true });
    expect(lint?.validate(view, { id: "lint:02", nn: "02" })).toStrictEqual([
      { id: "evidence", ok: true, why: "E-00000002 of 02-1" },
      {
        id: "fresh",
        ok: false,
        why: "E-00000002 was recorded on another tree of 02-1",
        rule: "policy/stale-evidence",
        instead: "bdk evidence record lint <file> --ticket <ticket>",
      },
      { id: "verdict", ok: true, why: "pass" },
    ]);
    expect(lint?.validate(view, { id: "lint:01", nn: "01" })[0]).toMatchObject({
      id: "evidence",
      ok: false,
      why: "no lint manifest covers part 01",
    });
  });

  it("names its command as the way to done", () => {
    const kinds = kindRegistry();
    expect(kinds.get("simplify")?.doneBy).toStrictEqual({
      through: "evidence",
      command: "bdk attempt close <ticket> ok",
    });
    expect(kinds.get("tests-scoped")?.doneBy).toStrictEqual({
      through: "evidence",
      command: "bdk evidence record tests-scoped <file> --ticket <ticket>",
    });
  });

  it("takes a fake evidence kind on the step base (T23-D51)", () => {
    const pipeline: Pipeline = {
      ...shipped,
      nodes: shipped.nodes.flatMap((node) =>
        node.id === "execute"
          ? [
              node,
              {
                id: "contract-snapshot",
                kind: "contract-snapshot",
                stage: "execute",
                requires: ["execute"],
              },
            ]
          : [node],
      ),
    };
    const snapshot = new PostTaskStepKind(
      "contract-snapshot",
      "bdk evidence record contract-snapshot <file> --ticket <ticket>",
      "runner",
    );
    const at = (fields: object) =>
      graph({ evidence: [manifest("E-00000001", "contract-snapshot", "01-1", fields)] }, pipeline, [
        snapshot,
      ]).find("contract-snapshot:01")?.state;
    expect(at({ verdict: "not-run", cited: false })).toBe("done");
    expect(at({})).toBe("done");
    expect(at({ fresh: false })).toBe("stale");
    expect(graph({}, pipeline, [snapshot]).find("contract-snapshot:02")?.requires).toStrictEqual([
      "execute-part:02",
    ]);
  });
});

describe("verdict kinds check the evidence their report lists", () => {
  const report = { id: "L-r0000001", type: "report", refs: ["review"] };
  const view = (evidence: NonNullable<ViewFixture["evidence"]>, listed: string[]) =>
    fakeView({
      files: PARTS,
      entries: [report],
      reports: { [report.id]: "done" },
      reportEvidence: { [report.id]: listed },
      evidence,
    });
  const review = kindRegistry().get("review");

  it("passes when every listed id names a manifest and each pass is cited", () => {
    const checks = review?.validate(
      view([manifest("E-00000001", "tests-scoped", "2026-09-25-login")], ["E-00000001"]),
      { id: "review" },
    );
    expect(checks?.find((check) => check.id === "evidence")).toStrictEqual({
      id: "evidence",
      ok: true,
    });
  });

  it("fails on an id that names no manifest", () => {
    const checks = review?.validate(view([], ["E-zzzzzzzz"]), { id: "review" });
    expect(checks?.find((check) => check.id === "evidence")).toMatchObject({
      ok: false,
      why: "the report lists E-zzzzzzzz, which names no evidence manifest of the Change",
    });
  });

  it("answers policy/missing-citation for a listed pass without a citation", () => {
    const checks = review?.validate(
      view(
        [manifest("E-00000001", "tests-scoped", "2026-09-25-login", { cited: false })],
        ["E-00000001"],
      ),
      { id: "review" },
    );
    expect(checks?.find((check) => check.id === "evidence")).toMatchObject({
      ok: false,
      rule: "policy/missing-citation",
    });
  });
});

describe("a verdict for an older part hash", () => {
  it("leaves plan-verify stale after a plan part edit", () => {
    const hash = "plan/parts/01-auth.md@1,plan/parts/02-mail.md@1";
    const result = evaluate({
      pipeline: shipped,
      kinds: kindRegistry(),
      view: fakeView({ files: PARTS, planParts: TASKS, entries: [done("plan-verify", hash)] }),
      features: {},
      gates: { design: "manual", review: "manual" },
      hash: fakeHash({ "plan/parts/02-mail.md": "2" }),
    });
    expect(result.find("plan-verify")).toMatchObject({
      state: "stale",
      why: `inputs changed: recorded ${hash}, current plan/parts/01-auth.md@1,plan/parts/02-mail.md@2`,
    });
  });
});
