import { parse } from "yaml";
import * as z from "zod";
import { describe, expect, it } from "vitest";

import { memoryStore } from "../../store/index.ts";
import {
  createConfigRegistry,
  defineConfigModule,
  definePromptKey,
  resolveConfig,
  SNAPSHOT_PATH,
  writeSnapshot,
} from "../index.ts";

const GLOBAL = "/home/dev/.config/bdk";
const PROJECT = "/repo";

const registry = createConfigRegistry({
  modules: [
    defineConfigModule({
      key: "features",
      consumer: "ctx",
      owner: "T12",
      description: "Switches.",
      schema: z
        .strictObject({ lavish: z.boolean().default(true), other: z.boolean().default(false) })
        .prefault({}),
    }),
    defineConfigModule({
      key: "languages",
      consumer: "ctx",
      owner: "T12",
      description: "Languages.",
      schema: z.array(z.string()).default([]),
    }),
  ],
  prompts: [definePromptKey({ key: "rules/security", consumer: "ctx", owner: "T12" })],
});

function resolve(files: Record<string, string>, removed?: "ignore" | "report") {
  const store = memoryStore(files);
  const context = {
    store,
    registry,
    globalDir: GLOBAL,
    projectRoot: PROJECT,
    pluginRoot: "/plugin",
    ...(removed === undefined ? {} : { removed }),
  };
  return { store, resolution: resolveConfig(context) };
}

describe("resolveConfig", () => {
  it("resolves the value, the origins and the prompt values of every layer", () => {
    const { resolution } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]: "languages: [go]\n",
      [`${PROJECT}/.bdk/settings.local.yaml`]: "features:\n  lavish: false\n",
    });
    expect(resolution.problems).toStrictEqual([]);
    expect(resolution.value).toStrictEqual({
      features: { lavish: false, other: false },
      languages: ["go"],
    });
    expect(resolution.merged.origins).toStrictEqual({
      languages: "project",
      "features.lavish": "local",
    });
    expect(resolution.prompts.values.get("rules/security")).toStrictEqual({
      mode: "extends",
      files: [],
    });
  });

  it("collects the problems of the keys and of the prompt files", () => {
    const { resolution } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]: "featurs: {}\n",
      [`${PROJECT}/.bdk/prompts/rules/x.md`]: "- x\n",
    });
    expect(resolution.value).toBeUndefined();
    expect(resolution.problems.map((problem) => problem.key)).toStrictEqual([
      "featurs",
      "prompts.rules/x",
    ]);
  });
});

describe("resolveConfig with removed v2 keys", () => {
  const WITH = {
    [`${PROJECT}/.bdk/settings.yaml`]: "features:\n  lavish: false\n  serena: true\n",
    [`${PROJECT}/.bdk/settings.local.yaml`]: "test-tools: [pytest]\n",
  };
  const WITHOUT = { [`${PROJECT}/.bdk/settings.yaml`]: "features:\n  lavish: false\n" };

  it("reports them by default", () => {
    const { resolution } = resolve(WITH);
    expect(resolution.problems.map((problem) => [problem.key, problem.rule])).toStrictEqual([
      ["features.serena", "policy/unknown-config-key"],
      ["test-tools", "policy/unknown-config-key"],
    ]);
    expect(resolution.value).toBeUndefined();
  });

  it("drops them without a problem when ignored, giving the value without them", () => {
    const ignored = resolve(WITH, "ignore").resolution;
    expect(ignored.problems).toStrictEqual([]);
    expect(ignored.value).toStrictEqual(resolve(WITHOUT).resolution.value);
  });

  it("still reports unknown keys and invalid values when ignored", () => {
    const { resolution } = resolve(
      {
        [`${PROJECT}/.bdk/settings.yaml`]:
          "features:\n  serena: true\n  lavish: maybe\nlanguage: [go]\n",
      },
      "ignore",
    );
    expect(resolution.problems.map((problem) => [problem.key, problem.rule])).toStrictEqual([
      ["language", "policy/unknown-config-key"],
      ["features.lavish", "policy/config-invalid"],
    ]);
  });
});

describe("writeSnapshot", () => {
  it("writes the resolved values, prompt files and the personally overridden keys", () => {
    const { store, resolution } = resolve({
      [`${GLOBAL}/settings.yaml`]: "features:\n  other: true\n",
      [`${PROJECT}/.bdk/settings.yaml`]: "languages: [go]\nfeatures:\n  lavish: true\n",
      [`${PROJECT}/.bdk/settings.local.yaml`]: "features:\n  lavish: false\n",
      [`${PROJECT}/.bdk/prompts.local/rules/security.md`]: "- mine\n",
    });
    const written = writeSnapshot(store, PROJECT, resolution);
    expect(written).toBe(SNAPSHOT_PATH);
    expect(SNAPSHOT_PATH).toBe(".bdk/.machine/config/resolved.yaml");
    const snapshot: unknown = parse(store.read(`${PROJECT}/${SNAPSHOT_PATH}`) ?? "");
    expect(snapshot).toStrictEqual({
      resolved: { features: { lavish: false, other: true }, languages: ["go"] },
      prompts: {
        "rules/security": {
          mode: "extends",
          files: [{ layer: "local", path: `${PROJECT}/.bdk/prompts.local/rules/security.md` }],
        },
      },
      overriddenKeys: ["features.lavish", "features.other", "prompts.rules/security"],
    });
  });

  it("never lists a key only the project layer sets", () => {
    const { store, resolution } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]: "languages: [go]\n",
    });
    writeSnapshot(store, PROJECT, resolution);
    const snapshot = parse(store.read(`${PROJECT}/${SNAPSHOT_PATH}`) ?? "") as {
      overriddenKeys: string[];
    };
    expect(snapshot.overriddenKeys).toStrictEqual([]);
  });

  it("writes nothing without .bdk/ or with problems", () => {
    const { store, resolution } = resolve({ [`${GLOBAL}/settings.yaml`]: "languages: [go]\n" });
    expect(writeSnapshot(store, PROJECT, resolution)).toBeUndefined();
    expect(store.exists(`${PROJECT}/.bdk`)).toBe(false);

    const broken = resolve({ [`${PROJECT}/.bdk/settings.yaml`]: "nope: 1\n" });
    expect(writeSnapshot(broken.store, PROJECT, broken.resolution)).toBeUndefined();
    expect(broken.store.exists(`${PROJECT}/${SNAPSHOT_PATH}`)).toBe(false);
  });
});
