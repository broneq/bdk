import { describe, expect, it } from "vitest";

import { CliError } from "../../shared/cli/index.ts";
import type { Entry, Files } from "../../shared/fs/index.ts";
import { checkResult } from "../schema/check.ts";
import { check } from "../use-cases/check.ts";
import type { PlanDeps } from "../use-cases/check.ts";

// `bdk plan check` over an in-memory project (spec `bdk-cli/plan`, "Plan check command").

const ROOT = "/work/app";
const PARTS = "openspec/changes/x/plan/parts";
const CONFIGURED = {
  [`${ROOT}/.bdk/settings.yaml`]: "",
  [`${ROOT}/openspec/config.yaml`]: "schema: bdk\n",
};

function memory(tree: Record<string, string>): Files & { readonly writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    readText: (path) => tree[path],
    list(dir) {
      const entries = new Map<string, boolean>();
      for (const path of Object.keys(tree)) {
        if (!path.startsWith(`${dir}/`)) continue;
        const [name = "", ...rest] = path.slice(dir.length + 1).split("/");
        entries.set(name, rest.length > 0 || entries.get(name) === true);
      }
      if (entries.size === 0) return undefined;
      return [...entries]
        .map(([name, dir]): Entry => ({ name, dir }))
        .sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    writeText: (path) => writes.push(path),
    appendText: (path) => writes.push(path),
  };
}

function part(id: string, deps: string[], files: string[], tasks = 2): string {
  return [
    "---",
    `id: "${id}"`,
    `depends-on: [${deps.map((dep) => `"${dep}"`).join(", ")}]`,
    "isolation: worktree",
    "files:",
    ...files.map((file) => `  - ${file}`),
    "---",
    "",
    "## Tasks",
    "",
    ...Array.from({ length: tasks }, (_, i) => `${String(i + 1)}. task`),
    "",
  ].join("\n");
}

function deps(
  tree: Record<string, string>,
  cwd = ROOT,
): PlanDeps & { files: { writes: string[] } } {
  return { files: memory(tree), cwd, home: "/home/me", env: {} };
}

function error(run: () => unknown): CliError {
  try {
    run();
  } catch (caught) {
    if (caught instanceof CliError) return caught;
    throw caught;
  }
  throw new Error("no error");
}

describe("check", () => {
  it("checks a plan without problems under the default limits", () => {
    const d = deps({
      ...CONFIGURED,
      [`${ROOT}/${PARTS}/01.md`]: part("01", [], ["src/a.ts"]),
      [`${ROOT}/${PARTS}/02.md`]: part("02", ["01"], ["src/b.ts"]),
    });
    const result = check(d, PARTS);
    expect(checkResult.parse(result)).toEqual(result);
    expect(result).toMatchObject({
      ok: true,
      limits: { maxTasks: 5, maxFiles: 10, maxBytes: 8192 },
      waves: [
        { wave: 1, parts: ["01"] },
        { wave: 2, parts: ["02"] },
      ],
      problems: [],
    });
    expect(d.files.writes).toEqual([]);
  });

  it("takes the limits from the configuration and an absolute directory", () => {
    const d = deps({
      ...CONFIGURED,
      [`${ROOT}/.bdk/settings.yaml`]: "plan:\n  part:\n    max-tasks: 7\n",
      [`${ROOT}/${PARTS}/01.md`]: part("01", [], ["src/a.ts"], 6),
    });
    const result = check(d, `${ROOT}/${PARTS}`);
    expect(result.limits).toEqual({ maxTasks: 7, maxFiles: 10, maxBytes: 8192 });
    expect(result.ok).toBe(true);
  });

  it("resolves the directory against a working directory below the root", () => {
    const d = deps(
      { ...CONFIGURED, [`${ROOT}/${PARTS}/01.md`]: part("01", [], ["src/a.ts"]) },
      `${ROOT}/openspec`,
    );
    expect(check(d, "changes/x/plan/parts").parts.map((p) => p.id)).toEqual(["01"]);
  });

  it("names stray .md files and ignores other files and directories", () => {
    const d = deps({
      ...CONFIGURED,
      [`${ROOT}/${PARTS}/01.md`]: part("01", [], ["src/a.ts"]),
      [`${ROOT}/${PARTS}/02-login.md`]: "x",
      [`${ROOT}/${PARTS}/notes.txt`]: "x",
      [`${ROOT}/${PARTS}/old/03.md`]: "x",
    });
    const result = check(d, PARTS);
    expect(result.parts.map((p) => p.id)).toEqual(["01"]);
    expect(result.problems).toEqual([
      { check: "name", parts: [], message: "02-login.md is not a part file; a part is NN.md" },
    ]);
  });

  it("reports a missing directory", () => {
    const failed = error(() => check(deps(CONFIGURED), "plan/parts"));
    expect([failed.code, failed.message]).toEqual([
      "env/plan-missing",
      "the plan directory plan/parts does not exist",
    ]);
  });

  it("reports an unconfigured project before reading the plan", () => {
    const failed = error(() =>
      check(deps({ [`${ROOT}/.git/HEAD`]: "", [`${ROOT}/plan/parts/01.md`]: "" }), "plan/parts"),
    );
    expect([failed.code, failed.message, failed.hint]).toEqual([
      "env/not-configured",
      `BDK is not configured in ${ROOT}: .bdk/settings.yaml and openspec/ missing`,
      "Run /bdk:setup.",
    ]);
  });

  it("reports an invalid configuration", () => {
    const failed = error(() =>
      check(
        deps({
          ...CONFIGURED,
          [`${ROOT}/.bdk/settings.yaml`]: "plan:\n  part:\n    max-files: many\n",
        }),
        PARTS,
      ),
    );
    expect([failed.code, failed.message, failed.hint]).toEqual([
      "env/config-invalid",
      "the BDK configuration has 1 problem",
      "Run bdk config check.",
    ]);
  });
});
