// The two use cases on an in-memory store (`kernel-architecture`, Tests per slice).
import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../registrations.ts";
import { modeline, OFFLINE_SCHEMA_PATH, offlineSchemaText } from "../../shared/config/index.ts";
import type { Git } from "../../shared/git/index.ts";
import { KernelRefusal, refuse } from "../../shared/refusal/index.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { renderLiving } from "../../spec/use-cases/living.ts";
import { doctor } from "../use-cases/doctor.ts";
import { version } from "../use-cases/version.ts";
import { ruleFile } from "../../../tests/support/rule-file.ts";

const PLUGIN = "/plugins/bdk";
const ROOT = "/work/repo";
const GLOBAL = "/home/user/.config/bdk";
const MANIFEST = { [`${PLUGIN}/.claude-plugin/plugin.json`]: '{"version":"3.0.0"}' };

const settings = settingsRegistry();
const MODELINE = modeline("3.0.0");
/** A project whose settings carry the current modeline and whose offline copy is current. */
const HEALTHY = {
  [`${ROOT}/.bdk/settings.yaml`]: `${MODELINE}\n`,
  [`${ROOT}/${OFFLINE_SCHEMA_PATH}`]: offlineSchemaText(settings),
};

/** A git whose `check-ignore` answers `code` and `stdout`, recording each call. */
function checkIgnore(code: number, stdout = ""): Git & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    run: (args) => {
      calls.push([...args]);
      return Promise.resolve({ code, stdout, stderr: "" });
    },
    currentBranch: () => "main",
  };
}

/** No rule ignores `.bdk/settings.yaml`. */
const notIgnoring = checkIgnore(1);

async function doctorOn(
  files: Record<string, string>,
  options: { nodeVersion?: string; fix?: boolean; git?: Git } = {},
) {
  const store = memoryStore({ ...MANIFEST, ...files });
  const report = await doctor({
    store,
    git: options.git ?? notIgnoring,
    settings,
    pluginRoot: PLUGIN,
    contract: 3,
    nodeVersion: options.nodeVersion ?? "24.21.0",
    cwd: ROOT,
    workTree: ROOT,
    globalDir: GLOBAL,
    fix: options.fix ?? false,
  });
  return { report, store };
}

async function run(files: Record<string, string>, nodeVersion = "24.21.0") {
  return (await doctorOn(files, { nodeVersion })).report;
}

describe("version", () => {
  it("reports kernel, contract and Node", () => {
    const store = memoryStore(MANIFEST);
    expect(
      version({ store, pluginRoot: PLUGIN, contract: 3, nodeVersion: "22.12.0" }),
    ).toStrictEqual({
      kernel: "3.0.0",
      contract: 3,
      node: "22.12.0",
    });
  });

  it("reports the unknown version without a manifest", () => {
    expect(
      version({ store: memoryStore(), pluginRoot: PLUGIN, contract: 3, nodeVersion: "24.0.0" })
        .kernel,
    ).toBe("0.0.0-unknown");
  });
});

describe("doctor", () => {
  it("is ok with no findings on a healthy project", async () => {
    expect(await run(HEALTHY)).toStrictEqual({
      ok: true,
      version: { kernel: "3.0.0", contract: 3, node: "24.21.0" },
      layout: "v3",
      findings: [],
    });
  });

  it("reports layout none without .bdk/", async () => {
    expect(await run({ [`${ROOT}/README.md`]: "" })).toMatchObject({
      ok: true,
      layout: "none",
      findings: [],
    });
  });

  it("finds the v2 layout with /bdk:setup as the repair", async () => {
    const report = await run({ [`${ROOT}/.bdk/settings.json`]: "{}", [`${ROOT}/.bdk/plans/`]: "" });
    expect(report.ok).toBe(false);
    expect(report.layout).toBe("v2");
    expect(report.findings).toStrictEqual([
      {
        id: "v2-layout",
        level: "warn",
        summary: ".bdk/settings.json and .bdk/plans/ found",
        repair: "/bdk:setup",
      },
    ]);
  });

  it("takes the layout from the nearest .bdk/ below the work tree root", async () => {
    const store = memoryStore({
      ...MANIFEST,
      [`${ROOT}/pkg/.bdk/runs/`]: "",
      [`${ROOT}/.bdk/`]: "",
    });
    const report = await doctor({
      store,
      git: notIgnoring,
      settings,
      fix: false,
      pluginRoot: PLUGIN,
      contract: 3,
      nodeVersion: "24.21.0",
      cwd: `${ROOT}/pkg/src`,
      workTree: ROOT,
      globalDir: GLOBAL,
    });
    expect(report.layout).toBe("v2");
  });

  it.each(["22.12.9", "23.3.0"])(
    "fails the node-version check on %s with an install line",
    async (nodeVersion) => {
      const report = await run({}, nodeVersion);
      expect(report.ok).toBe(false);
      expect(report.findings).toStrictEqual([
        {
          id: "node-version",
          level: "fail",
          summary: `Node ${nodeVersion} is below 22.13.0; node:sqlite needs a flag`,
          repair: "nvm install 24 && nvm use 24",
        },
      ]);
    },
  );

  it.each(["22.13.0", "23.4.0", "26.9.0"])(
    "passes the node-version check on %s",
    async (nodeVersion) => {
      expect((await run({}, nodeVersion)).findings).toStrictEqual([]);
    },
  );

  it("never names uv, uvx or an MCP server", async () => {
    const text = JSON.stringify(await run({ [`${ROOT}/.bdk/settings.json`]: "{}" }, "22.12.0"));
    expect(text).not.toMatch(/\buvx?\b|mcp/i);
  });
});

