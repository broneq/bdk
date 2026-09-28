// `bdk log ingest` (`kernel-cli/log`; T22 design D-13): the `bdk-entries`
// block of a read-only role's report, validated whole like `log add` before
// any entry is written, then appended under the ticket with the role's
// provenance. A whole report from stdin is stored at the package's `report`.
import { join } from "node:path";

import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  readDocument,
  refreshChange,
  STATE_KINDS,
  ticketDispatch,
} from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import { ENTRY_TYPES } from "../../shared/vocabulary/index.ts";
import type { EntryView, IngestReport } from "../domain/entry.ts";
import { supersedesProblem } from "./add.ts";
import { appendEntry } from "./append.ts";
import type { EntryDraft } from "./append.ts";
import { readBlock } from "./block.ts";
import type { BlockItem } from "./block.ts";
import type { LogDeps } from "./deps.ts";
import { withChangeIndex } from "./deps.ts";

/** Stamped by the kernel (P1); an item carrying one is `input/forbidden-field`. */
const STAMPED = ["id", "at", "author", "source", "ticket", "fingerprint"] as const;
const FIELDS = [
  "type",
  "summary",
  "refs",
  "body",
  "review",
  "supersedes",
  "status",
  "severity",
  "category",
  "options",
] as const;
const TYPES = ENTRY_TYPES.filter((type) => type !== "transition");

/** Stand-ins for the stamped fields, so the entry schema checks only what the role wrote. */
const STAND_INS = {
  schema: 1,
  id: "L-00000000",
  source: "kernel",
  author: "bdk",
  at: "2026-01-01T00:00:00Z",
} as const;
const FINGERPRINT = `sha256:${"0".repeat(64)}`;

export interface IngestInput {
  readonly ticket: string;
  readonly text: string;
  /** True when the text came from stdin: a whole report is then stored. */
  readonly stdin: boolean;
}

export function ingestBlock(
  deps: LogDeps,
  change: ActiveChange,
  input: IngestInput,
): Promise<IngestReport | Refusal> {
  return withChangeIndex(deps, change, async (index) => {
    const dispatch = ticketDispatch(index, change.id, input.ticket);
    if (dispatch === undefined) {
      return refuse(
        "policy/no-open-ticket",
        `${input.ticket} has no open attempt record with a dispatch package in ${change.id}`,
        ["bdk attempt list", "bdk attempt open <loop> <target>"],
      );
    }
    const block = readBlock(input.text);
    if ("invalid" in block) return invalidBlock(block.invalid);
    const drafts: EntryDraft[] = [];
    for (const item of block.items) {
      const draft = checkItem(deps, change, index, item, input.ticket);
      if (isRefusal(draft)) return draft;
      drafts.push(draft);
    }
    if (input.stdin && block.report) storeReport(deps, change, dispatch.path, input.text);
    const entries: EntryView[] = [];
    for (const draft of drafts) {
      const appended = await appendEntry(deps, change, index, draft, { dedupe: true });
      if (isRefusal(appended)) return appended;
      entries.push(appended.entry);
      refreshChange(index, { id: change.id, dir: change.dir, archived: false });
    }
    return { ticket: input.ticket, entries, downgraded: [] };
  });
}

function invalidBlock(why: string): Refusal {
  return refuse("input/invalid-block", why, [
    "end the report with one ```bdk-entries fence holding a YAML list of entries",
    "bdk log add <type> <summary> --ref <ref> for a single entry",
  ]);
}

/** The item as a draft, or the refusal naming its first invalid field and line. */
function checkItem(
  deps: LogDeps,
  change: ActiveChange,
  index: IndexDb,
  item: BlockItem,
  ticket: string,
): EntryDraft | Refusal {
  const { fields } = item;
  const at = (field: string) =>
    `item ${String(item.position)}, line ${String(item.lines[field] ?? item.line)}: ${field}`;
  const stamped = Object.keys(fields).find((field) =>
    (STAMPED as readonly string[]).includes(field),
  );
  if (stamped !== undefined) {
    return refuse("input/forbidden-field", `${at(stamped)} is stamped by the kernel`, [
      "drop the field; the kernel stamps it from the ticket",
    ]);
  }
  const unknown = Object.keys(fields).find(
    (field) => !(FIELDS as readonly string[]).includes(field),
  );
  if (unknown !== undefined) {
    return invalidBlock(`${at(unknown)} is not an entry field; allowed: ${FIELDS.join(", ")}`);
  }
  const type = fields.type;
  if (typeof type !== "string" || !(TYPES as readonly string[]).includes(type)) {
    return invalidBlock(
      `${at("type")} ${type === undefined ? "is missing" : `${JSON.stringify(type)} is not a type a role writes`}; one of: ${TYPES.join(", ")}`,
    );
  }
  if (fields.body !== undefined && typeof fields.body !== "string") {
    return invalidBlock(`${at("body")} is not a string`);
  }
  if (typeof fields.summary === "string" && fields.summary.trim() === "") {
    return invalidBlock(`${at("summary")} is empty`);
  }
  if (fields.status === "superseded" || fields.status === "routed") {
    return invalidBlock(
      `${at("status")} ${fields.status} is ${fields.status === "superseded" ? "derived from supersedes" : "set only by log route"}, never written`,
    );
  }
  const { body, ...rest } = fields;
  const parsed = STATE_KINDS.entry.schema.safeParse({
    ...STAND_INS,
    ticket,
    status: "proposed",
    ...rest,
    ...(type === "learning" ? { fingerprint: FINGERPRINT } : {}),
  });
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const field =
      issue?.code === "unrecognized_keys"
        ? (issue.keys[0] ?? "type")
        : String(issue?.path[0] ?? "type");
    const why =
      issue?.code === "unrecognized_keys"
        ? `is not a field of a ${type}`
        : `is invalid: ${issue?.message ?? ""}`;
    return invalidBlock(`${at(field)} ${why}`);
  }
  const data = parsed.data as Readonly<Record<string, unknown>>;
  const supersedes = data.supersedes as string | undefined;
  if (supersedes !== undefined) {
    const problem = supersedesProblem(deps, change, index, supersedes);
    if (problem !== undefined)
      return invalidBlock(`${at("supersedes")} ${supersedes} ${problem.why}`);
  }
  return {
    type,
    summary: data.summary as string,
    refs: data.refs as string[],
    body: body ?? "",
    ticket,
    ...(rest.status === undefined ? {} : { status: data.status as string }),
    ...(data.review === true ? { review: true } : {}),
    ...(supersedes === undefined ? {} : { supersedes }),
    ...(data.severity === undefined ? {} : { severity: data.severity as string }),
    ...(data.category === undefined ? {} : { category: data.category as string }),
    ...(data.options === undefined ? {} : { options: data.options as string[] }),
  };
}

/** A read-only role has no file tool: its report reaches the package's `report` path here. */
function storeReport(
  deps: LogDeps,
  change: ActiveChange,
  dispatchPath: string,
  text: string,
): void {
  const dispatch = readDocument(deps.store, join(change.projectRoot, dispatchPath));
  if (dispatch === undefined || !("data" in dispatch)) return;
  const report = dispatch.data.report;
  if (typeof report === "string") deps.store.write(join(change.projectRoot, report), text);
}
