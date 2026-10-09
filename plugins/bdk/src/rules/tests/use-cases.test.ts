import { describe, expect, it } from "vitest";

import { CliError, run } from "../../shared/cli/index.ts";
import { rulesGroup } from "../index.ts";
import { forSchema } from "../schema/for.ts";
import type { ForResult } from "../schema/for.ts";
import type { RulesDeps } from "../use-cases/for.ts";
import { rulesFor } from "../use-cases/for.ts";
import { memory } from "./memory.ts";

// `bdk rules for` against an in-memory project and pack (spec `bdk-cli/rules`, spec `rule-pack`).

const ROOT = "/work/app";
const PACK = "/plugin/rules";

function rule(stages: string, paths = '["**"]', extra = ""): string {
  return `---\nkind: house\npaths: ${paths}\nstages: [${stages}]\n${extra}---\n\nRule text.\n`;
}

const BASE: Record<string, string> = {
  [`${ROOT}/openspec/config.yaml`]: "schema: spec-driven\n",
  [`${ROOT}/.bdk/settings.yaml`]: "languages: [typescript]\n",
  [`${PACK}/README.md`]: "# pack\n",
  [`${PACK}/code-quality/BDK-CQ-1.md`]: rule("execute, review"),
  [`${PACK}/architecture/BDK-ARCH-3.md`]: rule("design, review"),
  [`${PACK}/languages/typescript/BDK-TS-7.md`]: rule("review", '["**/*.ts", "**/*.tsx"]'),
  [`${PACK}/languages/react/BDK-REACT-2.md`]: rule("review", '["**/*.tsx"]'),
};

