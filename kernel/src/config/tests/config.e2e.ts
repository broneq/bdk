// `kernel-cli/config` through the built bundle: every exit code and rule
// the four records declare, the acceptance scenarios of T12 and the JSON
// Schemas. The global layer lives in the fixture (XDG_CONFIG_HOME), so the
// machine's own settings never leak into a case.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { afterEach, describe, expect, it } from "vitest";

import { createFixture } from "../../../tests/support/fixture.ts";
import type { Fixture } from "../../../tests/support/fixture.ts";
import { REPO_ROOT, runBdk } from "../../../tests/support/run.ts";
import { validatorFor } from "../../../tests/support/schemas.ts";
import { FORMATTER_GUARD } from "../../shared/store/index.ts";

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
const URL = `https://raw.githubusercontent.com/broneq/bdk/dist-v${VERSION}/schema/settings.json`;
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
  // No user or system git config: a global excludes file must not decide what is ignored.
  const env = {
    ...process.env,
    XDG_CONFIG_HOME: join(root, "xdg"),
    HOME: root,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  } as Record<string, string>;
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

  it("exit 0: policy.verifier defaults to the six P8 categories and the not-a-fail list", () => {
    const result = bdk(["config", "show", "policy.verifier", "--json"], fixture({}).root);
    expect(result.code).toBe(0);
    const value = (result.json as { value: Record<string, { id: string }[]> }).value;
    const ids = (key: string) => (value[key] ?? []).map((item) => item.id);
    expect(ids("blocking-categories")).toStrictEqual([
      "architecture",
      "security",
      "irreversible-step",
      "integration-failure",
      "unresolved-decision",
      "false-code-claim",
    ]);
    expect(ids("not-a-fail")).toStrictEqual([
      "style",
      "template-conformance",
      "files-bookkeeping",
      "wording",
      "report-length",
      "verification-defect",
    ]);
  });

  it("exit 0: a project item extends the blocking categories by id", () => {
    const root = fixture({
      ".bdk/settings.yaml":
        "policy:\n  verifier:\n    blocking-categories:\n      - id: accessibility\n        description: WCAG AA failure.\n",
    }).root;
    const result = bdk(["config", "show", "policy.verifier.blocking-categories", "--json"], root);
    expect(result.code).toBe(0);
    const ids = (result.json as { value: { id: string }[] }).value.map((item) => item.id);
    expect(ids).toHaveLength(7);
    expect(ids.at(-1)).toBe("accessibility");
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
      ".bdk/prompts/fragments/decision/lavish.md": "---\nmode: replace\n---\n- x\n",
    }).root;
    const result = bdk(["config", "show", "prompts.fragments/decision/lavish", "--json"], root);
    expect(result.code).toBe(0);
    expect(result.json).toMatchObject({
      value: {
        mode: "replace",
        files: [{ layer: "project", path: ".bdk/prompts/fragments/decision/lavish.md" }],
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

  it("exit 2: policy/unknown-config-key [S6]", () => {
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

  it("acceptance: config layering with unknown key [AC-7]", () => {
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

  it("exit 2: a prompt file for a role body is no prompt key (role-contracts)", () => {
    const root = fixture({ ".bdk/prompts/roles/verifier.md": "Ours.\n" }).root;
    const refusal = refused(
      bdk(["config", "check", "--json"], root),
      2,
      "policy/unknown-config-key",
    );
    expect(refusal.why).toContain("roles/verifier");
  });

  it("acceptance: dropped funnel key", () => {
    const root = fixture({
      ".bdk/settings.yaml": "rules:\n  propose-when:\n    authors: 1\n",
    }).root;
    const refusal = refused(
      bdk(["config", "check", "--json"], root),
      2,
      "policy/unknown-config-key",
    );
    expect(refusal.why).toContain("rules.propose-when");
  });

  it("acceptance: one root, several consumers", () => {
    const root = fixture({
      ".bdk/settings.yaml": "policy:\n  budgets:\n    verifier: 3\n  gates:\n    design: auto\n",
    }).root;
    expect(bdk(["config", "check"], root).code).toBe(0);
    const shown = bdk(["config", "show", "policy", "--json"], root);
    expect(shown.code).toBe(0);
    expect(JSON.parse(shown.stdout)).toMatchObject({
      value: { budgets: { verifier: 3 }, gates: { design: "auto" } },
    });
    const typo = fixture({ ".bdk/settings.yaml": "policy:\n  budgets:\n    verfier: 3\n" }).root;
    const refusal = refused(
      bdk(["config", "check", "--json"], typo),
      2,
      "policy/unknown-config-key",
    );
    expect(refusal.why).toContain("did you mean policy.budgets.verifier?");
    expect(refusal.instead[0]).toBe("bdk config schema policy.budgets");
  });

  it("acceptance: T22 defaults", () => {
    const root = fixture({}).root;
    const shown = bdk(["config", "show", "policy", "--json"], root);
    expect(shown.code).toBe(0);
    expect(JSON.parse(shown.stdout)).toMatchObject({
      value: {
        budgets: {
          "task-redispatch": 3,
          "verify-fix": 2,
          "review-fix": 2,
          verifier: 2,
          "part-lead": 2,
          "not-run": 3,
        },
        oscillation: { threshold: 2 },
        escalation: { enabled: true, model: "opus", "per-change": 3 },
        checkpoint: { enabled: true },
      },
    });
  });

  it("acceptance: agents defaults", () => {
    const shown = bdk(["config", "show", "agents", "--json"], fixture({}).root);
    expect(shown.code).toBe(0);
    expect(JSON.parse(shown.stdout)).toMatchObject({
      value: {
        ttl: 300,
        "open-call-limit": 720,
        message: { "max-chars": 300 },
        continuation: { max: 3 },
        scout: { "max-per-ticket": 2 },
      },
    });
  });

  it("acceptance: agents ttl out of range", () => {
    const root = fixture({ ".bdk/settings.yaml": "agents:\n  ttl: 10\n" }).root;
    const refusal = refused(bdk(["config", "check", "--json"], root), 2, "policy/config-invalid");
    expect(refusal.why).toContain("agents.ttl");
  });

  it("acceptance: diagnostics defaults", () => {
    const shown = bdk(["config", "show", "diagnostics", "--json"], fixture({}).root);
    expect(shown.code).toBe(0);
    expect(JSON.parse(shown.stdout)).toMatchObject({
      value: { verbose: false, "repeat-refusal": 3, "repeat-read": 3, "outlier-factor": 3 },
    });
  });

  it("acceptance: diagnostics threshold out of range", () => {
    const root = fixture({ ".bdk/settings.yaml": "diagnostics:\n  repeat-refusal: 1\n" }).root;
    const refusal = refused(bdk(["config", "check", "--json"], root), 2, "policy/config-invalid");
    expect(refusal.why).toContain("diagnostics.repeat-refusal");
  });

  it("acceptance: no diagnostics.analyze key", () => {
    const root = fixture({ ".bdk/settings.yaml": "diagnostics:\n  analyze: always\n" }).root;
    const refusal = refused(
      bdk(["config", "check", "--json"], root),
      2,
      "policy/unknown-config-key",
    );
    expect(refusal.why).toContain("diagnostics.analyze");
  });

  it("acceptance: evidence defaults", () => {
    const shown = bdk(["config", "show", "policy.evidence", "--json"], fixture({}).root);
    expect(shown.code).toBe(0);
    const value = (shown.json as { value: Record<string, unknown> }).value;
    expect(value["max-committed-bytes"]).toBe(65536);
    expect(value["non-executable"]).toContain("**/*.md");
    expect(value["non-executable"]).toContain(".bdk/**");
    expect(value["build-config"]).toContain("package.json");
    expect(value["build-config"]).toContain("CMakeLists.txt");
  });

  it("acceptance: project appends a glob", () => {
    const defaults = bdk(
      ["config", "show", "policy.evidence.build-config", "--json"],
      fixture({}).root,
    );
    const root = fixture({
      ".bdk/settings.yaml": 'policy:\n  evidence:\n    build-config: ["mkdocs.yml", "docs/**"]\n',
    }).root;
    const shown = bdk(["config", "show", "policy.evidence.build-config", "--json"], root);
    expect(shown.code).toBe(0);
    const before = (defaults.json as { value: string[] }).value;
    expect((shown.json as { value: string[] }).value).toStrictEqual([
      ...before,
      "mkdocs.yml",
      "docs/**",
    ]);
  });

  it("acceptance: concurrency default", () => {
    const shown = bdk(["config", "show", "execution.concurrency", "--json"], fixture({}).root);
    expect(shown.code).toBe(0);
    expect(shown.json).toMatchObject({ key: "execution.concurrency", value: 5 });
  });

  it("acceptance: keep evidence registered", () => {
    const shown = bdk(["config", "show", "archive.keep-evidence", "--json"], fixture({}).root);
    expect(shown.code).toBe(0);
    expect(shown.json).toMatchObject({ key: "archive.keep-evidence", value: false });
  });

  it("shows the default normative word and refuses an empty one", () => {
    const shown = bdk(["config", "show", "spec.normative-word", "--json"], fixture({}).root);
    expect(shown.code).toBe(0);
    expect(shown.json).toMatchObject({ key: "spec.normative-word", value: "SHALL" });
    const root = fixture({ ".bdk/settings.yaml": 'spec:\n  normative-word: ""\n' }).root;
    const refusal = refused(bdk(["config", "check", "--json"], root), 2, "policy/config-invalid");
    expect(JSON.stringify(refusal)).toContain("spec.normative-word");
  });

  it("acceptance: detected key unset", () => {
    refused(
      bdk(["config", "show", "execution.runner", "--json"], fixture({}).root),
      2,
      "policy/unknown-config-key",
    );
  });

  it("acceptance: removed runner key in a layer", () => {
    const root = fixture({ ".bdk/settings.yaml": "execution:\n  runner: headless\n" }).root;
    const refusal = refused(
      bdk(["config", "check", "--json"], root),
      2,
      "policy/unknown-config-key",
    );
    expect(JSON.stringify(refusal)).toContain("execution.runner");
  });

  it("acceptance: concurrency out of range", () => {
    const root = fixture({ ".bdk/settings.yaml": "execution:\n  concurrency: 16\n" }).root;
    const refusal = refused(bdk(["config", "check", "--json"], root), 2, "policy/config-invalid");
    expect(JSON.stringify(refusal)).toContain("execution.concurrency");
  });

  it("acceptance: local override visible in the snapshot [S6]", () => {
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

  it("exit 0: a v2 settings file is a legacy-settings warning [AC-5]", () => {
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

  it("exit 0: the whole schema equals the schema/settings.json of the build", () => {
    const result = bdk(["config", "schema", "--json"], fixture().root);
    expect((result.json as { schema: unknown }).schema).toStrictEqual(
      JSON.parse(readFileSync(join(REPO_ROOT, "schema/settings.json"), "utf8")),
    );
  });

  it("exit 0: text mode prints the whole schema, past 100 lines", () => {
    const result = bdk(["config", "schema"], fixture().root);
    expect(result.code).toBe(0);
    expect(result.stdout.split("\n").length).toBeGreaterThan(100);
    expect(JSON.parse(result.stdout)).toStrictEqual(
      JSON.parse(readFileSync(join(REPO_ROOT, "schema/settings.json"), "utf8")),
    );
  });

  it("exit 3: input/not-found", () => {
    refused(bdk(["config", "schema", "gates", "--json"], fixture().root), 3, "input/not-found");
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

  it("local layer is ignored: .gitignore gains exactly the two paths, once", () => {
    const root = fixture({ ".gitignore": "node_modules/\n" }).root;
    expect(bdk(["config", "set", "features.lavish", "false", "--local"], root).code).toBe(0);
    const expected = "node_modules/\n/.bdk/.machine/\n/.bdk/settings.local.yaml\n";
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toBe(expected);
    const checkIgnore = spawnSync("git", ["check-ignore", "-q", ".bdk/settings.local.yaml"], {
      cwd: root,
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    });
    expect(checkIgnore.status).toBe(0);

    expect(bdk(["config", "set", "features.lavish", "true", "--local"], root).code).toBe(0);
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toBe(expected);
  });

  it("writes the formatter guard when absent and keeps a file the user wrote", () => {
    const fresh = fixture().root;
    expect(bdk(["config", "set", "features.lavish", "false"], fresh).code).toBe(0);
    expect(readFileSync(join(fresh, ".bdk/.prettierrc"), "utf8")).toBe(FORMATTER_GUARD);

    const own = fixture({ ".bdk/.prettierrc": '{"semi": false}' }).root;
    expect(bdk(["config", "set", "features.lavish", "false"], own).code).toBe(0);
    expect(readFileSync(join(own, ".bdk/.prettierrc"), "utf8")).toBe('{"semi": false}');
  });

  it("acceptance: verbose for one user, applied from the next session", () => {
    const root = fixture({ ".bdk/settings.yaml": TOOLS }).root;
    const result = bdk(["config", "set", "diagnostics.verbose", "true", "--local"], root);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("diagnostics.verbose = true in the local layer");
    expect(result.stdout).toContain("applies from the next session start");
    expect(parse(readFileSync(join(root, ".bdk/settings.local.yaml"), "utf8"))).toMatchObject({
      diagnostics: { verbose: true },
    });
    expect(readFileSync(join(root, ".bdk/settings.yaml"), "utf8")).toBe(TOOLS);
    const json = bdk(["config", "set", "diagnostics.verbose", "false", "--local", "--json"], root);
    expect(validSet(json.json), JSON.stringify(validSet.errors)).toBe(true);
    const plain = bdk(["config", "set", "diagnostics.repeat-read", "4"], root);
    expect(plain.stdout).not.toContain("next session");
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
