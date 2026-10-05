// The acceptance catalogue (`acceptance-catalogue` spec): reads the catalogue
// table, matches its items against the bracketed IDs in test titles as
// `vitest list` reports them, and renders docs/V3-ACCEPTANCE.md. The contract
// test and `pnpm acceptance:report` share this module, so the guard and the
// report can never disagree.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { requirement, tableRows, column } from "./specs.ts";

type Evidence =
  | { readonly kind: "test" }
  | { readonly kind: "perf" }
  | { readonly kind: "report"; readonly path: string }
  | { readonly kind: "accepted"; readonly reason?: string }
  | { readonly kind: "open"; readonly issue?: number }
  | { readonly kind: "unknown"; readonly text: string };

export interface CatalogueItem {
  readonly id: string;
  readonly item: string;
  readonly evidence: readonly Evidence[];
}

export interface TestTitle {
  readonly project: string;
  /** Repository-relative path. */
  readonly file: string;
  /** Full name, `describe > ... > test`. */
  readonly name: string;
}

const REQUIREMENT = "Catalogue of acceptance items";
const CI_PROJECTS = ["unit", "e2e", "contract"];

export function parseCatalogue(specText: string): CatalogueItem[] {
  const rows = tableRows(requirement(specText, REQUIREMENT), "ID");
  if (rows.length === 0) throw new Error(`requirement "${REQUIREMENT}" has no catalogue table`);
  return rows.map((row) => ({
    id: column(row, "ID").replace(/`/g, ""),
    item: column(row, "Item"),
    evidence: parseEvidence(column(row, "Evidence")),
  }));
}

function parseEvidence(cell: string): Evidence[] {
  return [...cell.matchAll(/`([^`]+)`(?::\s*([^`]+?))?(?=,\s*`|$)/g)].map((m) => {
    const [word = "", ...rest] = (m[1] ?? "").split(/\s+/);
    const arg = rest.join(" ");
    const reason = m[2]?.trim();
    switch (word) {
      case "test":
      case "perf":
        return rest.length === 0 ? { kind: word } : { kind: "unknown", text: m[1] ?? "" };
      case "report":
        return { kind: "report", path: arg };
      case "accepted":
        return reason ? { kind: "accepted", reason } : { kind: "accepted" };
      case "open": {
        const issue = /^#(\d+)$/.exec(arg)?.[1];
        return issue ? { kind: "open", issue: Number(issue) } : { kind: "open" };
      }
      default:
        return { kind: "unknown", text: m[1] ?? "" };
    }
  });
}

export function catalogueProblems(items: readonly CatalogueItem[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const { id, evidence } of items) {
    if (seen.has(id)) out.push(`${id}: duplicate id`);
    seen.add(id);
    if (evidence.length === 0) out.push(`${id}: no evidence`);
    for (const e of evidence) {
      if (e.kind === "unknown") out.push(`${id}: unknown evidence \`${e.text}\``);
      if (e.kind === "accepted" && !e.reason) out.push(`${id}: \`accepted\` without a reason`);
      if (e.kind === "open" && e.issue === undefined) out.push(`${id}: \`open\` without an issue`);
      if (e.kind === "open" && id.startsWith("S"))
        out.push(`${id}: a success criterion cannot be \`open\``);
    }
  }
  return out;
}

/** The bracketed tokens of a title that look like catalogue IDs. */
function bracketIds(name: string): string[] {
  return [...name.matchAll(/\[([A-Z]+[0-9]*(?:-[A-Z0-9]+)*)\]/g)].map((m) => m[1] ?? "");
}

function prefixOf(id: string): string {
  return (id.split("-")[0] ?? "").replace(/[0-9]+$/, "");
}

export function evidenceProblems(
  items: readonly CatalogueItem[],
  titles: readonly TestTitle[],
  exists: (path: string) => boolean,
): string[] {
  const out: string[] = [];
  const known = new Set(items.map((i) => i.id));
  const prefixes = new Set(items.map((i) => prefixOf(i.id)));
  const answered = (id: string, projects: readonly string[]) =>
    titles.some((t) => projects.includes(t.project) && bracketIds(t.name).includes(id));
  for (const { id, evidence } of items) {
    for (const e of evidence) {
      if (e.kind === "test" && !answered(id, CI_PROJECTS)) {
        out.push(`${id}: no test in unit, e2e or contract names it`);
      }
      if (e.kind === "perf" && !answered(id, ["perf"])) out.push(`${id}: no test in perf names it`);
      if (e.kind === "report" && !exists(e.path))
        out.push(`${id}: report ${e.path} does not exist`);
    }
  }
  const unknown = new Set<string>();
  for (const t of titles) {
    for (const id of bracketIds(t.name)) {
      if (prefixes.has(prefixOf(id)) && !known.has(id))
        unknown.add(`${t.file}: [${id}] is not in the catalogue`);
    }
  }
  return [...out, ...[...unknown].sort()];
}

function evidenceLabel(e: Evidence): string {
  switch (e.kind) {
    case "perf":
      return "perf (local only)";
    case "report":
      return `report \`${e.path}\``;
    case "accepted":
      return `accepted: ${e.reason ?? ""}`;
    case "open":
      return `open #${e.issue ?? "?"}`;
    case "unknown":
      return e.text;
    default:
      return e.kind;
  }
}

export function renderReport(
  items: readonly CatalogueItem[],
  titles: readonly TestTitle[],
): string {
  const lines = [
    "<!-- Generated by `pnpm acceptance:report` from the acceptance-catalogue spec and the test titles. Do not edit: retitle the tests or change the catalogue and rerun it. -->",
    "",
    "# V3 acceptance report",
    "",
    "Every item of the v3 design's test list (`acceptance-catalogue` spec) and the tests that answer it. Perf tests never run in CI: the release measurement runs `pnpm test:perf` in a Linux container, as `CONTRIBUTING.md` shows.",
    "",
    "| ID | Item | Evidence | Tests |",
    "| --- | --- | --- | --- |",
  ];
  for (const { id, item, evidence } of items) {
    const projects = new Set(
      evidence.flatMap((e) =>
        e.kind === "test" ? CI_PROJECTS : e.kind === "perf" ? ["perf"] : [],
      ),
    );
    const tests = titles
      .filter((t) => projects.has(t.project) && bracketIds(t.name).includes(id))
      .map((t) => `\`${t.file}\`: ${t.name.replace(/\|/g, "\\|")}`)
      .sort();
    const cell = [...new Set(tests)].join("<br>");
    lines.push(
      `| \`${id}\` | ${item} | ${evidence.map(evidenceLabel).join(", ")} | ${cell} |`.replace(
        / {2}\|$/,
        " |",
      ),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** The catalogue spec: the main spec once archived, else the delta of the one active change that carries it. */
function cataloguePath(root: string): string {
  const main = join(root, "openspec/specs/acceptance-catalogue/spec.md");
  if (existsSync(main)) return main;
  const changes = join(root, "openspec/changes");
  const deltas = readdirSync(changes)
    .filter((name) => name !== "archive")
    .map((name) => join(changes, name, "specs/acceptance-catalogue/spec.md"))
    .filter((path) => existsSync(path));
  const [only, ...more] = deltas;
  if (only === undefined || more.length > 0) {
    throw new Error(`expected one acceptance-catalogue spec, found ${deltas.length}`);
  }
  return only;
}

export function readCatalogue(root: string): CatalogueItem[] {
  return parseCatalogue(readFileSync(cataloguePath(root), "utf8"));
}

/** Every test of every vitest project, collected without running it (design D3). */
export function collectTitles(root: string): TestTitle[] {
  const result = spawnSync("pnpm", ["exec", "vitest", "list", "--json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`vitest list failed:\n${result.stderr}`);
  const listed = JSON.parse(result.stdout) as { name: string; file: string; projectName: string }[];
  return listed.map((t) => ({
    project: t.projectName,
    file: relative(root, t.file),
    name: t.name,
  }));
}
