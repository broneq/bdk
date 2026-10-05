import { describe, expect, it } from "vitest";

import { readVersions } from "../../harness/paths.ts";
import {
  EXAMPLE_TASKS,
  ORCHESTRATOR_MODEL,
  SkillError,
  describeWithWithout,
  skillDir,
} from "./suite.ts";
import type { WithWithoutSpec } from "./suite.ts";
import { readTasks } from "./tasks.ts";

describe("skillDir", () => {
  it("finds a bdk skill by its frontmatter name, nested role skills too", () => {
    expect(skillDir("bdk:docs")).toStrictEqual({ pluginDir: ".", path: "tools/docs" });
    expect(skillDir("bdk:reviewer")).toStrictEqual({ pluginDir: ".", path: "roles/reviewer" });
  });

  it("finds a bdk-craft skill in plugins/bdk-craft, so the cells copy that plugin alone", () => {
    expect(skillDir("bdk-craft:tdd")).toStrictEqual({
      pluginDir: "plugins/bdk-craft",
      path: "tdd",
    });
  });

  it("refuses another plugin, a malformed name and an unknown skill", () => {
    expect(() => skillDir("other:tdd")).toThrow(SkillError);
    expect(() => skillDir("tdd")).toThrow(/bdk:<name> or bdk-craft:<name>/);
    expect(() => skillDir("bdk:nosuch")).toThrow(/no skill named nosuch under skills\//);
    expect(() => skillDir("bdk-craft:debug")).toThrow(
      /no skill named debug under plugins\/bdk-craft\/skills\//,
    );
    expect(() => skillDir("bdk:tdd")).toThrow(SkillError);
  });
});

function spec(fixture: "default" | "none"): WithWithoutSpec {
  return {
    skill: "bdk-craft:mermaid-drawer",
    series: "series-mermaid-drawer-2026-09-29",
    dir: "/tmp/ww",
    sandbox: "/tmp/sandbox",
    tasks: readTasks(EXAMPLE_TASKS),
    cells: {
      with: {
        plugin: "/tmp/sandbox/plugins/with",
        bdkCommit: "b".repeat(40),
        variantHash: "c".repeat(64),
      },
      without: {
        plugin: "/tmp/sandbox/plugins/without",
        bdkCommit: "b".repeat(40),
        variantHash: null,
      },
    },
    base: "/tmp/base",
    fixture,
    versions: readVersions(),
    runs: 5,
    runCapUsd: 15,
    resultsFile: "/tmp/rows.jsonl",
  };
}

describe("describeWithWithout", () => {
  const setup = describeWithWithout(spec("default"));

  it("has a with and a without cell that differ only in the plugin copy", () => {
    expect(Object.keys(setup.cells)).toEqual(["with", "without"]);
    const config = (cell: string): Record<string, unknown> => {
      const entry = setup.cells[cell];
      if (entry === undefined) throw new Error(cell);
      return { ...entry.provider.config };
    };
    const {
      plugins: withPlugins,
      working_dir: withDir,
      debug_file: withLog,
      ...withRest
    } = config("with");
    const {
      plugins: withoutPlugins,
      working_dir: withoutDir,
      debug_file: withoutLog,
      ...withoutRest
    } = config("without");
    expect(withRest).toEqual(withoutRest);
    expect(withPlugins).toEqual([{ type: "local", path: "/tmp/sandbox/plugins/with" }]);
    expect(withoutPlugins).toEqual([{ type: "local", path: "/tmp/sandbox/plugins/without" }]);
    expect([withDir, withoutDir, withLog, withoutLog]).toEqual([
      "/tmp/sandbox/work/with",
      "/tmp/sandbox/work/without",
      "/tmp/ww/debug/with.log",
      "/tmp/ww/debug/without.log",
    ]);
    expect(withRest.model).toBe(ORCHESTRATOR_MODEL);
    expect(setup.cells.with?.plan.fixtureBase).toBe("/tmp/base");
    expect(setup.cells.without?.plan.fixtureBase).toBe("/tmp/base");
  });

  it("runs every task under an id prefixed with the skill, with its assertions", () => {
    const tasks = readTasks(EXAMPLE_TASKS);
    expect(setup.items.map((item) => item.id)).toEqual(
      tasks.map((task) => `mermaid-drawer/${task.id}`),
    );
    expect(setup.items[0]?.assert).toEqual(tasks[0]?.assert);
    expect(setup.items[0]?.vars.bdk_prompt).toBe(tasks[0]?.prompt);
  });

  it("records the fixture commit only with the default fixture", () => {
    expect(setup.cells.with?.plan.provenance.fixtureCommit).toBe(readVersions().fixture.commit);
    expect(describeWithWithout(spec("none")).cells.with?.plan.provenance.fixtureCommit).toBeNull();
  });
});
