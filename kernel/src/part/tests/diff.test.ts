// `kernel-loops`, Diff check: the classification of touched paths against a
// task, a part, the Change and a verifier (T22 design D-9).
import { describe, expect, it } from "vitest";

import { setChange, writePlanPart } from "../../graph/tests/support.ts";
import { CHANGE, ROOT } from "../../log/tests/support.ts";
import { memoryIndex, refreshChange, withIndex } from "../../shared/store/index.ts";
import type { PlanPartFile } from "../../shared/store/index.ts";
import { diffCheck } from "../index.ts";
import { classifyDiff } from "../use-cases/diff.ts";
import type { DiffFacts } from "../use-cases/diff.ts";
import { DIR, harness, tasks } from "./support.ts";

function part(
  id: string,
  files: Record<string, string[]>,
  doNotTouch: string[] = [],
): PlanPartFile {
  return {
    id,
    file: `plan/parts/${id}-part.md`,
    path: `/r/.bdk/changes/c/plan/parts/${id}-part.md`,
    bytes: 100,
    data: {
      id,
      title: `Part ${id}`,
      goal: "g",
      "success-measure": "m",
      "do-not-touch": doNotTouch,
      "depends-on": [],
      "spec-impact": "none",
    },
    body: "",
    tasks: Object.entries(files).map(([task, paths]) => ({
      id: task,
      title: task,
      files: paths.map((path) => ({ path })),
      dependsOn: [],
    })),
    problems: [],
  };
}

const parts = [
  part("02", { "02-3": ["src/auth/login.ts"], "02-4": ["src/auth/mail.ts"] }, ["src/billing/**"]),
  part("03", { "03-1": ["src/ui/"] }, ["docs/**"]),
];

function facts(touched: string[], fields: Partial<DiffFacts> = {}): DiffFacts {
  return { parts, started: new Set(["02"]), committed: new Set(), touched, ...fields };
}

describe("classifyDiff", () => {
  it("a task's declared path is declared, another path undeclared", () => {
    expect(
      classifyDiff({ task: "02-3" }, facts(["src/auth/login.ts", "src/auth/util.ts"])),
    ).toStrictEqual({
      touched: ["src/auth/login.ts", "src/auth/util.ts"],
      declared: ["src/auth/login.ts"],
      undeclared: ["src/auth/util.ts"],
    });
  });

  it("refuses a forbidden path naming the path and the glob", () => {
    expect(classifyDiff({ task: "02-3" }, facts(["src/billing/invoice.ts"]))).toMatchObject({
      refused: true,
      rule: "policy/do-not-touch",
      why: "src/billing/invoice.ts matches do-not-touch src/billing/** of part 02",
    });
  });

  it("a sibling's declared path is not flagged while the sibling is uncommitted", () => {
    const check = classifyDiff({ task: "02-3" }, facts(["src/auth/mail.ts"]));
    expect(check).toMatchObject({ undeclared: [], declared: [] });
  });

  it("leaves the uncommitted work of another started part to that part, even in do-not-touch", () => {
    const twoParts = [
      part("01", { "01-1": ["src/ui/format.ts"] }, ["src/api/**"]),
      part("02", { "02-1": ["src/api/http.ts"] }, ["src/ui/**"]),
    ];
    const both = { parts: twoParts, started: new Set(["01", "02"]) };
    const touched = ["src/api/http.ts", "src/ui/format.ts"];
    expect(classifyDiff({ task: "01-1" }, facts(touched, both))).toStrictEqual({
      touched,
      declared: ["src/ui/format.ts"],
      undeclared: [],
    });
    expect(
      classifyDiff({ task: "01-1" }, facts(touched, { ...both, committed: new Set(["02-1"]) })),
    ).toMatchObject({
      rule: "policy/do-not-touch",
      why: "src/api/http.ts matches do-not-touch src/api/** of part 01",
    });
  });

  it("a committed sibling's path is flagged", () => {
    const check = classifyDiff(
      { task: "02-3" },
      facts(["src/auth/mail.ts"], { committed: new Set(["02-4"]) }),
    );
    expect(check).toMatchObject({ undeclared: ["src/auth/mail.ts"] });
  });

  it("a path of a part that is not started is flagged", () => {
    expect(classifyDiff({ task: "02-3" }, facts(["src/ui/button.ts"]))).toMatchObject({
      undeclared: ["src/ui/button.ts"],
    });
  });

  it("a part target declares the union of its tasks' files", () => {
    expect(
      classifyDiff({ part: "02" }, facts(["src/auth/login.ts", "src/auth/mail.ts"])),
    ).toMatchObject({ declared: ["src/auth/login.ts", "src/auth/mail.ts"], undeclared: [] });
    expect(classifyDiff({ part: "02" }, facts(["src/billing/a.ts"]))).toMatchObject({
      rule: "policy/do-not-touch",
    });
  });

  it("the Change target forbids every started part's do-not-touch and declares nothing", () => {
    const started = new Set(["02", "03"]);
    expect(classifyDiff({ change: true }, facts(["docs/a.md"], { started }))).toMatchObject({
      rule: "policy/do-not-touch",
      why: "docs/a.md matches do-not-touch docs/** of part 03",
    });
    expect(
      classifyDiff({ change: true }, facts(["docs/a.md", "src/auth/login.ts", "x.ts"])),
    ).toStrictEqual({
      touched: ["docs/a.md", "src/auth/login.ts", "x.ts"],
      declared: [],
      undeclared: ["docs/a.md", "x.ts"],
    });
  });

  it("a verifier target is not checked", () => {
    expect(classifyDiff({ verifier: true }, facts(["src/billing/a.ts"]))).toStrictEqual({
      touched: [],
      declared: [],
      undeclared: [],
    });
  });
});