function deps(extra: Record<string, string | undefined> = {}, cwd = ROOT): RulesDeps {
  const all = { ...BASE, ...extra };
  const files = Object.fromEntries(
    Object.entries(all).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  return { files: memory(files), cwd, home: "/home/me", env: {}, pack: PACK };
}

function error(fn: () => unknown): CliError {
  try {
    fn();
  } catch (caught) {
    if (caught instanceof CliError) return caught;
    throw caught;
  }
  throw new Error("expected a CliError");
}

async function bdk(
  argv: readonly string[],
  value = deps(),
): Promise<{ exit: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  const exit = await run({
    argv,
    version: "0.0.0",
    nodeVersion: "22.18.0",
    groups: [rulesGroup(value)],
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return { exit, stdout, stderr };
}

const GLOBAL = "/home/me/.config/bdk";

function settings(
  yaml: string,
  layer: "project" | "local" | "global" = "project",
): Record<string, string> {
  const path = {
    project: `${ROOT}/.bdk/settings.yaml`,
    local: `${ROOT}/.bdk/settings.local.yaml`,
    global: `${GLOBAL}/settings.yaml`,
  }[layer];
  return { [path]: yaml };
}

const PROJECT = (yaml: string): Record<string, string> =>
  settings(`languages: [typescript]\n${yaml}`);

describe("rules for", () => {
  it("selects pack rules and an inline project rule for the stage, files and languages", () => {
    const result = rulesFor(
      deps(
        PROJECT(
          'rules:\n  API-1:\n    paths: ["src/api/**"]\n    text: Parse the body with the schema.\n',
        ),
      ),
      { stage: "review", files: ["src/api/users.ts"] },
    );
    expect(result.rules.map((r) => [r.id, r.origin, r.file])).toEqual([
      ["BDK-ARCH-3", "bdk", "rules/architecture/BDK-ARCH-3.md"],
      ["BDK-CQ-1", "bdk", "rules/code-quality/BDK-CQ-1.md"],
      ["BDK-TS-7", "bdk", "rules/languages/typescript/BDK-TS-7.md"],
      ["API-1", "project", ".bdk/settings.yaml"],
    ]);
    expect(result.rules[3]).toMatchObject({
      kind: "house",
      language: null,
      text: "Parse the body with the schema.",
      matched: ["src/api/users.ts"],
    });
    expect(result.warnings).toEqual([]);
  });

  it("reads a project rule's text from its file, without the frontmatter", () => {
    const result = rulesFor(
      deps({
        ...PROJECT(
          "rules:\n  GATEWAY-1:\n    stages: [design]\n    file: docs/conventions/gateway.md\n",
        ),
        [`${ROOT}/docs/conventions/gateway.md`]:
          "---\ntitle: Gateway\n---\n\nRegister every endpoint in src/gateway/routes.ts.\n",
      }),
      { stage: "design", files: [] },
    );
    expect(result.rules.map((r) => [r.id, r.origin, r.file, r.text])).toEqual([
      ["BDK-ARCH-3", "bdk", "rules/architecture/BDK-ARCH-3.md", "Rule text."],
      [
        "GATEWAY-1",
        "project",
        "docs/conventions/gateway.md",
        "Register every endpoint in src/gateway/routes.ts.",
      ],
    ]);
  });

  it("gives a minimal rule the defaults: house, every file, execute and review", () => {
    const value = deps(PROJECT("rules:\n  X-1:\n    text: Keep it short.\n"));
    const review = rulesFor(value, { stage: "review", files: ["any/file.md"] });
    expect(review.rules.find((r) => r.id === "X-1")).toMatchObject({
      kind: "house",
      paths: ["**"],
      stages: ["execute", "review"],
      source: null,
      verified: null,
    });
    for (const stage of ["design", "plan"] as const) {
      expect(rulesFor(value, { stage, files: [] }).rules.map((r) => r.id)).not.toContain("X-1");
    }
    expect(rulesFor(value, { stage: "execute", files: [] }).rules.map((r) => r.id)).toContain(
      "X-1",
    );
  });

  it("resolves the file of a global rule against the global settings directory", () => {
    const result = rulesFor(
      deps({
        ...settings("rules:\n  ME-1:\n    file: me-1.md\n", "global"),
        [`${GLOBAL}/me-1.md`]: "My own rule.\n",
      }),
      { stage: "execute", files: [] },
    );
    expect(result.rules.find((r) => r.id === "ME-1")).toMatchObject({
      origin: "global",
      file: `${GLOBAL}/me-1.md`,
      text: "My own rule.",
    });
  });

  it("reads no .bdk/rules/ directory and warns about none", () => {
    const result = rulesFor(
      deps({ [`${ROOT}/.bdk/rules/api/API-1.md`]: rule("review", '["src/api/**"]') }),
      { stage: "review", files: ["src/api/users.ts"] },
    );
    expect(result.rules.map((r) => r.id)).not.toContain("API-1");
    expect(result.warnings).toEqual([]);
  });

  it("switches rules off with enabled: false in any layer", () => {
    const result = rulesFor(
      deps({
        ...PROJECT("rules:\n  BDK-ARCH-3: {enabled: false}\n  API-1: {text: Parse it.}\n"),
        ...settings("rules:\n  BDK-CQ-1: {enabled: false}\n", "local"),
      }),
      { stage: "review", files: [] },
    );
    expect(result.rules.map((r) => r.id)).toEqual(["BDK-TS-7", "API-1"]);
    expect(result.warnings).toEqual([]);
  });

  it("skips the file of a disabled rule, so a missing file breaks nothing", () => {
    const result = rulesFor(
      deps(PROJECT("rules:\n  API-2: {file: docs/missing.md, enabled: false}\n")),
      { stage: "review", files: [] },
    );
    expect(result.rules.map((r) => r.id)).not.toContain("API-2");
  });

  it("narrows a pack rule by its BDK- entry and keeps its text", () => {
    const result = rulesFor(
      deps(settings('languages: [react]\nrules:\n  BDK-REACT-2: {paths: ["apps/web/**/*.tsx"]}\n')),
      { stage: "review", files: ["packages/ui/Button.tsx", "apps/web/App.tsx"] },
    );
    expect(result.rules.find((r) => r.id === "BDK-REACT-2")).toMatchObject({
      origin: "bdk",
      language: "react",
      file: "rules/languages/react/BDK-REACT-2.md",
      paths: ["apps/web/**/*.tsx"],
      matched: ["apps/web/App.tsx"],
      text: "Rule text.",
    });
  });

  it("warns about a BDK- entry that names no pack rule, with the closest id", () => {
    const result = rulesFor(
      deps(
        PROJECT("rules:\n  BDK-CQ-11: {enabled: false}\n  BDK-NOTHING-LIKE-IT: {enabled: false}\n"),
      ),
      { stage: "review", files: [] },
    );
    expect(result.warnings).toEqual([
      "rules.BDK-CQ-11 names no rule of the BDK pack; did you mean BDK-CQ-1?",
      "rules.BDK-NOTHING-LIKE-IT names no rule of the BDK pack",
    ]);
  });

  it("gives no warning for a language without pack rules", () => {
    const result = rulesFor(deps(settings("languages: [python]\n")), {
      stage: "review",
      files: [],
    });
    expect(result.warnings).toEqual([]);
  });

  it("names the layer that sets the text as origin, and the layer file as file", () => {
    const result = rulesFor(
      deps({
        ...PROJECT("rules:\n  API-1: {text: Parse it.}\n"),
        ...settings('rules:\n  API-1: {paths: ["src/api/**"]}\n', "local"),
      }),
      { stage: "review", files: [] },
    );
    expect(result.rules.find((r) => r.id === "API-1")).toMatchObject({
      origin: "project",
      file: ".bdk/settings.yaml",
      paths: ["src/api/**"],
    });
  });

  it("orders rules by origin bdk, global, project, local, then by id", () => {
    const result = rulesFor(
      deps({
        ...settings("rules:\n  ME-1: {text: Mine.}\n", "global"),
        ...PROJECT("rules:\n  B-2: {text: Two.}\n  B-10: {text: Ten.}\n"),
        ...settings("rules:\n  A-1: {text: Local.}\n", "local"),
      }),
      { stage: "review", files: [] },
    );
    expect(result.rules.map((r) => [r.id, r.origin])).toEqual([
      ["BDK-ARCH-3", "bdk"],
      ["BDK-CQ-1", "bdk"],
      ["BDK-TS-7", "bdk"],
      ["ME-1", "global"],
      ["B-2", "project"],
      ["B-10", "project"],
      ["A-1", "local"],
    ]);
  });

  it("makes files root-relative from the working directory, absolute paths too, without repeats", () => {
    const result = rulesFor(deps({}, `${ROOT}/src`), {
      stage: "review",
      files: ["./a.ts", `${ROOT}/src/a.ts`, "../lib/b.tsx"],
    });
    expect(result.files).toEqual(["src/a.ts", "lib/b.tsx"]);
  });

  it("reports a project that is not configured", () => {
    const failure = error(() =>
      rulesFor(deps({ [`${ROOT}/.bdk/settings.yaml`]: undefined }), { stage: "review", files: [] }),
    );
    expect(failure.code).toBe("env/not-configured");
    expect(failure.hint).toContain("/bdk:setup");
  });

  it.each([
    ["an invalid setting", "languages: [Not Kebab]\n"],
    ["an invalid stage of a project rule", "rules:\n  X-1: {text: T., stages: [deploy]}\n"],
    ["a pack rule given a text", "rules:\n  BDK-CQ-1: {text: Short names are fine.}\n"],
    ["one rule id twice", "rules:\n  API-1: {text: A.}\n  API-1: {text: B.}\n"],
  ])("reports an invalid configuration: %s", (_name, yaml) => {
    const failure = error(() => rulesFor(deps(settings(yaml)), { stage: "review", files: [] }));
    expect(failure.code).toBe("env/config-invalid");
    expect(failure.hint).toContain("bdk config check");
  });

  it("reports the missing file of an enabled project rule by its key and path", () => {
    const failure = error(() =>
      rulesFor(deps(PROJECT("rules:\n  API-2: {file: docs/missing.md}\n")), {
        stage: "review",
        files: [],
      }),
    );
    expect(failure.code).toBe("env/invalid-rule");
    expect(failure.message).toBe("rules.API-2.file: docs/missing.md cannot be read");
  });

  it("reports a rule file with no text after its frontmatter", () => {
    const failure = error(() =>
      rulesFor(
        deps({
          ...PROJECT("rules:\n  API-2: {file: docs/empty.md}\n"),
          [`${ROOT}/docs/empty.md`]: "---\ntitle: x\n---\n\n",
        }),
        { stage: "review", files: [] },
      ),
    );
    expect(failure.code).toBe("env/invalid-rule");
    expect(failure.message).toBe("rules.API-2.file: docs/empty.md holds no rule text");
  });

  it("reports a pack rule file that is listed but cannot be read", () => {
    const value = deps();
    const files = {
      ...value.files,
      readText: (path: string) =>
        path.endsWith("BDK-CQ-1.md") ? undefined : value.files.readText(path),
    };
    const failure = error(() => rulesFor({ ...value, files }, { stage: "review", files: [] }));
    expect(failure.message).toBe("rules/code-quality/BDK-CQ-1.md: cannot be read");
  });

  it("reports a missing rule pack", () => {
    const failure = error(() =>
      rulesFor({ ...deps(), pack: "/nowhere/rules" }, { stage: "review", files: [] }),
    );
    expect(failure.code).toBe("env/no-rule-pack");
  });

  it("warns about a file outside the project root", () => {
    const result = rulesFor(deps(), { stage: "review", files: ["/elsewhere/a.ts", "src/a.ts"] });
    expect(result.files).toEqual(["../../elsewhere/a.ts", "src/a.ts"]);
    expect(result.warnings).toEqual([
      "../../elsewhere/a.ts is not a file under the project root; no rule path matches it",
    ]);
  });

  it("reports an invalid pack rule", () => {
    const failure = error(() =>
      rulesFor(deps({ [`${PACK}/x/BDK-X-1.md`]: "no frontmatter\n" }), {
        stage: "review",
        files: [],
      }),
    );
    expect(failure.code).toBe("env/invalid-rule");
    expect(failure.message).toContain("rules/x/BDK-X-1.md");
  });

  it("refuses two pack rules with one id", () => {
    const failure = error(() =>
      rulesFor(deps({ [`${PACK}/x/BDK-CQ-1.md`]: rule("review") }), { stage: "review", files: [] }),
    );
    expect(failure.code).toBe("env/invalid-rule");
    expect(failure.message).toBe(
      "rules/x/BDK-CQ-1.md: id BDK-CQ-1 is also rules/code-quality/BDK-CQ-1.md",
    );
  });
});

describe("bdk rules for", () => {
  it("prints one JSON document valid against its schema", async () => {
    const { exit, stdout, stderr } = await bdk([
      "rules",
      "for",
      "--stage",
      "review",
      "--files",
      "src/a.ts",
      "--json",
    ]);
    expect([exit, stderr]).toEqual([0, ""]);
    const result: ForResult = forSchema.parse(JSON.parse(stdout));
    expect(result.stage).toBe("review");
    expect(result.files).toEqual(["src/a.ts"]);
    expect(result.rules.map((r) => r.id)).toEqual(["BDK-ARCH-3", "BDK-CQ-1", "BDK-TS-7"]);
    expect(result.rules[0]).toMatchObject({ matched: ["src/a.ts"], text: "Rule text." });
  });

  it("prints Markdown for a prompt", async () => {
    const { exit, stdout } = await bdk([
      "rules",
      "for",
      "--stage",
      "review",
      "--files",
      "src/a.ts",
      "--files",
      "README.md",
    ]);
    expect(exit).toBe(0);
    expect(stdout).toBe(
      [
        "BDK rules for stage review: 3 rules, 2 files",
        "",
        "## BDK-ARCH-3",
        "house; applies to src/a.ts, README.md",
        "",
        "Rule text.",
        "",
        "## BDK-CQ-1",
        "house; applies to src/a.ts, README.md",
        "",
        "Rule text.",
        "",
        "## BDK-TS-7",
        "house; applies to src/a.ts",
        "",
        "Rule text.",
        "",
      ].join("\n"),
    );
  });

  it("names a knowledge rule's date and source, the stage scope without files, and warnings", async () => {
    const knowledge = rule(
      "design",
      '["**"]',
      "source: https://x.dev\nverified: 2026-09-30\n",
    ).replace("house", "knowledge");
    const { stdout } = await bdk(
      ["rules", "for", "--stage", "design"],
      deps({
        [`${PACK}/k/BDK-K-1.md`]: knowledge,
        [`${ROOT}/.bdk/settings.yaml`]: "rules:\n  BDK-K-2: {enabled: false}\n",
      }),
    );
    expect(stdout).toContain("BDK rules for stage design: 2 rules\n");
    expect(stdout).toContain(
      "## BDK-K-1\nknowledge, verified 2026-09-30, source https://x.dev; applies to any file of the stage\n",
    );
    expect(stdout).toMatch(
      /\nwarnings:\n {2}rules\.BDK-K-2 names no rule of the BDK pack; did you mean BDK-K-1\?\n$/,
    );
  });

  it("prints an empty selection with exit 0", async () => {
    const { exit, stdout } = await bdk(["rules", "for", "--stage", "plan", "--files", "x.md"]);
    expect([exit, stdout]).toEqual([0, "BDK rules for stage plan: 0 rules, 1 file\n"]);
  });

  it.each([[["--stage", "deploy"]], [[]]])("refuses the stage %j", async (flags) => {
    const { exit, stderr } = await bdk(["rules", "for", ...flags]);
    expect(exit).toBe(2);
    expect(stderr).toContain("--stage must be one of design, plan, execute, review");
  });

  it("marks --files repeatable in its help", async () => {
    const { stdout } = await bdk(["rules", "for", "--help"]);
    expect(stdout).toMatch(/--files <value> .*\(repeatable\)$/m);
  });
});
