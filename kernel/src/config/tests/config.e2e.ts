// `kernel-cli/config` through the committed bundle: every exit code and rule
// the four records declare, the acceptance scenarios of T12 and the JSON
// Schemas. The global layer lives in the fixture (XDG_CONFIG_HOME), so the
// machine's own settings never leak into a case.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { afterEach, describe, expect, it } from "vitest";

import { createFixture } from "../../../tests/support/fixture.ts";
import type { Fixture } from "../../../tests/support/fixture.ts";
import { REPO_ROOT, runBdk } from "../../../tests/support/run.ts";
import { validatorFor } from "../../../tests/support/schemas.ts";

const validShow = validatorFor("output/config-show.json");
const validCheck = validatorFor("output/config-check.json");
const validSchema = validatorFor("output/config-schema.json");
const validSet = validatorFor("output/config-set.json");
const validRefusal = validatorFor("common/refusal.json");

const VERSION = (
  JSON.parse(readFileSync(join(REPO_ROOT, ".claude-plugin/plugin.json"), "utf8")) as {
    version: string;
  }
).version;
const URL = `https://raw.githubusercontent.com/broneq/bdk/v${VERSION}/schema/settings.json`;
const MODELINE = `# yaml-language-server: $schema=${URL}`;
const GLOBAL = "xdg/bdk/settings.yaml";

const fixtures: Fixture[] = [];
function fixture(files: Record<string, string> = {}, git = true): Fixture {
  const created = createFixture({ files, git });
  fixtures.push(created);
  return created;
}
afterEach(() => {
  for (const created of fixtures.splice(0)) created.remove();
});

function bdk(args: readonly string[], root: string) {
  const env = { ...process.env, XDG_CONFIG_HOME: join(root, "xdg"), HOME: root } as Record<
    string,
    string
  >;
  return runBdk(args, root, { env });
}

function refused(result: ReturnType<typeof bdk>, code: number, rule: string) {
  expect(result.code).toBe(code);
  expect(validRefusal(result.json), JSON.stringify(validRefusal.errors)).toBe(true);
  expect(result.json).toMatchObject({ rule });
  return result.json as { why: string; instead: string[] };
}

const TOOLS = `${MODELINE}
tools:
  test:
    - id: unit
      tier: fast
      command: pnpm test:unit
      when: before every commit
`;

describe("bdk config show", () => {
  it("exit 0: the example run validates against config-show.json", () => {
    const root = fixture({
      ".bdk/settings.yaml": TOOLS,
      ".bdk/settings.local.yaml": `${MODELINE}\ntools:\n  test:\n    - id: unit\n      scoped: pnpm vitest run {files}\n`,
    }).root;
    const result = bdk(["config", "show", "tools.test", "--origins", "--json"], root);
    expect(result.code).toBe(0);
    expect(validShow(result.json), JSON.stringify(validShow.errors)).toBe(true);
    expect(result.json).toMatchObject({
      key: "tools.test",
      origins: { "tools.test.unit.tier": "project", "tools.test.unit.scoped": "local" },
    });
  });

  it("exit 0: text mode prints the tool list as YAML with its when text", () => {
    const result = bdk(
      ["config", "show", "tools.test"],
      fixture({ ".bdk/settings.yaml": TOOLS }).root,
    );
    expect(result.code).toBe(0);
    expect(parse(result.stdout)).toStrictEqual([
      { id: "unit", command: "pnpm test:unit", when: "before every commit", tier: "fast" },
    ]);
  });

  it("exit 0: a prompt value is its files and mode", () => {
    const root = fixture({
      ".bdk/prompts/rules/security.md": "---\nmode: replace\n---\n- x\n",
    }).root;
    const result = bdk(["config", "show", "prompts.rules/security", "--json"], root);
    expect(result.code).toBe(0);
    expect(result.json).toMatchObject({
      value: {
        mode: "replace",
        files: [{ layer: "project", path: ".bdk/prompts/rules/security.md" }],
      },
    });
  });

  it("exit 0: a project fragment with mode replace is the fragment's only file", () => {
    const root = fixture({
      ".bdk/prompts/fragments/decision/ask-user.md": "---\nmode: replace\n---\nOurs.\n",
    }).root;
    const result = bdk(["config", "show", "prompts.fragments/decision/ask-user", "--json"], root);
    expect(result.code).toBe(0);
    expect(result.json).toMatchObject({
      value: {
        mode: "replace",
        files: [{ layer: "project", path: ".bdk/prompts/fragments/decision/ask-user.md" }],
      },
    });
  });

  it("exit 3: input/not-found", () => {
    refused(bdk(["config", "show", "prompts.dir", "--json"], fixture().root), 3, "input/not-found");
  });

  it("exit 2: policy/unknown-config-key", () => {
    refused(
      bdk(["config", "show", "tools.tests", "--json"], fixture().root),
      2,
      "policy/unknown-config-key",
    );
  });

  it("exit 2: policy/config-invalid", () => {
    const root = fixture({ ".bdk/settings.yaml": "features:\n  lavish: maybe\n" }).root;
    refused(bdk(["config", "show", "--json"], root), 2, "policy/config-invalid");
  });

  it("exit 3: input/unknown-flag", () => {
    refused(bdk(["config", "show", "--bogus", "--json"], fixture().root), 3, "input/unknown-flag");
  });

  it("exit 5: runtime/not-a-repo", () => {
    refused(bdk(["config", "show", "--json"], fixture({}, false).root), 5, "runtime/not-a-repo");
  });
});

