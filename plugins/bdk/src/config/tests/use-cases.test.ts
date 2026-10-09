import { describe, expect, it } from "vitest";

import { CliError } from "../../shared/cli/index.ts";
import { loadConfig } from "../index.ts";
import { ShowResultSchema } from "../schema/show.ts";
import { findRoot, layerPaths, parseLayer } from "../store/layers.ts";
import type { ConfigDeps } from "../use-cases/load.ts";
import { check } from "../use-cases/check.ts";
import { set } from "../use-cases/set.ts";
import { show } from "../use-cases/show.ts";
import { GLOBAL, LOCAL, memory, OPENSPEC, PROJECT, ROOT } from "./memory.ts";

// The config use cases against an in-memory file system (spec `bdk-cli/config`).

function deps(files: Record<string, string>, cwd = ROOT, env: Record<string, string> = {}) {
  const fs = memory(files);
  const value: ConfigDeps = { files: fs, cwd, home: "/home/me", env };
  return { deps: value, fs };
}

function configured(extra: Record<string, string> = {}) {
  return deps({ [PROJECT]: "", [OPENSPEC]: "schema: spec-driven\n", ...extra });
}

function usage(fn: () => unknown): CliError {
  try {
    fn();
  } catch (error) {
    if (error instanceof CliError) return error;
    throw error;
  }
  throw new Error("expected a CliError");
}

describe("project root and layer paths", () => {
  it("finds the nearest directory holding .bdk/ or .git, else the working directory", () => {
    expect(findRoot(memory({ [PROJECT]: "" }), `${ROOT}/src/deep`)).toBe(ROOT);
    expect(findRoot(memory({ [`${ROOT}/.git`]: "gitdir: x" }), `${ROOT}/src`)).toBe(ROOT);
    expect(findRoot(memory({ "/other/file": "" }), "/nowhere/here")).toBe("/nowhere/here");
  });

  it("takes the global file from an absolute XDG_CONFIG_HOME only", () => {
    const base = { home: "/home/me" };
    expect(layerPaths({ ...base, env: { XDG_CONFIG_HOME: "/xdg" } }, ROOT).global).toBe(
      "/xdg/bdk/settings.yaml",
    );
    expect(layerPaths({ ...base, env: { XDG_CONFIG_HOME: "rel" } }, ROOT).global).toBe(GLOBAL);
    expect(layerPaths({ ...base, env: {} }, ROOT)).toEqual({
      global: GLOBAL,
      project: PROJECT,
      local: LOCAL,
    });
  });

  it("parses an empty file as an empty layer and names a syntax error's line", () => {
    expect(parseLayer("")).toEqual({ data: {} });
    expect(parseLayer("# nothing\n")).toEqual({ data: {} });
    expect(parseLayer("- a\n- b\n")).toEqual({ error: "the top level must be a mapping of keys" });
    const broken = parseLayer("a: 1\nb: 2\nc: d: e\n");
    expect("error" in broken && broken.error).toMatch(/^YAML syntax error at line 3/);
  });
});

describe("show", () => {
  it("prints every leaf with its origin layer", () => {
    const { deps: d } = configured({
      [GLOBAL]: "execution:\n  lead: foreground\n",
      [PROJECT]: "languages: [typescript]\nexecution:\n  lead: background\n",
      [LOCAL]: "models:\n  implementer:\n    model: sonnet\n",
    });
    const result = show(d);
    expect(ShowResultSchema.parse(result)).toEqual(result);
    if (result.status !== "ok") throw new Error(result.status);
    const byKey = Object.fromEntries(result.entries.map((entry) => [entry.key, entry]));
    expect(byKey.languages).toEqual({ key: "languages", value: ["typescript"], origin: "project" });
    expect(byKey["models.implementer.model"]).toEqual({
      key: "models.implementer.model",
      value: "sonnet",
      origin: "local",
    });
    expect(byKey["execution.lead"]?.origin).toBe("project");
    expect(byKey["plan.part.max-bytes"]).toEqual({
      key: "plan.part.max-bytes",
      value: 8192,
      origin: "default",
    });
    expect(result.layers.map((file) => [file.layer, file.present])).toEqual([
      ["global", true],
      ["project", true],
      ["local", true],
    ]);
  });

  it("takes a value from the highest layer that sets it", () => {
    const { deps: d } = configured({
      [GLOBAL]: "execution:\n  lead: foreground\n",
      [PROJECT]: "execution:\n  lead: background\n",
      [LOCAL]: "execution:\n  lead: foreground\n",
    });
    const result = show(d, "execution.lead");
    expect(result.status === "ok" && result.entries).toEqual([
      { key: "execution.lead", value: "foreground", origin: "local" },
    ]);
  });

  it("filters to a key and the keys under it", () => {
    const { deps: d } = configured();
    const result = show(d, "plan.part");
    expect(result.status === "ok" && result.entries.map((entry) => entry.key)).toEqual([
      "plan.part.max-tasks",
      "plan.part.max-files",
      "plan.part.max-bytes",
    ]);
    const absent = show(d, "models.implementer");
    expect(absent.status === "ok" && absent.entries).toEqual([]);
  });

  it("refuses a key that names no setting, suggesting the closest", () => {
    const error = usage(() => show(configured().deps, "plan.part.max-task"));
    expect(error.code).toBe("usage/unknown-key");
    expect(error.hint).toMatch(/did you mean plan\.part\.max-tasks\?/);
  });

  it("reports a project without settings or without openspec as not configured", () => {
    expect(show(deps({ [OPENSPEC]: "" }).deps)).toEqual({
      status: "not-configured",
      root: ROOT,
      missing: ["settings"],
    });
    expect(show(deps({ [PROJECT]: "" }).deps)).toMatchObject({ missing: ["openspec"] });
    expect(show(deps({ [GLOBAL]: "languages: [go]\n" }, ROOT).deps)).toMatchObject({
      missing: ["settings", "openspec"],
    });
  });

  it("reports an invalid configuration as a result", () => {
    const result = show(configured({ [LOCAL]: "execution:\n  lead: sideways\n" }).deps);
    expect(result).toMatchObject({
      status: "invalid",
      problems: [{ layer: "local", file: LOCAL, key: "execution.lead" }],
    });
  });
});

