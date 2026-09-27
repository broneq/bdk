// `kernel-pipeline`, Artifact kinds: the registry and each kind's files,
// inputs, applicability, instances, validator and done path.
import { describe, expect, it } from "vitest";

import { DESIGN_LIMIT_BYTES, kindRegistry } from "../domain/kinds/index.ts";
import type { Kind } from "../domain/kinds/index.ts";
import { fakeView } from "./view.ts";
import type { ViewFixture } from "./view.ts";

const kinds = kindRegistry();

function kind(name: string): Kind {
  const found = kinds.get(name);
  if (found === undefined) throw new Error(`no kind ${name}`);
  return found;
}

const planParts = {
  "plan/parts/01-auth.md": { data: { id: "01", "depends-on": [], "spec-impact": "none" } },
  "plan/parts/02-mail.md": { data: { id: "02", "depends-on": ["01"], "spec-impact": ["auth"] } },
  "plan/parts/notes.txt": {},
};

describe("the kind registry", () => {
  it("holds exactly the thirteen kinds", () => {
    expect([...kinds.keys()].sort()).toStrictEqual(
      [
        "architecture",
        "close",
        "design",
        "design-index",
        "design-part",
        "execute-part",
        "gate",
        "intent",
        "plan-part",
        "plan-verify",
        "post-task-step",
        "review",
        "spec-delta",
      ].sort(),
    );
  });

  it("takes extra kinds", () => {
    const extra = { ...kind("design"), name: "fake" } as Kind;
    expect(kindRegistry([extra]).get("fake")).toBe(extra);
  });
});

describe("files and hash inputs", () => {
  const view = fakeView({ files: planParts });

  it.each([
    ["intent", undefined, ["change.md"], { files: ["change.md"] }],
    ["design", undefined, ["design.md"], { files: ["design.md"] }],
    ["architecture", undefined, ["architecture.md"], { files: ["architecture.md"] }],
    ["plan-part", "02", ["plan/parts/02-mail.md"], { files: ["plan/parts/02-mail.md"] }],
    ["plan-part", undefined, ["plan/parts/<nn>-<slug>.md"], { files: [] }],
    ["plan-verify", undefined, [], { files: ["plan/parts/01-auth.md", "plan/parts/02-mail.md"] }],
    ["review", undefined, [], { codeTree: true }],
    ["gate", undefined, [], { none: true }],
    ["execute-part", "01", [], { none: true }],
    ["close", undefined, [], { none: true }],
    ["post-task-step", undefined, [], { none: true }],
    ["design-part", "07", ["design/parts/07-<slug>.md"], { files: [] }],
  ])("%s %s", (name, nn, writes, inputs) => {
    expect(kind(name).writes(view, nn)).toStrictEqual(writes);
    expect(kind(name).inputs(view, nn)).toStrictEqual(inputs);
  });

  it("design-index hashes every design part, spec-delta every delta", () => {
    const parts = fakeView({
      files: {
        "design/parts/01-a.md": {},
        "design/parts/02-b.md": {},
        "spec-delta/auth.md": {},
      },
    });
    expect(kind("design-index").inputs(parts)).toStrictEqual({
      files: ["design/parts/01-a.md", "design/parts/02-b.md"],
    });
    expect(kind("design-index").writes(parts)).toStrictEqual(["design/index.md"]);
    expect(kind("spec-delta").inputs(parts)).toStrictEqual({ files: ["spec-delta/auth.md"] });
    expect(kind("spec-delta").writes(parts)).toStrictEqual(["spec-delta/auth.md"]);
    expect(kind("spec-delta").writes(fakeView())).toStrictEqual(["spec-delta/<capability>.md"]);
  });
});

describe("the baseline validator", () => {
  const checks = (files: NonNullable<ViewFixture["files"]>) =>
    kind("design").validate(fakeView({ files }), { id: "design" });

  it("fails a missing file", () => {
    expect(checks({})).toStrictEqual([{ id: "exists", ok: false, why: "design.md is missing" }]);
  });

  it("fails an empty file", () => {
    expect(checks({ "design.md": { blank: true } })).toContainEqual({
      id: "non-empty",
      ok: false,
      why: "design.md has no content",
    });
  });

  it("fails a schema-invalid file", () => {
    expect(checks({ "design.md": { invalid: "title is required" } })).toContainEqual({
      id: "schema",
      ok: false,
      why: "title is required",
    });
  });

  it("fails design.md over 12 KB with check size", () => {
    const failed = checks({ "design.md": { bytes: DESIGN_LIMIT_BYTES + 1 } }).find(
      (check) => !check.ok,
    );
    expect(failed).toMatchObject({ id: "size", why: "design.md is 12289 bytes, over 12288" });
    expect(failed?.instead).toContain("design/parts/");
  });

  it("passes a valid file", () => {
    expect(checks({ "design.md": { bytes: DESIGN_LIMIT_BYTES } }).every((c) => c.ok)).toBe(true);
  });

  it("checks every part of design-index and every delta of spec-delta", () => {
    expect(kind("design-index").validate(fakeView(), { id: "design-index" })).toStrictEqual([
      { id: "parts", ok: false, why: "design/parts/ holds no design part" },
    ]);
    const view = fakeView({ files: { "design/parts/01-a.md": { blank: true } } });
    expect(kind("design-index").validate(view, { id: "design-index" })).toContainEqual({
      id: "non-empty:design/parts/01-a.md",
      ok: false,
      why: "design/parts/01-a.md has no content",
    });
    expect(kind("spec-delta").validate(fakeView(), { id: "spec-delta" })[0]).toMatchObject({
      id: "exists",
      ok: false,
    });
    const deltas = fakeView({ files: { "spec-delta/auth.md": {} } });
    expect(
      kind("spec-delta")
        .validate(deltas, { id: "spec-delta" })
        .every((c) => c.ok),
    ).toBe(true);
    expect(
      kind("intent").validate(fakeView({ files: { "change.md": {} } }), { id: "intent" }),
    ).toHaveLength(3);
  });

  it("fails a part that does not exist", () => {
    expect(kind("plan-part").validate(fakeView(), { id: "plan-part:03", nn: "03" })).toStrictEqual([
      { id: "exists", ok: false, why: "plan/parts/ holds no part 03" },
    ]);
  });

  it("has no checks for the kinds done elsewhere", () => {
    for (const name of ["gate", "execute-part", "post-task-step", "close"]) {
      expect(kind(name).validate(fakeView(), { id: name })).toStrictEqual([]);
    }
  });
});

