// The facts of one review round for the round metrics (round.ts, #158): the
// agents with their role, wall time and tokens from `bdk diagnostics report`,
// their stop times and the guard denials from the run journal, the round's
// packages and reports from the Change directory, and the binary files of
// the reviewed range from git. The parsers are pure; `readRound` reads the
// working copy of one run.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

import type { KernelCall } from "../stages/checks.ts";
import type { RoundAgent, RoundFacts, RoundGuard, RoundPackage, RoundReport } from "./round.ts";

const JOURNAL = ".bdk/.machine/telemetry/journal.jsonl";

/** A document's YAML frontmatter and its body; an empty mapping without frontmatter. */
export function splitFrontmatter(text: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text.replaceAll("\r\n", "\n"));
  if (match === null) return { data: {}, body: text };
  const data = parse(match[1] ?? "") as unknown;
  return {
    data: typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {},
    body: text.replaceAll("\r\n", "\n").slice(match[0].length),
  };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/** Every token count of an agent's per-model token object, summed; null when unknown. */
function tokenTotal(tokens: unknown): number | null {
  if (typeof tokens !== "object" || tokens === null) return null;
  let total = 0;
  for (const counts of Object.values(tokens)) {
    if (typeof counts !== "object" || counts === null) continue;
    for (const count of Object.values(counts as Record<string, unknown>)) {
      if (typeof count === "number") total += count;
    }
  }
  return total;
}

/** The journal's guard denials and the stop time of each agent. */
export function journalFacts(text: string): {
  guards: RoundGuard[];
  stops: Map<string, string>;
} {
  const guards: RoundGuard[] = [];
  const stops = new Map<string, string>();
  for (const raw of text.split("\n")) {
    if (raw.trim() === "") continue;
    let line: Record<string, unknown>;
    try {
      line = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (line.kind === "guard" && typeof line.rule === "string" && typeof line.agent === "string") {
      guards.push({ agent: line.agent, rule: line.rule });
    }
    if (
      line.kind === "agent-stop" &&
      typeof line.agent === "string" &&
      typeof line.at === "string"
    ) {
      stops.set(line.agent, line.at);
    }
  }
  return { guards, stops };
}

/** The agents of a `bdk diagnostics report --json` answer, with the journal's stop times. */
export function reportAgents(report: unknown, stops: ReadonlyMap<string, string>): RoundAgent[] {
  const agents = (report as { agents?: unknown } | undefined)?.agents;
  if (!Array.isArray(agents)) return [];
  return agents.map((item: Record<string, unknown>) => {
    const agent = String(item.agent);
    const stoppedAt = stops.get(agent);
    return {
      agent,
      role: typeof item.role === "string" ? item.role : null,
      wallMs: typeof item.wallMs === "number" ? item.wallMs : null,
      tokens: tokenTotal(item.tokens),
      ...(stoppedAt === undefined ? {} : { stoppedAt }),
    };
  });
}

function documents(dir: string): { data: Record<string, unknown>; body: string }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => splitFrontmatter(readFileSync(join(dir, name), "utf8")));
}

/** The grouped packages of a Change directory, from their frontmatter. */
export function roundPackages(changeDir: string): RoundPackage[] {
  return documents(join(changeDir, "dispatch"))
    .filter(({ data }) => typeof data.group === "string")
    .map(({ data }) => ({
      role: String(data.role),
      group: String(data.group),
      files: strings(data.files),
      entries: strings(data.entries),
    }));
}

/** The grouped reports of a Change directory, with their bodies. */
export function roundReports(changeDir: string): RoundReport[] {
  return documents(join(changeDir, "reports"))
    .filter(({ data }) => typeof data.group === "string")
    .map(({ data, body }) => ({ role: String(data.role), group: String(data.group), body }));
}

/** The files `git diff --numstat` counts as binary between the first commit and `HEAD`. */
function binaryFiles(workDir: string): string[] {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: workDir, encoding: "utf8", stdio: "pipe" });
  const [root] = git("rev-list", "--max-parents=0", "HEAD").trim().split("\n");
  if (root === undefined || root === "") return [];
  return git("diff", "--numstat", `${root}..HEAD`)
    .split("\n")
    .flatMap((line) => {
      const match = /^-\t-\t(.+)$/.exec(line);
      return match?.[1] === undefined ? [] : [match[1]];
    });
}

/** The one Change of the run's working copy: the seed opens exactly one. */
function changeDir(workDir: string): string | undefined {
  const root = join(workDir, ".bdk", "changes");
  if (!existsSync(root)) return undefined;
  const [id] = readdirSync(root).filter((name) => name !== "archive" && !name.startsWith("."));
  return id === undefined ? undefined : join(root, id);
}

export function readRound(
  workDir: string,
  kernel: (args: string) => KernelCall,
  session: string | undefined,
): RoundFacts {
  const journalPath = join(workDir, JOURNAL);
  const { guards, stops } = journalFacts(
    existsSync(journalPath) ? readFileSync(journalPath, "utf8") : "",
  );
  const report = kernel(
    session === undefined ? "diagnostics report" : `diagnostics report --session ${session}`,
  );
  const dir = changeDir(workDir);
  return {
    agents: report.code === 0 ? reportAgents(report.json, stops) : [],
    guards,
    packages: dir === undefined ? [] : roundPackages(dir),
    reports: dir === undefined ? [] : roundReports(dir),
    binary: binaryFiles(workDir),
  };
}
