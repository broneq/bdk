// `plan/index.md` and `design/index.md` as pure functions of their parts
// (`kernel-state`, design D-8): parts sorted by id, a plan part's wave is one
// more than the highest wave of its dependencies.
import { KernelRefusal, refuse } from "../../refusal/index.ts";
import { designIndexKind } from "./design.ts";
import { planIndexKind } from "./plan.ts";
import { renderDocument } from "./render.ts";

interface Part {
  readonly id: string;
  readonly title: string;
  readonly "depends-on": readonly string[];
}

export function generatePlanIndex(parts: readonly Part[]): string {
  const waves = wavesOf("plan", parts);
  const rows = sorted(parts).map((part) => ({
    id: part.id,
    title: part.title,
    "depends-on": [...part["depends-on"]],
    wave: waves.get(part.id) ?? 1,
  }));
  const data = { schema: planIndexKind.version, generated: true, parts: rows };
  const table = rows.map((row) => [row.id, cell(row.title), dependencies(row), String(row.wave)]);
  return renderDocument(data, render(["Part", "Title", "Depends on", "Wave"], table));
}

export function generateDesignIndex(parts: readonly Part[]): string {
  wavesOf("design", parts);
  const rows = sorted(parts).map((part) => ({
    id: part.id,
    title: part.title,
    "depends-on": [...part["depends-on"]],
  }));
  const data = { schema: designIndexKind.version, generated: true, parts: rows };
  const table = rows.map((row) => [row.id, cell(row.title), dependencies(row)]);
  return renderDocument(data, render(["Part", "Title", "Depends on"], table));
}

function sorted(parts: readonly Part[]): Part[] {
  return [...parts].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The wave of every part; refuses a duplicate id, a missing dependency or a cycle. */
function wavesOf(what: "plan" | "design", parts: readonly Part[]): Map<string, number> {
  const byId = new Map<string, Part>();
  for (const part of sorted(parts)) {
    if (byId.has(part.id)) invalid(`${what} part id ${part.id} appears twice`);
    byId.set(part.id, part);
  }
  for (const part of byId.values()) {
    for (const dependency of part["depends-on"]) {
      if (!byId.has(dependency)) {
        invalid(`${what} part ${part.id} depends on ${dependency}, which does not exist`);
      }
    }
  }
  const waves = new Map<string, number>();
  const path: string[] = [];
  const visit = (id: string): number => {
    const known = waves.get(id);
    if (known !== undefined) return known;
    const start = path.indexOf(id);
    if (start >= 0) {
      const cycle = [...new Set(path.slice(start))].sort();
      invalid(`${what} parts ${cycle.join(", ")} form a dependency cycle`);
    }
    path.push(id);
    const wave = 1 + Math.max(0, ...(byId.get(id)?.["depends-on"] ?? []).map(visit));
    path.pop();
    waves.set(id, wave);
    return wave;
  };
  for (const id of byId.keys()) visit(id);
  return waves;
}

function invalid(why: string): never {
  throw new KernelRefusal(refuse("policy/validation-failed", why, ["fix depends-on in the parts"]));
}

function dependencies(part: Part): string {
  return part["depends-on"].length === 0 ? "-" : part["depends-on"].join(", ");
}

function cell(text: string): string {
  return text.replaceAll("|", "\\|");
}

function render(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]): string => `| ${cells.join(" | ")} |`;
  const rule = line(header.map((name) => "-".repeat(name.length)));
  return [line(header), rule, ...rows.map(line), ""].join("\n");
}
