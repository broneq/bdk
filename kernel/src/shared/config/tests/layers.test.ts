import { describe, expect, it } from "vitest";

import { KernelRefusal } from "../../refusal/index.ts";
import { memoryStore } from "../../store/index.ts";
import { globalDir, layerFiles, readLayers } from "../index.ts";

const HOME = "/home/dev";
const PROJECT = "/work/repo";
const unix = { env: {}, platform: "linux", home: HOME };

describe("globalDir", () => {
  it("uses ~/.config/bdk without XDG_CONFIG_HOME", () => {
    expect(globalDir(unix)).toBe(`${HOME}/.config/bdk`);
  });

  it("uses an absolute XDG_CONFIG_HOME", () => {
    expect(globalDir({ ...unix, env: { XDG_CONFIG_HOME: "/xdg" } })).toBe("/xdg/bdk");
  });

  it("ignores a relative XDG_CONFIG_HOME, as the XDG spec says", () => {
    expect(globalDir({ ...unix, env: { XDG_CONFIG_HOME: "rel/xdg" } })).toBe(`${HOME}/.config/bdk`);
  });

  it("uses %APPDATA%\\bdk on Windows", () => {
    const windows = {
      env: { APPDATA: "C:\\Users\\dev\\AppData\\Roaming" },
      platform: "win32",
      home: "C:\\Users\\dev",
    };
    expect(globalDir(windows)).toBe("C:\\Users\\dev\\AppData\\Roaming\\bdk");
  });

  it("prefers an absolute XDG_CONFIG_HOME on Windows too", () => {
    const windows = {
      env: { APPDATA: "C:\\A", XDG_CONFIG_HOME: "D:\\xdg" },
      platform: "win32",
      home: "C:\\Users\\dev",
    };
    expect(globalDir(windows)).toBe("D:\\xdg\\bdk");
  });

  it("falls back to the home directory on Windows without APPDATA", () => {
    expect(globalDir({ env: {}, platform: "win32", home: "C:\\Users\\dev" })).toBe(
      "C:\\Users\\dev\\.config\\bdk",
    );
  });
});

describe("layerFiles", () => {
  it("names the three file layers in precedence order", () => {
    expect(layerFiles(`${HOME}/.config/bdk`, PROJECT)).toStrictEqual([
      { name: "global", path: `${HOME}/.config/bdk/settings.yaml` },
      { name: "project", path: `${PROJECT}/.bdk/settings.yaml` },
      { name: "local", path: `${PROJECT}/.bdk/settings.local.yaml` },
    ]);
  });
});

describe("readLayers", () => {
  const paths = { globalDir: `${HOME}/.config/bdk`, projectRoot: PROJECT };

  it("returns every present file layer in precedence order with its name, path and text", () => {
    const store = memoryStore({
      [`${HOME}/.config/bdk/settings.yaml`]: "languages: [go]\n",
      [`${PROJECT}/.bdk/settings.yaml`]: "features:\n  lavish: true\n",
      [`${PROJECT}/.bdk/settings.local.yaml`]: "features:\n  lavish: false\n",
    });
    expect(readLayers(store, paths)).toStrictEqual([
      {
        name: "global",
        path: `${HOME}/.config/bdk/settings.yaml`,
        text: "languages: [go]\n",
        values: { languages: ["go"] },
      },
      {
        name: "project",
        path: `${PROJECT}/.bdk/settings.yaml`,
        text: "features:\n  lavish: true\n",
        values: { features: { lavish: true } },
      },
      {
        name: "local",
        path: `${PROJECT}/.bdk/settings.local.yaml`,
        text: "features:\n  lavish: false\n",
        values: { features: { lavish: false } },
      },
    ]);
  });

  it("skips absent files and reads an empty file as an empty layer", () => {
    const store = memoryStore({ [`${PROJECT}/.bdk/settings.yaml`]: "" });
    expect(readLayers(store, paths)).toStrictEqual([
      { name: "project", path: `${PROJECT}/.bdk/settings.yaml`, text: "", values: {} },
    ]);
  });

  it("never reads the v2 settings.json", () => {
    const store = memoryStore({ [`${PROJECT}/.bdk/settings.json`]: '{"languages":["go"]}' });
    expect(readLayers(store, paths)).toStrictEqual([]);
  });

  it("refuses a YAML syntax error naming the file and the line", () => {
    const store = memoryStore({ [`${PROJECT}/.bdk/settings.yaml`]: "a: 1\nb: 2\nc: d: e\n" });
    const read = (): unknown => readLayers(store, paths);
    expect(read).toThrow(KernelRefusal);
    try {
      read();
    } catch (error) {
      const { refusal } = error as KernelRefusal;
      expect(refusal.rule).toBe("policy/config-invalid");
      expect(refusal.why).toContain(`${PROJECT}/.bdk/settings.yaml`);
      expect(refusal.why).toContain("line 3");
    }
  });

  it("refuses a file whose top level is not a mapping", () => {
    const store = memoryStore({ [`${HOME}/.config/bdk/settings.yaml`]: "- a\n- b\n" });
    expect(() => readLayers(store, paths)).toThrow(/settings\.yaml must hold a mapping/);
  });
});
