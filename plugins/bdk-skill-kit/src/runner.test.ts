import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.ts";
import { genericRules } from "./rules/index.ts";
import { runChecks } from "./runner.ts";
import { agent, skill, tree } from "./test-helpers.ts";

// A plugin module that reports one finding per document, used to observe what
// the runner feeds to rules.
const probePlugin = `
export default {
  name: "probe",
  rules: [
    {
      id: "every-doc",
      kinds: ["skills", "agents"],
      defaultSeverity: "error",
      defaultOptions: { label: "seen" },
      check(doc, ctx) { ctx.report({ message: ctx.options.label + " " + doc.path, line: 2 }); },
    },
    {
      id: "soft",
      kinds: ["skills"],
      defaultSeverity: "error",
      check(doc, ctx) { ctx.report({ message: "soft", severity: "warning" }); },
    },
    {
      id: "count",
      kinds: ["skills"],
      defaultSeverity: "off",
      checkProject(docs, ctx) { ctx.report({ message: docs.length + " skills", file: "x" }); },
    },
    {
      id: "strays",
      kinds: ["skills"],
      defaultSeverity: "off",
      checkProject(docs, ctx) { for (const s of ctx.strays) ctx.report({ message: s, file: s }); },
    },
    {
      id: "needs",
      kinds: ["skills"],
      defaultSeverity: "off",
      validateOptions(o) { return typeof o.x === "string" ? undefined : "option \`x\` must be a string"; },
      check() {},
    },
    {
      id: "needs-project",
      kinds: ["skills"],
      defaultSeverity: "off",
      validateOptions(o) { return o.x ? undefined : "option \`x\` is required"; },
      checkProject() {},
    },
  ],
};
`;

function project(config: string, extra: Record<string, string> = {}): string {
  return tree({
    "skill-check.config.mjs": config,
    "probe.mjs": probePlugin,
    "skills/alpha/SKILL.md": skill("alpha"),
    "skills/beta/SKILL.md": skill("beta"),
    "agents/rev.md": agent("rev"),
    ...extra,
  });
}

const base = `import probe from "./probe.mjs";
export default {
  targets: [{ kind: "skills", dirs: ["skills"] }, { kind: "agents", dirs: ["agents"] }],
  plugins: [probe],
  RULES
};`;

// The generic catalogue is switched off so only the probe rules report.
const genericOff = JSON.stringify(Object.fromEntries(genericRules.map((r) => [r.id, "off"])));

function config(rules = "rules: {}"): string {
  return base.replace("RULES", rules.replace("rules: {", `rules: { ...${genericOff},`));
}

async function run(root: string, paths: string[] = []) {
  const loaded = await loadConfig(root);
  return runChecks(loaded, { cwd: root, paths });
}

describe("loadConfig", () => {
  it("finds skill-check.config.mjs in the working directory", async () => {
    const root = project(config());
    const loaded = await loadConfig(root);
    expect(loaded.root).toBe(root);
    expect(loaded.targets.map((t) => [t.kind, t.profile, t.name])).toEqual([
      ["skills", "claude-code", "skills"],
      ["agents", "claude-code", "agents"],
    ]);
  });

  it("loads an explicit --config path and resolves targets from its directory", async () => {
    const root = project(config());
    const loaded = await loadConfig(join(root, "skills"), join(root, "skill-check.config.mjs"));
    expect(loaded.root).toBe(root);
  });

  it("fails when no config file exists", async () => {
    const root = tree({ "a.txt": "" });
    await expect(loadConfig(root)).rejects.toThrow(
      new ConfigError(`no skill-check.config.ts, .mjs or .js in ${root}`),
    );
  });

  it.each([
    ["an unknown rule ID", config(`rules: { "nope": "error" }`), "unknown rule `nope` in rules"],
    [
      "an unknown rule ID in a target",
      base
        .replace(`dirs: ["skills"] }`, `dirs: ["skills"], rules: { "probe/zzz": "off" } }`)
        .replace("RULES", ""),
      "unknown rule `probe/zzz` in target `skills`",
    ],
    [
      "a missing target directory",
      base.replace(`["agents"]`, `["nowhere"]`).replace("RULES", ""),
      "target `nowhere`: directory `nowhere` does not exist",
    ],
    [
      "a portable agents target",
      base
        .replace(`dirs: ["agents"] }`, `dirs: ["agents"], profile: "portable" }`)
        .replace("RULES", ""),
      "target `agents`: the portable profile has no agents (the Agent Skills standard defines only skills)",
    ],
    [
      "an invalid severity",
      config(`rules: { "probe/soft": "loud" }`),
      "rule `probe/soft`: setting must be off, warning, error or [severity, options]",
    ],
    [
      "a duplicate plugin rule",
      base.replace("plugins: [probe]", "plugins: [probe, probe]").replace("RULES", ""),
      "duplicate rule ID `probe/every-doc`",
    ],
  ])("rejects %s", async (_label, text, message) => {
    await expect(loadConfig(project(text))).rejects.toThrow(new ConfigError(message));
  });

  it.each([
    [
      "a per-file rule enabled without its option",
      config(`rules: { "probe/needs": "error" }`),
      "rule `probe/needs` in target `skills`: option `x` must be a string",
    ],
    [
      "a per-file rule enabled in one target with a bad option",
      base
        .replace(
          `dirs: ["skills"] }`,
          `dirs: ["skills"], rules: { "probe/needs": ["warning", { x: 1 }] } }`,
        )
        .replace("RULES", ""),
      "rule `probe/needs` in target `skills`: option `x` must be a string",
    ],
    [
      "a project rule enabled without its option",
      config(`rules: { "probe/needs-project": "error" }`),
      "rule `probe/needs-project`: option `x` is required",
    ],
  ])("rejects %s", async (_label, text, message) => {
    await expect(loadConfig(project(text))).rejects.toThrow(new ConfigError(message));
  });

  it("validates options only where a rule is enabled for a matching kind", async () => {
    const agentsOnly = base
      .replace(`dirs: ["agents"] }`, `dirs: ["agents"], rules: { "probe/needs": "error" } }`)
      .replace("RULES", "");
    await expect(loadConfig(project(agentsOnly))).resolves.toBeDefined();
    const valid = config(
      `rules: { "probe/needs": ["error", { x: "y" }], "probe/needs-project": ["error", { x: 1 }] }`,
    );
    await expect(loadConfig(project(valid))).resolves.toBeDefined();
  });

  it("rejects a config whose plugin fails to load", async () => {
    const root = project(
      `import x from "./missing.mjs"; export default { targets: [], plugins: [x] };`,
    );
    await expect(loadConfig(root)).rejects.toThrow(/^cannot load skill-check\.config\.mjs: /);
  });

  it("rejects a config without a targets array", async () => {
    await expect(loadConfig(project("export default {};"))).rejects.toThrow(
      new ConfigError("the config must export a default object with a `targets` array"),
    );
  });
});

