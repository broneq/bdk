// `bdk ctx startup` (P11, T6): STARTUP_INSTRUCTIONS.md cut at the
// agents-table markers, and one row per agent file from its frontmatter. A
// missing marker or a broken agent file is a broken plugin: it throws.
import { join } from "node:path/posix";
import { parse } from "yaml";

import { splitFrontmatter } from "../../shared/store/index.ts";
import type { AgentRow, StartupSource } from "../domain/report.ts";
import type { CtxDeps } from "./input.ts";

const STARTUP_FILE = "STARTUP_INSTRUCTIONS.md";
const AGENTS_DIR = "agents";
const OPEN = "<!-- bdk:agents-table -->";
const CLOSE = "<!-- /bdk:agents-table -->";

export function readStartup(deps: Pick<CtxDeps, "store" | "pluginRoot">): StartupSource {
  const text = deps.store.read(join(deps.pluginRoot, STARTUP_FILE));
  if (text === undefined) throw new Error(`the plugin file ${STARTUP_FILE} is missing`);
  const lines = text.split("\n");
  const open = lines.indexOf(OPEN);
  const close = lines.indexOf(CLOSE);
  if (open === -1 || close < open) {
    throw new Error(`${STARTUP_FILE} has no ${OPEN} ... ${CLOSE} block`);
  }
  return { before: lines.slice(0, open + 1), rows: agents(deps), after: lines.slice(close) };
}

function agents(deps: Pick<CtxDeps, "store" | "pluginRoot">): AgentRow[] {
  const dir = join(deps.pluginRoot, AGENTS_DIR);
  return deps.store
    .list(dir)
    .filter((entry) => entry.endsWith(".md"))
    .map((file) => agentRow(`${AGENTS_DIR}/${file}`, deps.store.read(join(dir, file)) ?? ""))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function agentRow(path: string, text: string): AgentRow {
  const { frontmatter } = splitFrontmatter(text);
  const data: unknown = frontmatter === undefined ? undefined : parse(frontmatter);
  const field = (name: string): string => {
    const value =
      typeof data === "object" && data !== null
        ? (data as Record<string, unknown>)[name]
        : undefined;
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`${path} has no ${name} in its frontmatter`);
    }
    return value.trim().replace(/\s+/g, " ");
  };
  return { name: field("name"), model: field("model"), description: field("description") };
}
