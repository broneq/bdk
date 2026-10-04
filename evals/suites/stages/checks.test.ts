import { describe, expect, it } from "vitest";

import { checkExpectations, valuesAt } from "./checks.ts";
import type { KernelCall } from "./checks.ts";

const kernel =
  (answers: Record<string, KernelCall>) =>
  (args: string): KernelCall =>
    answers[args] ?? { code: 3, json: undefined };

describe("valuesAt", () => {
  it("follows dotted keys, array indexes and length", () => {
    const value = { changes: [{ branch: "feat/x" }], ok: true };
    expect(valuesAt(value, "changes.0.branch")).toStrictEqual(["feat/x"]);
    expect(valuesAt(value, "changes.length")).toStrictEqual([1]);
    expect(valuesAt(value, "missing.key")).toStrictEqual([undefined]);
  });

  it("gives one value per element for *", () => {
    const value = { items: [{ level: "not-a-problem" }, { level: "blocker" }] };
    expect(valuesAt(value, "items.*.level")).toStrictEqual(["not-a-problem", "blocker"]);
    expect(valuesAt({ items: [] }, "items.*.level")).toStrictEqual([]);
  });
});

describe("checkExpectations with *", () => {
  const list = {
    "log list": { code: 0, json: { items: [{ level: "not-a-problem" }, { level: "blocker" }] } },
  };

  it("passes when any element holds the value or matches the pattern", () => {
    const result = checkExpectations(
      [
        {
          run: "log list",
          json: { "items.*.level": "blocker" },
          match: { "items.*.level": "^not-" },
        },
      ],
      kernel(list),
      "",
    );
    expect(result).toStrictEqual({ pass: true, failures: [] });
  });

  it("names every value when none holds", () => {
    const result = checkExpectations(
      [{ run: "log list", json: { "items.*.level": "should-fix" } }],
      kernel(list),
      "",
    );
    expect(result.failures).toStrictEqual([
      'log list: items.*.level is ["not-a-problem","blocker"], expected "should-fix"',
    ]);
  });
});

describe("checkExpectations", () => {
  it("passes when every command answers as expected and the reply matches", () => {
    const result = checkExpectations(
      [
        { run: "doctor", json: { ok: true, layout: "v3" } },
        { run: "config check", exit: 0 },
        { reply: "/bdk:(design|plan)" },
      ],
      kernel({
        doctor: { code: 0, json: { ok: true, layout: "v3" } },
        "config check": { code: 0, json: { problems: [] } },
      }),
      "Next: type /bdk:design",
    );
    expect(result).toEqual({ pass: true, failures: [] });
  });

  it("takes null as an absent path", () => {
    const answers = kernel({ "attempt list": { code: 0, json: { items: [] } } });
    expect(
      checkExpectations([{ run: "attempt list", json: { budgets: null } }], answers, "").pass,
    ).toBe(true);
    expect(
      checkExpectations([{ run: "attempt list", json: { items: null } }], answers, "").pass,
    ).toBe(false);
  });

  it("names each failed expectation", () => {
    const result = checkExpectations(
      [
        { run: "doctor", json: { ok: true } },
        { run: "config check", exit: 0 },
        { reply: "policy/change-exists" },
      ],
      kernel({
        doctor: { code: 0, json: { ok: false } },
        "config check": { code: 2, json: {} },
      }),
      "done",
    );
    expect(result.pass).toBe(false);
    expect(result.failures).toEqual([
      "doctor: ok is false, expected true",
      "config check: exit 2, expected 0",
      "reply does not match /policy/change-exists/",
    ]);
  });

  it("matches string values against a pattern", () => {
    const call = { code: 0, json: { items: [{ branch: "feat/dark-mode" }] } };
    expect(
      checkExpectations(
        [{ run: "change list", match: { "items.0.branch": "^feat/" } }],
        kernel({ "change list": call }),
        "",
      ),
    ).toEqual({ pass: true, failures: [] });
    expect(
      checkExpectations(
        [{ run: "change list", match: { "items.0.branch": "^fix/" } }],
        kernel({ "change list": call }),
        "",
      ).failures,
    ).toEqual(['change list: items.0.branch is "feat/dark-mode", expected to match ^fix/']);
  });

  it("compares structured values by content", () => {
    const result = checkExpectations(
      [{ run: "config show languages", json: { value: ["typescript"] } }],
      kernel({ "config show languages": { code: 0, json: { value: ["typescript"] } } }),
      "",
    );
    expect(result.pass).toBe(true);
  });
});
