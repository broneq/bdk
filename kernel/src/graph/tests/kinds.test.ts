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
  it("holds exactly the eighteen kinds", () => {
    expect([...kinds.keys()].sort()).toStrictEqual(
      [
        "architecture",
        "close",
        "design",
        "design-verify",
        "design-index",
        "design-part",
        "execute-part",
        "gate",
        "intent",
        "plan-part",
        "plan-verify",
        "simplify",
        "tests-scoped",
        "lint",
        "tests-full",
        "lint-full",
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
    ["tests-full", undefined, ["evidence/2026-09-25-login-<evidenceId>.md"], { none: true }],
    ["design-verify", undefined, [], { files: [] }],
    ["gate", undefined, [], { none: true }],
    ["execute-part", "01", [], { files: ["plan/parts/01-auth.md"] }],
    ["close", undefined, [], { none: true }],
    ["lint", "01", ["evidence/01-<evidenceId>.md"], { none: true }],
    ["design-part", "07", ["design/parts/07-<slug>.md"], { files: [] }],
  ])("%s %s", (name, nn, writes, inputs) => {
    expect(kind(name).writes(view, nn)).toStrictEqual(writes);
    expect(kind(name).inputs(view, nn)).toStrictEqual(inputs);
  });

  it("design-verify hashes the design files that exist", () => {
    const design = fakeView({
      files: {
        "design.md": {},
        "architecture.md": {},
        "design/parts/01-auth.md": {},
        "design/parts/02-mail.md": {},
        "design/index.md": {},
      },
    });
    expect(kind("design-verify").inputs(design)).toStrictEqual({
      files: ["design.md", "architecture.md", "design/parts/01-auth.md", "design/parts/02-mail.md"],
    });
  });

  it("plan-verify hashes the plan parts and every spec delta", () => {
    const plan = fakeView({
      files: { ...planParts, "spec-delta/auth.md": {}, "spec-delta/mail/send.md": {} },
    });
    expect(kind("plan-verify").inputs(plan)).toStrictEqual({
      files: [
        "plan/parts/01-auth.md",
        "plan/parts/02-mail.md",
        "spec-delta/auth.md",
        "spec-delta/mail/send.md",
      ],
    });
  });

  it("spec-delta lists nested deltas and fails delta:<capability> with policy/spec-invalid", () => {
    const view = fakeView({
      files: { "spec-delta/auth/login.md": {}, "spec-delta/mail.md": {} },
      specProblems: { "auth/login": ["p:3 when-missing: w", "p:9 scenario-lost: s"] },
    });
    expect(kind("spec-delta").inputs(view)).toStrictEqual({
      files: ["spec-delta/auth/login.md", "spec-delta/mail.md"],
    });
    const failed = kind("spec-delta")
      .validate(view, { id: "spec-delta" })
      .filter((check) => !check.ok);
    expect(failed).toStrictEqual([
      {
        id: "delta:auth/login",
        ok: false,
        why: "p:3 when-missing: w; p:9 scenario-lost: s",
        rule: "policy/spec-invalid",
        instead: "bdk spec delta check auth/login",
      },
    ]);
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
      kind("spec-delta")
        .validate(deltas, { id: "spec-delta" })
        .map((check) => check.id),
    ).toContain("delta:auth");
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
    for (const name of ["gate", "close"]) {
      expect(kind(name).validate(fakeView(), { id: name })).toStrictEqual([]);
    }
  });
});