describe("runChecks", () => {
  it("runs each rule over every document of its kinds with merged options", async () => {
    const result = await run(project(config(`rules: { "probe/soft": "off" }`)));
    expect(result.findings.map((f) => [f.rule, f.severity, f.file, f.line, f.message])).toEqual([
      ["probe/every-doc", "error", "agents/rev.md", 2, "seen agents/rev.md"],
      ["probe/every-doc", "error", "skills/alpha/SKILL.md", 2, "seen skills/alpha/SKILL.md"],
      ["probe/every-doc", "error", "skills/beta/SKILL.md", 2, "seen skills/beta/SKILL.md"],
    ]);
  });

  it("applies rule options and severity from the config", async () => {
    const result = await run(
      project(
        config(`rules: { "probe/every-doc": ["warning", { label: "hi" }], "probe/soft": "off" }`),
      ),
    );
    expect(result.findings[0]).toMatchObject({ severity: "warning", message: "hi agents/rev.md" });
  });

  it("lets a target override the config's rule settings", async () => {
    const text = base
      .replace(`dirs: ["agents"] }`, `dirs: ["agents"], rules: { "probe/every-doc": "off" } }`)
      .replace("RULES", `rules: { "probe/soft": "off" }`);
    const result = await run(project(text));
    expect(result.findings.map((f) => f.file)).toEqual([
      "skills/alpha/SKILL.md",
      "skills/beta/SKILL.md",
    ]);
  });

  it("caps a report marked warning even when the rule is set to error", async () => {
    const result = await run(project(config(`rules: { "probe/every-doc": "off" }`)));
    expect(result.findings.map((f) => f.severity)).toEqual(["warning", "warning"]);
  });

  it("runs project rules once over every document of their kinds", async () => {
    const text = config(
      `rules: { "probe/every-doc": "off", "probe/soft": "off", "probe/count": "error" }`,
    );
    const result = await run(project(text));
    expect(result.findings.map((f) => f.message)).toEqual(["2 skills"]);
  });

  it("gives project rules the directories without a skill file", async () => {
    const text = config(
      `rules: { "probe/every-doc": "off", "probe/soft": "off", "probe/strays": "error" }`,
    );
    const result = await run(project(text, { "skills/loose/notes.md": "x" }));
    expect(result.findings.map((f) => f.message)).toEqual(["skills/loose"]);
  });

  it("parses a skill file in the wrong letter case as that skill", async () => {
    const text = config(`rules: { "probe/soft": "off" }`);
    const result = await run(project(text, { "skills/gamma/skill.md": skill("gamma") }));
    expect(result.findings.map((f) => f.file)).toContain("skills/gamma/skill.md");
  });

  it("narrows per-file rules to the given paths, not project rules", async () => {
    const text = config(`rules: { "probe/soft": "off", "probe/count": "error" }`);
    const result = await run(project(text), ["skills/beta"]);
    expect(result.findings.map((f) => f.message)).toEqual([
      "seen skills/beta/SKILL.md",
      "2 skills",
    ]);
  });

  it("lists the rule IDs enabled anywhere in the config", async () => {
    const root = project(config(`rules: { "probe/soft": "off", "probe/count": "error" }`));
    const result = await run(root);
    expect(result.enabledRules).toEqual(["probe/count", "probe/every-doc"]);
  });

  it("gives every finding a line-independent fingerprint", async () => {
    const result = await run(project(config(`rules: { "probe/soft": "off" }`)));
    const [a, b] = result.findings;
    expect(a?.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(a?.fingerprint).not.toBe(b?.fingerprint);
  });
});