describe("doctor ignore check (T32)", () => {
  const V2_RULE = ".gitignore:3:/.bdk/\t.bdk/settings.yaml\n";

  it("fails when a rule ignores .bdk/settings.yaml, naming the rule and its file", async () => {
    const git = checkIgnore(0, V2_RULE);
    const { report } = await doctorOn(HEALTHY, { git });
    expect(git.calls).toStrictEqual([
      ["check-ignore", "--no-index", "--verbose", ".bdk/settings.yaml"],
    ]);
    expect(report.ok).toBe(false);
    expect(report.findings).toStrictEqual([
      {
        id: "bdk-ignored",
        level: "fail",
        summary:
          ".gitignore ignores .bdk/settings.yaml with /.bdk/ (line 3), so the files BDK commits never reach git",
        repair: "/bdk:setup",
      },
    ]);
  });

  it("names a rule from another ignore file by that file", async () => {
    const git = checkIgnore(0, ".git/info/exclude:1:.bdk\t.bdk/settings.yaml\n");
    const { report } = await doctorOn(HEALTHY, { git });
    expect(report.findings[0]?.summary).toBe(
      ".git/info/exclude ignores .bdk/settings.yaml with .bdk (line 1), so the files BDK commits never reach git",
    );
  });

  it("reports nothing when only a negation matches", async () => {
    const git = checkIgnore(0, ".gitignore:2:!/.bdk/settings.yaml\t.bdk/settings.yaml\n");
    expect((await doctorOn(HEALTHY, { git })).report.findings).toStrictEqual([]);
  });

  it("reports nothing when no rule matches", async () => {
    expect((await doctorOn(HEALTHY, { git: checkIgnore(1) })).report.findings).toStrictEqual([]);
  });

  it("skips the check without .bdk/", async () => {
    const git = checkIgnore(0, V2_RULE);
    const { report } = await doctorOn({ [`${ROOT}/README.md`]: "" }, { git });
    expect(git.calls).toStrictEqual([]);
    expect(report.findings).toStrictEqual([]);
  });

  it("skips the check when git is missing or cannot answer", async () => {
    const missing: Git = {
      run: () =>
        Promise.reject(new KernelRefusal(refuse("runtime/git-missing", "no git", ["install git"]))),
      currentBranch: () => undefined,
    };
    expect((await doctorOn(HEALTHY, { git: missing })).report.findings).toStrictEqual([]);
    expect((await doctorOn(HEALTHY, { git: checkIgnore(128) })).report.findings).toStrictEqual([]);
  });

  it("orders the finding after the layout finding", async () => {
    const { report } = await doctorOn(
      { ...HEALTHY, [`${ROOT}/.bdk/plans/`]: "" },
      { git: checkIgnore(0, V2_RULE) },
    );
    expect(report.findings.map((finding) => finding.id)).toStrictEqual([
      "v2-layout",
      "bdk-ignored",
    ]);
  });
});