describe("bdk config check", () => {
  it("exit 0: the example run validates against config-check.json", () => {
    const root = fixture({
      ".bdk/settings.yaml": `${MODELINE}\nlanguages: [go]\n`,
      ".bdk/settings.local.yaml": "features:\n  lavish: false\n",
    }).root;
    const result = bdk(["config", "check", "--json"], root);
    expect(result.code).toBe(0);
    expect(validCheck(result.json), JSON.stringify(validCheck.errors)).toBe(true);
    expect(result.json).toStrictEqual({
      problems: [
        {
          layer: "local",
          path: ".bdk/settings.local.yaml",
          code: "missing-modeline",
          message: "no yaml-language-server modeline; bdk doctor --fix adds it",
        },
      ],
      snapshot: ".bdk/.machine/config/resolved.yaml",
      overriddenKeys: ["features.lavish"],
    });
  });

  it("acceptance: config layering with unknown key", () => {
    const root = fixture({
      [GLOBAL]: `${MODELINE}\nfeatures:\n  lavish: false\n`,
      ".bdk/settings.yaml": `${MODELINE}\ntools:\n  tests: []\n`,
    }).root;
    const refusal = refused(
      bdk(["config", "check", "--json"], root),
      2,
      "policy/unknown-config-key",
    );
    expect(refusal.why).toContain("tools.tests");
    expect(refusal.why).toContain("project");
    expect(refusal.why).toContain(".bdk/settings.yaml");
    expect(refusal.why).toContain("did you mean tools.test?");
  });

  it("acceptance: key of a later task", () => {
    const root = fixture({ ".bdk/settings.yaml": "policy:\n  gates:\n    design: true\n" }).root;
    const refusal = refused(
      bdk(["config", "check", "--json"], root),
      2,
      "policy/unknown-config-key",
    );
    expect(refusal.why).toContain("policy.gates.design");
    expect(refusal.why).toContain("T21");
  });

  it("acceptance: local override visible in the snapshot", () => {
    const root = fixture({
      ".bdk/settings.yaml": `${MODELINE}\nlanguages: [go]\n`,
      ".bdk/settings.local.yaml": `${MODELINE}\nfeatures:\n  lavish: false\n`,
    }).root;
    expect(bdk(["config", "check"], root).code).toBe(0);
    const snapshot = parse(
      readFileSync(join(root, ".bdk/.machine/config/resolved.yaml"), "utf8"),
    ) as { resolved: { features: { lavish: boolean } }; overriddenKeys: string[] };
    expect(snapshot.resolved.features.lavish).toBe(false);
    expect(snapshot.overriddenKeys).toStrictEqual(["features.lavish"]);
    expect(
      JSON.parse(readFileSync(join(root, ".bdk/.machine/schema/settings.json"), "utf8")),
    ).toStrictEqual(JSON.parse(readFileSync(join(REPO_ROOT, "schema/settings.json"), "utf8")));
  });

  it("exit 0: a v2 settings file is a legacy-settings warning", () => {
    const root = fixture({ ".bdk/settings.json": "{}" }).root;
    const result = bdk(["config", "check", "--json"], root);
    expect(result.code).toBe(0);
    expect(result.json).toMatchObject({
      problems: [{ code: "legacy-settings", path: ".bdk/settings.json" }],
    });
  });

  it("exit 0: a project without .bdk/ gets nothing written", () => {
    const root = fixture().root;
    expect(bdk(["config", "check", "--json"], root).json).toStrictEqual({
      problems: [],
      overriddenKeys: [],
    });
    expect(bdk(["config", "check"], root).stdout).toBe("settings valid\n");
  });

  it("exit 2: policy/config-invalid names key, layer and file", () => {
    const root = fixture({ [GLOBAL]: "languages: go\n" }).root;
    const refusal = refused(bdk(["config", "check", "--json"], root), 2, "policy/config-invalid");
    expect(refusal.why).toMatch(/^languages in the global layer \(.*xdg\/bdk\/settings\.yaml\): /);
  });

  it("exit 2: a file that is not YAML", () => {
    const root = fixture({ ".bdk/settings.yaml": "a: [\n" }).root;
    const refusal = refused(bdk(["config", "check", "--json"], root), 2, "policy/config-invalid");
    expect(refusal.why).toContain("settings.yaml");
  });

  it("exit 5: runtime/not-a-repo", () => {
    refused(bdk(["config", "check", "--json"], fixture({}, false).root), 5, "runtime/not-a-repo");
  });
});

