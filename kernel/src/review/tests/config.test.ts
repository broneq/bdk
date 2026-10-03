// The review settings (`kernel-settings`, Keys of review policy): the group
// size of `review plan` and the risky areas the integration reviewer gets.
import { describe, expect, it } from "vitest";

import { dispatchConfig } from "../../dispatch/index.ts";
import { createConfigRegistry, promptsModule, resolveConfig } from "../../shared/config/index.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { reviewConfig } from "../index.ts";

const registry = createConfigRegistry({
  modules: [...reviewConfig.modules, ...dispatchConfig.modules, promptsModule],
  prompts: [],
});

function resolve(settings = "") {
  return resolveConfig({
    store: memoryStore(settings === "" ? {} : { "/repo/.bdk/settings.yaml": settings }),
    registry,
    globalDir: "/home/dev/.config/bdk",
    projectRoot: "/repo",
    pluginRoot: "/plugin",
  });
}

const DEFAULT_RISKS = ["auth", "migration", "secrets", "public-api", "dependencies"];

describe("review settings", () => {
  it("defaults to groups of 30 files and the five risks, each enabled", () => {
    const { value, problems } = resolve();
    expect(problems).toStrictEqual([]);
    const review = (value as { review: { group: { "max-files": number }; risks: unknown[] } })
      .review;
    expect(review.group["max-files"]).toBe(30);
    expect(review.risks.map((risk) => (risk as { id: string }).id)).toStrictEqual(DEFAULT_RISKS);
    for (const risk of review.risks) {
      expect((risk as { enabled: boolean }).enabled).toBe(true);
      expect((risk as { instruction: string }).instruction.length).toBeGreaterThan(0);
    }
  });

  it("merges a project risk by id, turns one off and appends a new one", () => {
    const { value, problems } = resolve(
      [
        "review:",
        "  risks:",
        "    - id: auth",
        '      instruction: "Any change under src/acl/ or to the Role enum"',
        "    - id: dependencies",
        "      enabled: false",
        "    - id: billing",
        '      instruction: "Anything that computes or stores a price"',
        "",
      ].join("\n"),
    );
    expect(problems).toStrictEqual([]);
    const risks = (value as { review: { risks: Record<string, unknown>[] } }).review.risks;
    expect(risks.map((risk) => risk.id)).toStrictEqual([...DEFAULT_RISKS, "billing"]);
    expect(risks[0]).toMatchObject({
      instruction: "Any change under src/acl/ or to the Role enum",
      enabled: true,
    });
    expect(risks[4]).toMatchObject({ enabled: false });
    expect(risks[5]).toMatchObject({ enabled: true });
  });

  it.each([
    ["review:\n  group:\n    max-files: 2\n", "review.group.max-files"],
    ["review:\n  group:\n    max-files: 201\n", "review.group.max-files"],
    ['review:\n  risks:\n    - id: Auth\n      instruction: "x"\n', "review.risks.Auth.id"],
    [
      'review:\n  risks:\n    - id: new-one\n      instruction: ""\n',
      "review.risks.new-one.instruction",
    ],
    ["review:\n  risks:\n    - id: new-one\n", "review.risks.new-one.instruction"],
  ])("refuses %j naming %s", (settings, key) => {
    expect(resolve(settings).problems.map((problem) => [problem.key, problem.rule])).toStrictEqual([
      [key, "policy/config-invalid"],
    ]);
  });

  it("refuses an instruction over 500 characters", () => {
    const long = "x".repeat(501);
    const problems = resolve(
      `review:\n  risks:\n    - id: auth\n      instruction: "${long}"\n`,
    ).problems;
    expect(problems.map((problem) => problem.key)).toStrictEqual(["review.risks.auth.instruction"]);
  });
});