describe("check", () => {
  it("lists syntax and value problems with file and key", () => {
    const { problems } = check(
      configured({
        [PROJECT]: "plan:\n  part:\n    max-files: many\n",
        [LOCAL]: "a: 1\nb: 2\nc: [1\nd: 4\n",
      }).deps,
    );
    expect(problems).toEqual([
      expect.objectContaining({ layer: "local", file: LOCAL, key: "" }) as unknown,
      expect.objectContaining({
        layer: "project",
        file: PROJECT,
        key: "plan.part.max-files",
      }) as unknown,
    ]);
  });

  it("finds no problem in a valid configuration", () => {
    expect(check(configured({ [PROJECT]: "languages: [go]\n" }).deps).problems).toEqual([]);
  });
});

describe("set", () => {
  it("creates the project file with the key", () => {
    const { deps: d, fs } = deps({});
    expect(set(d, "execution.lead", "foreground")).toEqual({
      key: "execution.lead",
      value: "foreground",
      layer: "project",
      file: PROJECT,
    });
    expect(fs.data.get(PROJECT)).toBe("execution:\n  lead: foreground\n");
  });

  it("writes into the chosen layer, reading numbers, lists and strings as YAML", () => {
    const { deps: d, fs } = configured();
    set(d, "plan.part.max-tasks", "7", "local");
    set(d, "languages", "[typescript, go]", "global");
    expect(fs.data.get(LOCAL)).toBe("plan:\n  part:\n    max-tasks: 7\n");
    expect(fs.data.get(GLOBAL)).toBe("languages:\n  - typescript\n  - go\n");
    const result = show(d, "plan.part.max-tasks");
    expect(result.status === "ok" && result.entries).toEqual([
      { key: "plan.part.max-tasks", value: 7, origin: "local" },
    ]);
  });

  it("addresses an item by id, creating it in the layer", () => {
    const { deps: d, fs } = configured({
      [PROJECT]: "tools:\n  test:\n    - id: unit\n      command: pnpm test\n",
    });
    set(d, "tools.test.unit.scoped", "pnpm vitest {files}", "local");
    expect(fs.data.get(LOCAL)).toBe(
      "tools:\n  test:\n    - id: unit\n      scoped: pnpm vitest {files}\n",
    );
    expect(loadConfig(d)).toMatchObject({
      status: "ok",
      settings: {
        tools: { test: [{ id: "unit", command: "pnpm test", scoped: "pnpm vitest {files}" }] },
      },
    });
    set(d, "tools.test.unit.command", "vitest run");
    expect(fs.data.get(PROJECT)).toBe(
      "tools:\n  test:\n    - id: unit\n      command: vitest run\n",
    );
  });

  it("keeps comments and the order of other keys", () => {
    const { deps: d, fs } = configured({
      [PROJECT]: "# team settings\nlanguages: [go]\nexecution:\n  lead: background\n",
    });
    set(d, "execution.lead", "foreground");
    expect(fs.data.get(PROJECT)).toBe(
      "# team settings\nlanguages: [go]\nexecution:\n  lead: foreground\n",
    );
  });

  it("refuses an unknown key and an invalid value, writing nothing", () => {
    const { deps: d, fs } = configured({ [PROJECT]: "languages: [go]\n" });
    expect(usage(() => set(d, "policy.gate.review", "auto")).code).toBe("usage/unknown-key");
    const invalid = usage(() => set(d, "policy.gates.review", "sometimes"));
    expect(invalid.code).toBe("usage/invalid-value");
    expect(invalid.message).toMatch(/policy\.gates\.review/);
    expect(invalid.message).toMatch(/manual/);
    expect(usage(() => set(d, "tools.test.new.scoped", "x {files}")).message).toMatch(
      /tools\.test\.new\.command: required, missing/,
    );
    expect(usage(() => set(d, "languages", "[a, b")).code).toBe("usage/invalid-value");
    expect(fs.data.get(PROJECT)).toBe("languages: [go]\n");
    expect(fs.data.has(LOCAL)).toBe(false);
  });

  it("allows a value when the configuration already had other problems", () => {
    const { deps: d, fs } = configured({ [PROJECT]: "nope: 1\n" });
    set(d, "languages", "[go]");
    expect(fs.data.get(PROJECT)).toBe("nope: 1\nlanguages:\n  - go\n");
  });

  it("refuses a key whose way holds a scalar, and a layer that does not parse", () => {
    const { deps: d } = configured({ [PROJECT]: "plan: 5\n", [LOCAL]: "a: [1\n" });
    expect(usage(() => set(d, "plan.part.max-tasks", "3")).code).toBe("usage/invalid-value");
    expect(usage(() => set(d, "languages", "[go]", "local")).code).toBe("env/config-invalid");
  });
});
