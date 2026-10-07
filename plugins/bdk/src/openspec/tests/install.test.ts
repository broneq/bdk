import { describe, expect, it } from "vitest";

import { run } from "../../shared/cli/index.ts";
import type { Entry, Files } from "../../shared/fs/index.ts";
import { openspecGroup } from "../index.ts";
import { InstallResultSchema } from "../schema/install.ts";

// `bdk openspec install` through the frame, against an in-memory file system.

const PLUGIN = "/plugins/bdk";
const ROOT = "/work/app";
const SOURCE = `${PLUGIN}/openspec/schemas/bdk`;
const TARGET = `${ROOT}/openspec/schemas/bdk`;

const SHIPPED = {
  [`${SOURCE}/schema.yaml`]: "name: bdk\nversion: 1\n",
  [`${SOURCE}/templates/design.md`]: "## Context\n",
  [`${SOURCE}/templates/part.md`]: '---\nid: "01"\n---\n',
};

/** A file system of `path -> text`; directories are implied by the paths. */
function memory(initial: Record<string, string>): Files & { readonly data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    readText: (path) => data.get(path),
    list(dir) {
      const entries = new Map<string, Entry>();
      for (const path of data.keys()) {
        if (!path.startsWith(`${dir}/`)) continue;
        const [name = "", ...rest] = path.slice(dir.length + 1).split("/");
        entries.set(name, { name, dir: rest.length > 0 });
      }
      if (entries.size === 0) return undefined;
      return [...entries.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    writeText: (path, text) => data.set(path, text),
    appendText: (path, text) => data.set(path, (data.get(path) ?? "") + text),
  };
}

async function bdk(files: Record<string, string>, ...argv: string[]) {
  const fs = memory(files);
  let stdout = "";
  let stderr = "";
  const code = await run({
    argv,
    version: "0.0.0",
    nodeVersion: "24.0.0",
    groups: [openspecGroup({ files: fs, cwd: ROOT, pluginRoot: PLUGIN })],
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return { code, stdout, stderr, fs };
}

describe("bdk openspec install", () => {
  it("copies every file of the shipped schema into the project", async () => {
    const { code, stdout, stderr, fs } = await bdk(SHIPPED, "openspec", "install");
    expect([code, stderr]).toEqual([0, ""]);
    expect(fs.data.get(`${TARGET}/schema.yaml`)).toBe("name: bdk\nversion: 1\n");
    expect(fs.data.get(`${TARGET}/templates/design.md`)).toBe("## Context\n");
    expect(fs.data.get(`${TARGET}/templates/part.md`)).toBe('---\nid: "01"\n---\n');
    expect(stdout).toBe(
      [
        "Installed the BDK OpenSpec schema in openspec/schemas/bdk: 3 added, 0 updated, 0 unchanged",
        "  added      schema.yaml",
        "  added      templates/design.md",
        "  added      templates/part.md",
        "",
      ].join("\n"),
    );
  });

  it("overwrites a changed file, keeps an equal one and leaves other files alone", async () => {
    const { code, stdout, fs } = await bdk(
      {
        ...SHIPPED,
        [`${TARGET}/schema.yaml`]: "name: bdk\nversion: 0\n",
        [`${TARGET}/templates/design.md`]: "## Context\n",
        [`${ROOT}/openspec/config.yaml`]: "schema: bdk\n",
      },
      "openspec",
      "install",
    );
    expect(code).toBe(0);
    expect(fs.data.get(`${TARGET}/schema.yaml`)).toBe("name: bdk\nversion: 1\n");
    expect(fs.data.get(`${ROOT}/openspec/config.yaml`)).toBe("schema: bdk\n");
    expect(stdout.split("\n")[0]).toBe(
      "Installed the BDK OpenSpec schema in openspec/schemas/bdk: 1 added, 1 updated, 1 unchanged",
    );
  });

  it("gives the same result on a second run, with nothing changed", async () => {
    const first = await bdk(SHIPPED, "openspec", "install");
    const again = await bdk(Object.fromEntries(first.fs.data), "openspec", "install");
    expect(again.code).toBe(0);
    expect(again.stdout.split("\n")[0]).toBe(
      "Installed the BDK OpenSpec schema in openspec/schemas/bdk: 0 added, 0 updated, 3 unchanged",
    );
    expect(again.fs.data).toEqual(first.fs.data);
  });

  it("prints a JSON result valid against its schema", async () => {
    const { code, stdout } = await bdk(SHIPPED, "openspec", "install", "--json");
    expect(code).toBe(0);
    const result = InstallResultSchema.parse(JSON.parse(stdout));
    expect(result).toEqual({
      schema: "bdk",
      target: "openspec/schemas/bdk",
      files: [
        { path: "schema.yaml", status: "added" },
        { path: "templates/design.md", status: "added" },
        { path: "templates/part.md", status: "added" },
      ],
    });
  });

  it("reports env/schema-missing when the plugin ships no schema, writing nothing", async () => {
    const text = await bdk({}, "openspec", "install");
    expect(text.code).toBe(3);
    expect(text.stderr).toContain(`${PLUGIN}/openspec/schemas/bdk`);
    expect(text.stderr).toContain("hint: Reinstall the bdk plugin.");
    expect(text.fs.data.size).toBe(0);
    const json = await bdk({}, "openspec", "install", "--json");
    expect(json.code).toBe(3);
    expect(JSON.parse(json.stdout)).toMatchObject({ error: { code: "env/schema-missing" } });
  });
});
