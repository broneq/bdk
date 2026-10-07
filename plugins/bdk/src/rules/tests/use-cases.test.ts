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

describe("rules for", () => {
  it("selects pack and project rules for the stage, files and languages", () => {
    const result = rulesFor(
      deps({ [`${ROOT}/.bdk/rules/api/API-1.md`]: rule("review", '["src/api/**"]') }),
      { stage: "review", files: ["src/api/users.ts"] },
    );
    expect(result.rules.map((r) => [r.id, r.origin, r.file])).toEqual([
      ["BDK-ARCH-3", "bdk", "rules/architecture/BDK-ARCH-3.md"],
      ["BDK-CQ-1", "bdk", "rules/code-quality/BDK-CQ-1.md"],
      ["BDK-TS-7", "bdk", "rules/languages/typescript/BDK-TS-7.md"],
      ["API-1", "project", ".bdk/rules/api/API-1.md"],
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("makes files root-relative from the working directory, absolute paths too, without repeats", () => {
    const result = rulesFor(deps({}, `${ROOT}/src`), {
      stage: "review",
      files: ["./a.ts", `${ROOT}/src/a.ts`, "../lib/b.tsx"],
    });
    expect(result.files).toEqual(["src/a.ts", "lib/b.tsx"]);
  });

  it("applies rules.disabled and reports an unknown id as a warning", () => {
    const result = rulesFor(
      deps({ [`${ROOT}/.bdk/settings.yaml`]: "rules:\n  disabled: [BDK-CQ-1, BDK-CQ-11]\n" }),
      { stage: "review", files: [] },
    );
    expect(result.rules.map((r) => r.id)).toEqual(["BDK-ARCH-3"]);
    expect(result.warnings).toEqual([
      "rules.disabled names no rule BDK-CQ-11; did you mean BDK-CQ-1?",
    ]);
  });

  it("reports a project that is not configured", () => {
    const failure = error(() =>
      rulesFor(deps({ [`${ROOT}/.bdk/settings.yaml`]: undefined }), { stage: "review", files: [] }),
    );
    expect(failure.code).toBe("env/not-configured");
    expect(failure.hint).toContain("/bdk:setup");
  });

  it("reports an invalid configuration", () => {
    const failure = error(() =>
      rulesFor(deps({ [`${ROOT}/.bdk/settings.yaml`]: "languages: [Not Kebab]\n" }), {
        stage: "review",
        files: [],
      }),
    );
    expect(failure.code).toBe("env/config-invalid");
    expect(failure.hint).toContain("bdk config check");
  });

  it("reports an invalid project rule with its file and field", () => {
    const failure = error(() =>
      rulesFor(deps({ [`${ROOT}/.bdk/rules/X-1.md`]: rule("deploy") }), {
        stage: "review",
        files: [],
      }),
    );
    expect(failure.code).toBe("env/invalid-rule");
    expect(failure.message).toContain(".bdk/rules/X-1.md");
    expect(failure.message).toContain("stages");
  });

  it("refuses a project rule with a pack id", () => {
    const failure = error(() =>
      rulesFor(deps({ [`${ROOT}/.bdk/rules/BDK-CQ-1.md`]: rule("review") }), {
        stage: "review",
        files: [],
      }),
    );
    expect(failure.code).toBe("env/invalid-rule");
    expect(failure.message).toContain("BDK-");
  });

  it("refuses two project rules with one id", () => {
    const failure = error(() =>
      rulesFor(
        deps({
          [`${ROOT}/.bdk/rules/a/API-1.md`]: rule("review"),
          [`${ROOT}/.bdk/rules/b/API-1.md`]: rule("review"),
        }),
        { stage: "review", files: [] },
      ),
    );
    expect(failure.code).toBe("env/invalid-rule");
    expect(failure.message).toBe(".bdk/rules/b/API-1.md: id API-1 is also .bdk/rules/a/API-1.md");
  });

  it("reports a rule file that is listed but cannot be read", () => {
    const value = deps({ [`${ROOT}/.bdk/rules/API-1.md`]: rule("review") });
    const files = {
      ...value.files,
      readText: (path: string) =>
        path.endsWith("API-1.md") ? undefined : value.files.readText(path),
    };
    const failure = error(() => rulesFor({ ...value, files }, { stage: "review", files: [] }));
    expect(failure.message).toBe(".bdk/rules/API-1.md: cannot be read");
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
        [`${ROOT}/.bdk/settings.yaml`]: "languages: [cobol]\n",
      }),
    );
    expect(stdout).toContain("BDK rules for stage design: 2 rules\n");
    expect(stdout).toContain(
      "## BDK-K-1\nknowledge, verified 2026-09-30, source https://x.dev; applies to any file of the stage\n",
    );
    expect(stdout).toMatch(/\nwarnings:\n {2}no rules for language cobol\n$/);
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