describe("plan part checks", () => {
  const PART = "plan/parts/02-mail.md";
  const data = { id: "02", "depends-on": [], "do-not-touch": [], "spec-impact": "none" };

  function checks(fixture: ViewFixture) {
    return kind("plan-part").validate(fakeView(fixture), { id: "plan-part:02", nn: "02" });
  }

  function check(fixture: ViewFixture, id: string) {
    return checks(fixture).find((found) => found.id === id);
  }

  it("runs every check in order on a valid part", () => {
    expect(checks({ files: { [PART]: { data } } })).toStrictEqual(
      [
        "exists",
        "non-empty",
        "schema",
        "size",
        "tasks",
        "do-not-touch",
        "placeholder",
        "grammar",
        "spec-impact",
        "isolation",
      ].map((id) => ({ id, ok: true })),
    );
  });

  it("size passes at 8 192 bytes and fails at 8 193", () => {
    expect(check({ files: { [PART]: { data, bytes: 8192 } } }, "size")).toStrictEqual({
      id: "size",
      ok: true,
    });
    expect(check({ files: { [PART]: { data, bytes: 8193 } } }, "size")).toStrictEqual({
      id: "size",
      ok: false,
      why: `${PART} is 8193 bytes, over the limit of 8192`,
      rule: "policy/part-too-large",
      instead: "bdk part split 02 <task-ids>",
    });
  });

  it("tasks fails with no task and with nine", () => {
    const none = check(
      { files: { [PART]: { data } }, planParts: { [PART]: { tasks: [] } } },
      "tasks",
    );
    expect(none).toMatchObject({ ok: false, rule: "policy/part-too-many-tasks" });
    expect(none?.why).toBe(`${PART} holds no task`);
    const nine = Array.from({ length: 9 }, (_, at) => ({ id: `02-${String(at + 1)}`, files: [] }));
    const many = check(
      { files: { [PART]: { data } }, planParts: { [PART]: { tasks: nine } } },
      "tasks",
    );
    expect(many).toMatchObject({ ok: false, rule: "policy/part-too-many-tasks" });
    expect(many?.why).toBe(`${PART} holds 9 tasks, over the limit of 8`);
    const eight = { [PART]: { tasks: nine.slice(0, 8) } };
    expect(check({ files: { [PART]: { data } }, planParts: eight }, "tasks")?.ok).toBe(true);
  });

  it("do-not-touch names the task, the path and the glob", () => {
    const overlaps = [{ task: "02-1", path: "src/legacy/a.ts", glob: "src/legacy/**" }];
    expect(
      check({ files: { [PART]: { data } }, planParts: { [PART]: { overlaps } } }, "do-not-touch"),
    ).toMatchObject({
      ok: false,
      why: "task 02-1 declares src/legacy/a.ts, which do-not-touch src/legacy/** forbids",
      rule: "policy/do-not-touch-overlap",
    });
  });

  it("placeholder names the fields", () => {
    const placeholders = ["task 02-1 **Test cases:** item 2", "goal"];
    expect(
      check(
        { files: { [PART]: { data } }, planParts: { [PART]: { placeholders } } },
        "placeholder",
      ),
    ).toMatchObject({
      ok: false,
      why: "a placeholder holds task 02-1 **Test cases:** item 2, goal",
      rule: "policy/placeholder",
    });
  });

  it("grammar lists the problems with the default rule", () => {
    const problems = ["task 02-1 has no **Files:** list", "task id 02-1 appears twice"];
    const found = check(
      { files: { [PART]: { data } }, planParts: { [PART]: { problems } } },
      "grammar",
    );
    expect(found).toStrictEqual({
      id: "grammar",
      ok: false,
      why: "task 02-1 has no **Files:** list; task id 02-1 appears twice",
    });
  });

  it("spec-impact needs spec-delta/<capability>.md", () => {
    const impact = { ...data, "spec-impact": ["auth", "kernel-cli/part"] };
    expect(
      check({ files: { [PART]: { data: impact }, "spec-delta/auth.md": {} } }, "spec-impact"),
    ).toStrictEqual({
      id: "spec-impact",
      ok: false,
      why: "spec-impact names kernel-cli/part, but spec-delta/kernel-cli/part.md is missing",
    });
    const both = {
      [PART]: { data: impact },
      "spec-delta/auth.md": {},
      "spec-delta/kernel-cli/part.md": {},
    };
    expect(check({ files: both }, "spec-impact")?.ok).toBe(true);
  });

  it("spec-impact fails a delta that fails spec delta check, naming its problems", () => {
    const impact = { ...data, "spec-impact": ["auth/login"] };
    const problem =
      '.bdk/changes/2026-09-25-login/spec-delta/auth/login.md:7 then-missing: scenario "x" has no "- **THEN**" bullet';
    expect(
      check(
        {
          files: { [PART]: { data: impact }, "spec-delta/auth/login.md": {} },
          specProblems: { "auth/login": [problem] },
        },
        "spec-impact",
      ),
    ).toStrictEqual({
      id: "spec-impact",
      ok: false,
      why: `spec-impact names auth/login, whose delta fails spec delta check: ${problem}`,
      instead: "bdk spec delta check auth/login",
    });
  });

  it("an absent spec-impact passes in small and tiny, fails in large", () => {
    const absent = Object.fromEntries(
      Object.entries(data).filter(([key]) => key !== "spec-impact"),
    );
    for (const profile of ["tiny", "small"] as const) {
      expect(check({ profile, files: { [PART]: { data: absent } } }, "spec-impact")?.ok).toBe(true);
    }
    expect(
      check({ profile: "large", files: { [PART]: { data: absent } } }, "spec-impact"),
    ).toStrictEqual({
      id: "spec-impact",
      ok: false,
      why: "a large Change must declare spec-impact: none or the capabilities the part changes",
      instead: "add spec-impact to the frontmatter of plan/parts/02-mail.md",
    });
  });

  it("isolation fails a worktree part without a reason", () => {
    const worktree = { ...data, isolation: "worktree" };
    expect(check({ files: { [PART]: { data: worktree } } }, "isolation")).toStrictEqual({
      id: "isolation",
      ok: false,
      why: "isolation: worktree needs an isolation-reason naming the state outside Files: the part shares",
      instead: `add isolation-reason to the frontmatter of ${PART}`,
    });
    const blank = { ...worktree, "isolation-reason": "  " };
    expect(check({ files: { [PART]: { data: blank } } }, "isolation")?.ok).toBe(false);
    const reasoned = { ...worktree, "isolation-reason": "both regenerate pnpm-lock.yaml" };
    expect(check({ files: { [PART]: { data: reasoned } } }, "isolation")?.ok).toBe(true);
  });

  it("an invalid frontmatter keeps the baseline and the size checks only", () => {
    expect(
      checks({ files: { [PART]: { invalid: "id: required" } } }).map((found) => found.id),
    ).toStrictEqual(["exists", "non-empty", "schema", "size"]);
  });
});