describe("diffCheck", () => {
  it("reads the working tree, leaves out .bdk/ and knows started parts and commits", async () => {
    const h = harness();
    setChange(h.store, { profile: "tiny" });
    writePlanPart(h.store, "01", { body: tasks("01", 2), doNotTouch: ["docs/**"] });
    await h.run(["done", "plan"]);
    await h.run(["part", "start", "01"]);
    h.git.status = [".bdk/changes/2026-09-25-login/log/x.md", "src/01-1.ts", "src/01-2.ts", "x.ts"];
    const check = await withIndex(memoryIndex, h.store, ROOT, (index) => {
      refreshChange(index, { id: CHANGE, dir: DIR, archived: false });
      return diffCheck(
        h,
        { id: CHANGE, dir: DIR, projectRoot: ROOT, branch: "feat/login" },
        index,
        {
          task: "01-1",
        },
      );
    });
    expect(check).toStrictEqual({
      touched: ["src/01-1.ts", "src/01-2.ts", "x.ts"],
      declared: ["src/01-1.ts"],
      undeclared: ["x.ts"],
    });
  });

  it("leaves out .gitignore while it differs from HEAD only by the kernel's ignored paths", async () => {
    const h = harness();
    setChange(h.store, { profile: "tiny" });
    writePlanPart(h.store, "01", { body: tasks("01", 1) });
    await h.run(["done", "plan"]);
    await h.run(["part", "start", "01"]);
    h.git.status = [".gitignore"];
    const check = () =>
      withIndex(memoryIndex, h.store, ROOT, (index) => {
        refreshChange(index, { id: CHANGE, dir: DIR, archived: false });
        const change = { id: CHANGE, dir: DIR, projectRoot: ROOT, branch: "feat/login" };
        return diffCheck(h, change, index, { task: "01-1" });
      });
    h.store.write(`${ROOT}/.gitignore`, "/.bdk/.machine/\n/.bdk/settings.local.yaml\n");
    expect(await check()).toMatchObject({ touched: [], undeclared: [] });
    h.store.write(`${ROOT}/.gitignore`, "/.bdk/.machine/\nnode_modules/\n");
    expect(await check()).toMatchObject({ undeclared: [".gitignore"] });
  });
});
