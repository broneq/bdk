// The Change directory layout and the rules directory as a table from path
// pattern to document kind (`kernel-state`, Change directory layout). Each
// row also names the frontmatter fields its file name repeats, so a document
// can never sit under a name that contradicts it.
import { CHANGE_ID_PATTERN } from "../../ids/index.ts";
import { attemptKind } from "./attempt.ts";
import { changeKind } from "./change.ts";
import type { DocumentKind } from "./common.ts";
import { designIndexKind, designKind, designPartKind } from "./design.ts";
import { dispatchKind } from "./dispatch.ts";
import { entryKind } from "./entry.ts";
import { evidenceKind } from "./evidence.ts";
import { planIndexKind, planPartKind } from "./plan.ts";
import { reportKind } from "./report.ts";
import { ruleKind } from "./rule.ts";

export const STATE_KINDS = {
  change: changeKind,
  entry: entryKind,
  attempt: attemptKind,
  evidence: evidenceKind,
  dispatch: dispatchKind,
  report: reportKind,
  "plan-part": planPartKind,
  "plan-index": planIndexKind,
  design: designKind,
  "design-part": designPartKind,
  "design-index": designIndexKind,
  rule: ruleKind,
} as const satisfies Record<string, DocumentKind>;

export type KindName = keyof typeof STATE_KINDS;

/** Files the layout maps but no schema checks: OpenSpec deltas and evidence captures. */
export type OpaqueKind = "spec-delta" | "evidence-capture";

type Data = Readonly<Record<string, unknown>>;

/** The frontmatter field that disagrees with the file name, if any. */
type NameCheck = (data: Data, groups: Readonly<Record<string, string>>) => string | undefined;

interface Row {
  readonly pattern: RegExp;
  readonly kind: KindName | OpaqueKind;
  readonly check?: NameCheck;
}

export interface Located {
  /** The path from `.bdk/` on, for messages. */
  readonly display: string;
  readonly kind: KindName | OpaqueKind;
  /** The frontmatter field that disagrees with the file name, if any. */
  readonly check: (data: Data) => string | undefined;
}

const ID = "[0-9a-z]{8}";
const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";

/** Compares fields with named groups; a function derives the expected value. */
function same(fields: Readonly<Record<string, (data: Data) => unknown>>): NameCheck {
  return (data, groups) =>
    Object.entries(fields).find(([group, value]) => String(value(data)) !== groups[group])?.[0];
}

const field =
  (name: string) =>
  (data: Data): unknown =>
    data[name];

/** `2026-09-25T09:41:07Z` as `20260925T094107Z`. */
const stamp = (data: Data): string => String(data.at).replaceAll("-", "").replaceAll(":", "");

const CHANGE_ROWS: readonly Row[] = [
  {
    pattern: new RegExp(`^log/(?<at>\\d{8}T\\d{6}Z)-(?<type>[a-z]+)-(?<id>L-${ID})\\.md$`),
    kind: "entry",
    check: same({ type: field("type"), id: field("id"), at: stamp }),
  },
  { pattern: /^(?:design|architecture)\.md$/, kind: "design" },
  {
    pattern: new RegExp(`^design/parts/(?<id>\\d{2})-${SLUG}\\.md$`),
    kind: "design-part",
    check: same({ id: field("id") }),
  },
  { pattern: /^design\/index\.md$/, kind: "design-index" },
  {
    pattern: new RegExp(`^plan/parts/(?<id>\\d{2})-${SLUG}\\.md$`),
    kind: "plan-part",
    check: same({ id: field("id") }),
  },
  { pattern: /^plan\/index\.md$/, kind: "plan-index" },
  { pattern: new RegExp(`^spec-delta/${SLUG}\\.md$`), kind: "spec-delta" },
  {
    pattern: new RegExp(`^attempts/(?<loop>.+)-(?<ticket>A-${ID})\\.md$`),
    kind: "attempt",
    check: same({
      ticket: field("ticket"),
      loop: (data) => `${String(data.loop)}-${String(data.target)}`,
    }),
  },
  {
    pattern: new RegExp(`^evidence/(?<target>.+)-(?<id>E-${ID})\\.md$`),
    kind: "evidence",
    check: same({ id: field("id"), target: field("target") }),
  },
  { pattern: new RegExp(`^evidence/.+-E-${ID}\\.(?!md$)[a-z0-9.]+$`), kind: "evidence-capture" },
  {
    pattern: new RegExp(`^dispatch/(?<role>.+)-(?<ticket>A-${ID})\\.md$`),
    kind: "dispatch",
    check: same({
      ticket: field("ticket"),
      role: (data) => `${String(data.target)}-${String(data.role)}`,
    }),
  },
  {
    pattern: new RegExp(`^reports/(?<role>.+)-(?<ticket>A-${ID})\\.md$`),
    kind: "report",
    check: (data, groups) =>
      same({ ticket: field("ticket") })(data, groups) ??
      (groups.role?.endsWith(`-${String(data.role)}`) === true ? undefined : "role"),
  },
];

const CHANGE_DIR = new RegExp(
  `^changes/(?:archive/)?(?<changeId>${CHANGE_ID_PATTERN})/(?<rest>.+)$`,
);
const RULE_FILE = /^rules\/(?<id>[^/]+)\.md$/;

const BDK = "/.bdk/";

/** The row an absolute path falls under, or undefined outside the layout. */
export function locate(path: string): Located | undefined {
  const normal = path.replaceAll("\\", "/");
  const start = normal.lastIndexOf(BDK);
  if (start < 0) return undefined;
  const inside = normal.slice(start + BDK.length);
  const display = `.bdk/${inside}`;

  const rule = RULE_FILE.exec(inside)?.groups;
  if (rule !== undefined) {
    return { display, kind: "rule", check: (data) => same({ id: field("id") })(data, rule) };
  }

  const change = CHANGE_DIR.exec(inside)?.groups;
  if (change?.changeId === undefined || change.rest === undefined) return undefined;
  if (change.rest === "change.md") {
    const { changeId } = change;
    return { display, kind: "change", check: (data) => (data.id === changeId ? undefined : "id") };
  }
  for (const row of CHANGE_ROWS) {
    const match = row.pattern.exec(change.rest);
    if (match === null) continue;
    const groups = match.groups ?? {};
    const check = row.check ?? (() => undefined);
    return { display, kind: row.kind, check: (data) => check(data, groups) };
  }
  return undefined;
}