describe("bdk config schema", () => {
  it("exit 0: the example run validates against config-schema.json", () => {
    const result = bdk(["config", "schema", "--url", "--json"], fixture().root);
    expect(result.code).toBe(0);
    expect(validSchema(result.json), JSON.stringify(validSchema.errors)).toBe(true);
    expect(result.json).toStrictEqual({
      url: URL,
      offlineCopy: ".bdk/.machine/schema/settings.json",
    });
  });

  it("exit 0: the whole schema equals the committed schema/settings.json", () => {
    const result = bdk(["config", "schema", "--json"], fixture().root);
    expect((result.json as { schema: unknown }).schema).toStrictEqual(
      JSON.parse(readFileSync(join(REPO_ROOT, "schema/settings.json"), "utf8")),
    );
  });

  it("exit 3: input/not-found", () => {
    refused(bdk(["config", "schema", "policy", "--json"], fixture().root), 3, "input/not-found");
  });

  it("exit 5: runtime/not-a-repo", () => {
    refused(bdk(["config", "schema", "--json"], fixture({}, false).root), 5, "runtime/not-a-repo");
  });
});

describe("bdk config set", () => {
  it("exit 0: the example run validates against config-set.json", () => {
    const root = fixture({
      ".bdk/settings.local.yaml": `${MODELINE}\nfeatures:\n  lavish: true\n`,
    }).root;
    const result = bdk(["config", "set", "features.lavish", "false", "--local", "--json"], root);
    expect(result.code).toBe(0);
    expect(validSet(result.json), JSON.stringify(validSet.errors)).toBe(true);
    expect(result.json).toStrictEqual({
      key: "features.lavish",
      value: false,
      previous: true,
      layer: "local",
      path: ".bdk/settings.local.yaml",
    });
    expect(readFileSync(join(root, ".bdk/.machine/config/resolved.yaml"), "utf8")).toContain(
      "- features.lavish",
    );
  });

  it("comments survive", () => {
    const text = `${MODELINE}\n# stack\nlanguages: [go]  # main\nfeatures:\n  # UI\n  lavish: true\n`;
    const root = fixture({ ".bdk/settings.yaml": text }).root;
    expect(bdk(["config", "set", "features.lavish", "false"], root).code).toBe(0);
    expect(readFileSync(join(root, ".bdk/settings.yaml"), "utf8")).toBe(
      text.replace("lavish: true", "lavish: false"),
    );
  });

  it("exit 0: a new global file starts with the modeline", () => {
    const root = fixture().root;
    expect(bdk(["config", "set", "languages", "[go]", "--global"], root).code).toBe(0);
    expect(readFileSync(join(root, GLOBAL), "utf8")).toBe(`${MODELINE}\nlanguages: [go]\n`);
  });

  it("exit 2: policy/unknown-config-key changes no file", () => {
    const root = fixture({ ".bdk/settings.yaml": TOOLS }).root;
    refused(
      bdk(["config", "set", "tools.tests", "[]", "--json"], root),
      2,
      "policy/unknown-config-key",
    );
    expect(readFileSync(join(root, ".bdk/settings.yaml"), "utf8")).toBe(TOOLS);
  });

  it("exit 2: policy/config-invalid changes no file", () => {
    const root = fixture({ ".bdk/settings.yaml": TOOLS }).root;
    refused(
      bdk(["config", "set", "tools.test.unit.scoped", "vitest", "--json"], root),
      2,
      "policy/config-invalid",
    );
    expect(readFileSync(join(root, ".bdk/settings.yaml"), "utf8")).toBe(TOOLS);
  });

  it("exit 3: input/invalid-argument for both layer flags", () => {
    refused(
      bdk(["config", "set", "languages", "[]", "--global", "--local", "--json"], fixture().root),
      3,
      "input/invalid-argument",
    );
  });

  it("exit 3: input/missing-argument", () => {
    refused(
      bdk(["config", "set", "languages", "--json"], fixture().root),
      3,
      "input/missing-argument",
    );
  });

  it("exit 5: runtime/not-a-repo", () => {
    refused(
      bdk(["config", "set", "languages", "[]", "--json"], fixture({}, false).root),
      5,
      "runtime/not-a-repo",
    );
  });
});