describe("doctor schema checks", () => {
  const OUTDATED = "# yaml-language-server: $schema=https://x/v2.6.0/schema/settings.json\n";

  it("runs no schema check without .bdk/settings.yaml", async () => {
    expect(
      (await run({ [`${ROOT}/.bdk/settings.local.yaml`]: "languages: []\n" })).findings,
    ).toStrictEqual([]);
  });

  it.each([
    [
      "a missing modeline in the project file",
      { [`${ROOT}/.bdk/settings.yaml`]: "languages: []\n" },
    ],
    [
      "another version's modeline in the project file",
      { [`${ROOT}/.bdk/settings.yaml`]: OUTDATED },
    ],
    [
      "a missing modeline in the local file",
      { [`${ROOT}/.bdk/settings.local.yaml`]: "features: {}\n" },
    ],
  ])("finds %s", async (_, files) => {
    const report = await run({ ...HEALTHY, ...files });
    expect(report.ok).toBe(false);
    expect(report.findings).toStrictEqual([
      {
        id: "schema-modeline",
        level: "warn",
        summary: expect.stringContaining(".bdk/settings") as unknown,
        repair: "bdk doctor --fix",
      },
    ]);
  });

  it.each([
    ["missing", {}],
    ["different", { [`${ROOT}/${OFFLINE_SCHEMA_PATH}`]: "{}\n" }],
  ])("finds an offline copy that is %s", async (_, files) => {
    const report = await run({ [`${ROOT}/.bdk/settings.yaml`]: `${MODELINE}\n`, ...files });
    expect(report.findings).toStrictEqual([
      {
        id: "schema-offline",
        level: "warn",
        summary: expect.stringContaining(OFFLINE_SCHEMA_PATH) as unknown,
        repair: "bdk doctor --fix",
      },
    ]);
  });

  it("repairs both with --fix, keeping the rest of each file byte for byte", async () => {
    const project = "# mine\nlanguages: [go]  # stack\n";
    const { report, store } = await doctorOn(
      {
        [`${ROOT}/.bdk/settings.yaml`]: project,
        [`${ROOT}/.bdk/settings.local.yaml`]: `${OUTDATED}features: {}\n`,
      },
      { fix: true },
    );
    expect(report).toMatchObject({ ok: true, findings: [] });
    expect(store.read(`${ROOT}/.bdk/settings.yaml`)).toBe(`${MODELINE}\n${project}`);
    expect(store.read(`${ROOT}/.bdk/settings.local.yaml`)).toBe(`${MODELINE}\nfeatures: {}\n`);
    expect(store.read(`${ROOT}/${OFFLINE_SCHEMA_PATH}`)).toBe(offlineSchemaText(settings));
  });

  it("reports only the findings --fix leaves", async () => {
    const { report } = await doctorOn(
      { [`${ROOT}/.bdk/settings.yaml`]: "", [`${ROOT}/.bdk/runs/`]: "" },
      { fix: true },
    );
    expect(report.findings.map((finding) => finding.id)).toStrictEqual(["v2-layout"]);
  });
});

describe("doctor merge-hash (T30-D13)", () => {
  const SPEC = `${ROOT}/.bdk/specs/auth/login/spec.md`;
  const merged = renderLiving(
    "auth/login",
    { purpose: "Signing in without a password, through a link sent by e-mail.", requirements: [] },
    "2026-09-25-passwordless-login",
  ).text;

  it("reports no finding for specs the merge wrote", async () => {
    expect((await run({ ...HEALTHY, [SPEC]: merged })).findings).toStrictEqual([]);
  });

  it("fails a spec edited after the merge, with the restore line as repair", async () => {
    const report = await run({ ...HEALTHY, [SPEC]: `${merged}Edited.\n` });
    expect(report.ok).toBe(false);
    expect(report.findings).toStrictEqual([
      {
        id: "merge-hash",
        level: "fail",
        summary:
          ".bdk/specs/auth/login/spec.md was edited outside spec merge: content hash differs from bdk-merge-hash",
        repair:
          "git restore --source=$(git log -1 --format=%H --grep='^chore(bdk): close' -- .bdk/specs/auth/login/spec.md) -- .bdk/specs/auth/login/spec.md",
      },
    ]);
  });

  it("fails a spec file without the key", async () => {
    const report = await run({ ...HEALTHY, [SPEC]: "# auth/login Specification\n" });
    expect(report.findings.map((item) => item.summary)).toStrictEqual([
      ".bdk/specs/auth/login/spec.md has no bdk-merge-hash: it was written outside spec merge",
    ]);
  });
});

describe("doctor rule checks (T31)", () => {
  const findings = async (files: Record<string, string>) =>
    (await run({ ...HEALTHY, ...files })).findings.map(({ id, level, summary, repair }) => ({
      id,
      level,
      summary,
      repair,
    }));

  it("runs no rule check without .bdk/rules/", async () => {
    expect(await findings({})).toStrictEqual([]);
  });

  it("is quiet on valid rules", async () => {
    expect(
      await findings({ [`${ROOT}/.bdk/rules/NAMING-1.md`]: ruleFile("NAMING-1") }),
    ).toStrictEqual([]);
  });

  it("never reports a file under .claude/rules/", async () => {
    expect(
      await findings({
        [`${ROOT}/.bdk/rules/NAMING-1.md`]: ruleFile("NAMING-1"),
        [`${ROOT}/.claude/rules/naming.md`]: "- Name things well.\n",
        [`${ROOT}/.claude/rules/web/forms.md`]: "- Forms go through actions.\n",
        [`${ROOT}/.claude/rules/bdk-generated-scoped.md`]: "stale",
      }),
    ).toStrictEqual([]);
  });

  it("fails an invalid rule with the first problem", async () => {
    const report = await findings({ [`${ROOT}/.bdk/rules/NAMING-1.md`]: ruleFile("NAMING-2") });
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({
      id: "rules-invalid",
      level: "fail",
      repair: "bdk rules check",
    });
    expect(report[0]?.summary).toContain(".bdk/rules/NAMING-1.md");
  });

  it("fails a rule with origin import", async () => {
    const report = await findings({
      [`${ROOT}/.bdk/rules/API-1.md`]: ruleFile("API-1", { origin: "import" }),
    });
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({
      id: "rules-invalid",
      level: "fail",
      repair: "bdk rules check",
    });
    expect(report[0]?.summary).toContain(".bdk/rules/API-1.md");
  });
});