describe("applicability", () => {
  it("architecture is skipped for tiny and for architecture: false", () => {
    expect(kind("architecture").skip?.(fakeView({ profile: "tiny" }))).toBe(
      "profile tiny has no architecture",
    );
    const productOnly = fakeView({ files: { "design.md": { data: { architecture: false } } } });
    expect(kind("architecture").skip?.(productOnly)).toContain("architecture: false");
    expect(kind("architecture").skip?.(fakeView({ profile: "large" }))).toBeUndefined();
  });

  it("spec-delta applies only when a plan part declares spec-impact", () => {
    expect(kind("spec-delta").skip?.(fakeView({ files: planParts }))).toBeUndefined();
    const none = fakeView({
      files: { "plan/parts/01-auth.md": planParts["plan/parts/01-auth.md"] },
    });
    expect(kind("spec-delta").skip?.(none)).toBe("no plan part declares spec-impact");
  });

  it("the other kinds always apply", () => {
    expect("skip" in kind("design")).toBe(false);
  });
});

describe("instances", () => {
  it("one per part file, in id order", () => {
    const view = fakeView({
      files: { ...planParts, "design/parts/02-b.md": {}, "design/parts/01-a.md": {} },
    });
    expect(kind("plan-part").instances?.(view)).toStrictEqual([
      { nn: "01", requires: [] },
      { nn: "02", requires: [] },
    ]);
    expect(
      kind("design-part")
        .instances?.(view)
        .map((i) => i.nn),
    ).toStrictEqual(["01", "02"]);
  });

  it("execute-part follows depends-on", () => {
    expect(kind("execute-part").instances?.(fakeView({ files: planParts }))).toStrictEqual([
      { nn: "01", requires: [] },
      { nn: "02", requires: ["execute-part:01"] },
    ]);
  });

  it("the other kinds have none", () => {
    expect("instances" in kind("design")).toBe(false);
  });
});

describe("verdict kinds", () => {
  const report = (status: string | undefined, extra = {}) =>
    fakeView({
      entries: [{ id: "L-r0000001", type: "report", refs: ["plan-verify"], ...extra }],
      reports: status === undefined ? {} : { "L-r0000001": status },
    });

  it.each(["plan-verify", "review"])("%s needs a report naming it", (name) => {
    expect(kind(name).validate(fakeView(), { id: name })[0]).toMatchObject({
      id: "verdict",
      ok: false,
      why: `no report entry names ${name}`,
    });
  });

  it.each(["done", "done-with-concerns"])("passes with status %s", (status) => {
    expect(kind("plan-verify").validate(report(status), { id: "plan-verify" })).toStrictEqual([
      { id: "verdict", ok: true },
      { id: "blockers", ok: true },
    ]);
  });

  it("fails with another status or an unreadable report", () => {
    expect(
      kind("plan-verify").validate(report("blocked"), { id: "plan-verify" })[0]?.why,
    ).toContain("status blocked");
    expect(
      kind("plan-verify").validate(report(undefined), { id: "plan-verify" })[0]?.why,
    ).toContain("unreadable");
  });

  it("fails with a live blocker naming the node, not a resolved one", () => {
    const view = (status: string) =>
      fakeView({
        entries: [
          { id: "L-r0000001", type: "report", refs: ["review"] },
          { id: "L-b0000001", type: "blocker", refs: ["review"], status },
        ],
        reports: { "L-r0000001": "done" },
      });
    expect(kind("review").validate(view("proposed"), { id: "review" })[1]).toMatchObject({
      id: "blockers",
      ok: false,
    });
    expect(kind("review").validate(view("resolved"), { id: "review" })[1]).toStrictEqual({
      id: "blockers",
      ok: true,
    });
  });
});

describe("doneBy", () => {
  it.each([
    ["intent", { through: "construction" }],
    ["design", { through: "done" }],
    ["gate", { through: "gate" }],
    ["execute-part", { through: "command", command: "bdk part done {nn}" }],
    ["post-task-step", { through: "command", command: "the post-task step runner (T23)" }],
    ["close", { through: "command", command: "bdk change close" }],
  ])("%s", (name, doneBy) => {
    expect(kind(name).doneBy).toStrictEqual(doneBy);
  });
});
