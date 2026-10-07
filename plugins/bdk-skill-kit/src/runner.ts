import { createHash } from "node:crypto";
import { relative, resolve, sep } from "node:path";
import { settingOf, type LoadedConfig, type Settings } from "./config.ts";
import { discover } from "./discover.ts";
import type { Document, Finding, Report, Rule, Severity } from "./index.ts";

/** What the runner reads of a loaded config. */
type CheckConfig = Pick<LoadedConfig, "root" | "targets" | "rules" | "settings">;

export interface RunOptions {
  /** Directory the path arguments are relative to. */
  cwd: string;
  /** Skill directories or agent files that narrow per-file rules. */
  paths: string[];
}

export interface RunResult {
  findings: Finding[];
  /** Rule IDs enabled for at least one target, sorted. */
  enabledRules: string[];
  files: number;
  /** Whether a file lies inside the path arguments (always true without them). */
  inScope: (file: string) => boolean;
}

export function runChecks(config: CheckConfig, options: RunOptions): RunResult {
  const { docs, strays } = discover(config.root, config.targets);
  const findings: Finding[] = [];
  const narrow = options.paths.map((p) =>
    relative(config.root, resolve(options.cwd, p)).split(sep).join("/"),
  );
  const inScope = (file: string) =>
    narrow.length === 0 || narrow.some((p) => file === p || file.startsWith(`${p}/`));
  const selected = (doc: Document) => inScope(doc.path);

  for (const doc of docs.filter(selected)) {
    const target = config.targets.find((t) => t.name === doc.target.name);
    for (const rule of config.rules.values()) {
      if (!rule.check || !rule.kinds.includes(doc.kind)) continue;
      const setting = settingOf(rule, target?.settings ?? config.settings);
      if (setting.severity === "off") continue;
      rule.check(doc, context(config, rule, setting.severity, setting.options, doc.path, findings));
    }
  }

  for (const rule of config.rules.values()) {
    if (!rule.checkProject) continue;
    const setting = settingOf(rule, config.settings);
    if (setting.severity === "off") continue;
    const own = docs.filter((d) => rule.kinds.includes(d.kind));
    const ctx = context(config, rule, setting.severity, setting.options, "", findings);
    rule.checkProject(own, { ...ctx, strays });
  }

  findings.sort(compareFindings);
  return {
    findings,
    enabledRules: enabledRules(config),
    files: docs.filter(selected).length,
    inScope,
  };
}

/** Report order: file, line, rule, message. */
export function compareFindings(a: Finding, b: Finding): number {
  return (
    a.file.localeCompare(b.file) ||
    a.line - b.line ||
    a.rule.localeCompare(b.rule) ||
    a.message.localeCompare(b.message)
  );
}

function context(
  config: CheckConfig,
  rule: Rule<object>,
  severity: Severity,
  options: Record<string, unknown>,
  file: string,
  sink: Finding[],
) {
  return {
    options,
    root: config.root,
    report(report: Report) {
      const at = report.file ?? file;
      sink.push({
        rule: rule.id,
        severity: report.severity === "warning" ? "warning" : severity,
        file: at,
        line: report.line ?? 1,
        message: report.message,
        fingerprint: fingerprint(rule.id, at, report.match ?? report.message),
      });
    },
  };
}

function fingerprint(rule: string, file: string, text: string): string {
  const normalised = text.trim().replace(/\s+/g, " ");
  return createHash("sha256").update(`${rule}\0${file}\0${normalised}`).digest("hex").slice(0, 16);
}

function enabledRules(config: CheckConfig): string[] {
  const all: Settings[] = [config.settings, ...config.targets.map((t) => t.settings)];
  return [...config.rules.values()]
    .filter((rule) => all.some((settings) => settingOf(rule, settings).severity !== "off"))
    .map((rule) => rule.id)
    .sort();
}
