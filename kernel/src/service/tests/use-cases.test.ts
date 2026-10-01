// The two use cases on an in-memory store (`kernel-architecture`, Tests per slice).
import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../registrations.ts";
import { modeline, OFFLINE_SCHEMA_PATH, offlineSchemaText } from "../../shared/config/index.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { renderLiving } from "../../spec/use-cases/living.ts";
import { doctor } from "../use-cases/doctor.ts";
import { version } from "../use-cases/version.ts";

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

function doctorOn(
  files: Record<string, string>,
  options: { nodeVersion?: string; fix?: boolean } = {},
) {
  const store = memoryStore({ ...MANIFEST, ...files });
  const report = doctor({
    store,
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

function run(files: Record<string, string>, nodeVersion = "24.21.0") {
  return doctorOn(files, { nodeVersion }).report;
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
  it("is ok with no findings on a healthy project", () => {
    expect(run(HEALTHY)).toStrictEqual({
      ok: true,
      version: { kernel: "3.0.0", contract: 3, node: "24.21.0" },
      layout: "v3",
      findings: [],
    });
  });

  it("reports layout none without .bdk/", () => {
    expect(run({ [`${ROOT}/README.md`]: "" })).toMatchObject({
      ok: true,
      layout: "none",
      findings: [],
    });
  });

  it("finds the v2 layout with /bdk:setup as the repair", () => {
    const report = run({ [`${ROOT}/.bdk/settings.json`]: "{}", [`${ROOT}/.bdk/plans/`]: "" });
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

  it("takes the layout from the nearest .bdk/ below the work tree root", () => {
    const store = memoryStore({
      ...MANIFEST,
      [`${ROOT}/pkg/.bdk/runs/`]: "",
      [`${ROOT}/.bdk/`]: "",
    });
    const report = doctor({
      store,
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
    (nodeVersion) => {
      const report = run({}, nodeVersion);
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

  it.each(["22.13.0", "23.4.0", "26.9.0"])("passes the node-version check on %s", (nodeVersion) => {
    expect(run({}, nodeVersion).findings).toStrictEqual([]);
  });

  it("never names uv, uvx or an MCP server", () => {
    const text = JSON.stringify(run({ [`${ROOT}/.bdk/settings.json`]: "{}" }, "22.12.0"));
    expect(text).not.toMatch(/\buvx?\b|mcp/i);
  });
});

describe("doctor schema checks", () => {
  const OUTDATED = "# yaml-language-server: $schema=https://x/v2.6.0/schema/settings.json\n";

  it("runs no schema check without .bdk/settings.yaml", () => {
    expect(run({ [`${ROOT}/.bdk/settings.local.yaml`]: "languages: []\n" }).findings).toStrictEqual(
      [],
    );
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
  ])("finds %s", (_, files) => {
    const report = run({ ...HEALTHY, ...files });
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
  ])("finds an offline copy that is %s", (_, files) => {
    const report = run({ [`${ROOT}/.bdk/settings.yaml`]: `${MODELINE}\n`, ...files });
    expect(report.findings).toStrictEqual([
      {
        id: "schema-offline",
        level: "warn",
        summary: expect.stringContaining(OFFLINE_SCHEMA_PATH) as unknown,
        repair: "bdk doctor --fix",
      },
    ]);
  });

  it("repairs both with --fix, keeping the rest of each file byte for byte", () => {
    const project = "# mine\nlanguages: [go]  # stack\n";
    const { report, store } = doctorOn(
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

  it("reports only the findings --fix leaves", () => {
    const { report } = doctorOn(
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

  it("reports no finding for specs the merge wrote", () => {
    expect(run({ ...HEALTHY, [SPEC]: merged }).findings).toStrictEqual([]);
  });

  it("fails a spec edited after the merge, with the restore line as repair", () => {
    const report = run({ ...HEALTHY, [SPEC]: `${merged}Edited.\n` });
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

  it("fails a spec file without the key", () => {
    const report = run({ ...HEALTHY, [SPEC]: "# auth/login Specification\n" });
    expect(report.findings.map((item) => item.summary)).toStrictEqual([
      ".bdk/specs/auth/login/spec.md has no bdk-merge-hash: it was written outside spec merge",
    ]);
  });
});

describe("doctor rule checks (T31)", () => {
  const rule = (id: string, extra = ""): string =>
    `---\nschema: 1\nid: ${id}\nkind: house\nseverity: medium\norigin: user\nsince: 2026-09-30\n${extra}---\n\nText of ${id}.\n`;
  const PROJECTION = [
    "<!-- Generated by `bdk rules export --claude` from .bdk/rules/. Do not edit: change the rule files and rerun it. -->",
    "",
    "- [NAMING-1] Text of NAMING-1.",
    "",
  ].join("\n");
  const findings = (files: Record<string, string>) =>
    run({ ...HEALTHY, ...files }).findings.map(({ id, level, summary, repair }) => ({
      id,
      level,
      summary,
      repair,
    }));

  it("runs no rule check without .bdk/rules/ and .claude/rules/", () => {
    expect(findings({})).toStrictEqual([]);
  });

  it("is quiet on a valid rule whose projection is current", () => {
    expect(
      findings({
        [`${ROOT}/.bdk/rules/NAMING-1.md`]: rule("NAMING-1"),
        [`${ROOT}/.claude/rules/bdk-generated.md`]: PROJECTION,
      }),
    ).toStrictEqual([]);
  });

  it("warns on a hand-written .claude/rules file, not on the projection or a file with an id", () => {
    expect(
      findings({
        [`${ROOT}/.claude/rules/naming.md`]: "- Name things well.\n",
        [`${ROOT}/.claude/rules/web/forms.md`]: "- Forms go through actions.\n",
        [`${ROOT}/.claude/rules/tagged.md`]: "---\nid: X-1\n---\n\nText.\n",
        [`${ROOT}/.claude/rules/bdk-generated-scoped.md`]: "stale",
      }).filter((item) => item.id === "rule-without-id"),
    ).toStrictEqual([
      {
        id: "rule-without-id",
        level: "warn",
        summary: ".claude/rules/naming.md holds rules without an id",
        repair: "bdk rules import",
      },
      {
        id: "rule-without-id",
        level: "warn",
        summary: ".claude/rules/web/forms.md holds rules without an id",
        repair: "bdk rules import",
      },
    ]);
  });

  it("fails an invalid rule with the first problem and does not compare the projection", () => {
    const report = findings({ [`${ROOT}/.bdk/rules/NAMING-1.md`]: rule("NAMING-2") });
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({
      id: "rules-invalid",
      level: "fail",
      repair: "bdk rules check",
    });
    expect(report[0]?.summary).toContain(".bdk/rules/NAMING-1.md");
  });

  it("warns on an outdated projection", () => {
    expect(
      findings({
        [`${ROOT}/.bdk/rules/NAMING-1.md`]: rule("NAMING-1"),
        [`${ROOT}/.bdk/rules/API-1.md`]: rule("API-1", "applies: [src/api/**]\n"),
        [`${ROOT}/.claude/rules/bdk-generated.md`]: PROJECTION,
      }),
    ).toStrictEqual([
      {
        id: "projection-outdated",
        level: "warn",
        summary: ".claude/rules/bdk-generated-scoped.md differs from the rules under .bdk/rules/",
        repair: "bdk rules export --claude",
      },
    ]);
  });
});