describe("execute-part checks", () => {
  const files = { "plan/parts/02-mail.md": { data: { id: "02", "depends-on": [] } } };
  const planParts = {
    "plan/parts/02-mail.md": {
      tasks: [
        { id: "02-1", files: ["src/a.ts"] },
        { id: "02-2", files: ["src/b.ts"] },
      ],
    },
  };
  const started = [{ id: "L-s0000001", type: "transition", to: "execute-part:02" }];

  function checks(fixture: ViewFixture) {
    return kind("execute-part").validate(fakeView({ files, planParts, ...fixture }), {
      id: "execute-part:02",
      nn: "02",
    });
  }

  it("passes when started, every task committed and no ticket open", () => {
    const work = {
      commits: [
        { commit: "a".repeat(40), part: "02", task: "02-1" },
        { commit: "b".repeat(40), part: "02", task: "02-2" },
      ],
      openTickets: [{ ticket: "A-7h3k9m2p", target: "03-1" }],
    };
    expect(checks({ entries: started, work })).toStrictEqual([
      { id: "started", ok: true },
      { id: "commits", ok: true },
      { id: "tickets", ok: true },
    ]);
  });

  it("names a task without a trailer commit and an open ticket", () => {
    const work = {
      commits: [
        { commit: "a".repeat(40), part: "02", task: "02-1" },
        { commit: "c".repeat(40), part: "05", task: "02-2" },
      ],
      openTickets: [{ ticket: "A-7h3k9m2p", target: "02-2" }],
    };
    expect(checks({ entries: started, work })).toStrictEqual([
      { id: "started", ok: true },
      {
        id: "commits",
        ok: false,
        why: "task 02-2 has no commit carrying BDK-Part: 02 and BDK-Task: 02-2",
        instead: "bdk commit 02-2",
      },
      {
        id: "tickets",
        ok: false,
        why: "ticket A-7h3k9m2p is open on 02-2",
        instead: "bdk attempt close A-7h3k9m2p <outcome>",
      },
    ]);
  });

  it("an open ticket on the part itself fails too", () => {
    const work = { commits: [], openTickets: [{ ticket: "A-7h3k9m2p", target: "02" }] };
    expect(checks({ entries: started, work }).find((c) => c.id === "tickets")?.ok).toBe(false);
  });

  it("fails started without a start marker", () => {
    const work = { commits: [], openTickets: [] };
    expect(checks({ work })[0]).toStrictEqual({
      id: "started",
      ok: false,
      why: "execute-part:02 is not started",
      instead: "bdk part start 02",
    });
  });

  it("fails without the work facts", () => {
    expect(checks({ entries: started }).at(-1)).toStrictEqual({
      id: "work",
      ok: false,
      why: "the trailer commits and open tickets were not read",
    });
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

  it.each(["design-verify", "plan-verify", "review"])("%s needs a report naming it", (name) => {
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
      { id: "fresh", ok: true },
      { id: "evidence", ok: true },
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
    const blockers = (status: string) =>
      kind("review")
        .validate(view(status), { id: "review" })
        .find((check) => check.id === "blockers");
    expect(blockers("proposed")).toMatchObject({ id: "blockers", ok: false });
    expect(blockers("resolved")).toStrictEqual({ id: "blockers", ok: true });
  });
});

describe("the fresh check of the verdict kinds", () => {
  const view = (doneAt: string, to = "design", node = "design-verify") =>
    fakeView({
      entries: [
        { id: "L-d0000001", type: "transition", to: "design", at: "2026-09-25T09:00:00.000Z" },
        { id: "L-r0000001", type: "report", refs: [node], at: "2026-09-25T10:00:00.100Z" },
        { id: "L-d0000002", type: "transition", to, at: doneAt },
      ],
      reports: { "L-r0000001": "done" },
    });
  const target = { id: "design-verify", requires: ["design", "architecture"] };
  const fresh = (checks: { id: string }[]) => checks.find((check) => check.id === "fresh");

  it.each(["design-verify", "plan-verify", "review"])(
    "%s fails when a required node was done after the report",
    (name) => {
      expect(
        fresh(
          kind(name).validate(view("2026-09-25T10:00:05.000Z", "design", name), {
            ...target,
            id: name,
          }),
        ),
      ).toMatchObject({
        ok: false,
        why: "the latest report L-r0000001 is older than L-d0000002, the done entry of design",
        instead: `run the verifier of ${name} again: a newer passing report must name it`,
      });
    },
  );

  it("passes on a done entry of the report's second", () => {
    expect(
      fresh(kind("design-verify").validate(view("2026-09-25T10:00:00.900Z"), target)),
    ).toStrictEqual({
      id: "fresh",
      ok: true,
    });
  });

  it("ignores a later done entry of a node it does not require", () => {
    expect(
      fresh(
        kind("design-verify").validate(view("2026-09-25T11:00:00.000Z", "plan-part:01"), target),
      ),
    ).toStrictEqual({ id: "fresh", ok: true });
  });
});

describe("doneBy", () => {
  it.each([
    ["intent", { through: "construction" }],
    ["design", { through: "done" }],
    ["gate", { through: "gate" }],
    ["execute-part", { through: "command", command: "bdk part done {nn}" }],
    ["simplify", { through: "evidence", command: "bdk attempt close <ticket> ok" }],
    ["lint", { through: "evidence", command: "bdk evidence record lint <file> --ticket <ticket>" }],
    ["close", { through: "command", command: "bdk change close" }],
  ])("%s", (name, doneBy) => {
    expect(kind(name).doneBy).toStrictEqual(doneBy);
  });
});
