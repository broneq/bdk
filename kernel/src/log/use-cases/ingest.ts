// `bdk log ingest` (`kernel-cli/log`; T23-D25, D26): a role's report with its
// envelope as frontmatter, validated whole before anything is written, then
// stored at the dispatch package's `report` path with `schema`, `ticket` and
// `role` stamped. It writes no ledger entry: entries come only from `log add`.
import { join } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  listEntries,
  readDocument,
  STATE_KINDS,
  openPackage,
  writeDocument,
} from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import type { IngestReport } from "../domain/entry.ts";
import type { LogDeps } from "./deps.ts";
import { withChangeIndex } from "./deps.ts";
import { readEnvelope } from "./envelope.ts";
import type { Envelope } from "./envelope.ts";

/** Stamped by the kernel from the ticket and its package (P1). */
const STAMPED: readonly string[] = ["schema", "ticket", "role"];
const FIELDS: readonly string[] = ["status", "files", "entries", "evidence", "reason"];

export interface IngestInput {
  readonly ticket: string;
  readonly text: string;
}

export function ingestReport(
  deps: LogDeps,
  change: ActiveChange,
  input: IngestInput,
): Promise<IngestReport | Refusal> {
  // eslint-disable-next-line @typescript-eslint/require-await -- withChangeIndex takes an async body
  return withChangeIndex(deps, change, async (index): Promise<IngestReport | Refusal> => {
    const dispatch = openPackage(deps.store, change.projectRoot, change.dir, input.ticket);
    const report = dispatch?.data.report;
    if (dispatch === undefined || report === undefined) {
      return refuse(
        "policy/no-open-ticket",
        `${input.ticket} has no open attempt record with a dispatch package in ${change.id}`,
        ["bdk attempt list", "bdk dispatch build <target>"],
      );
    }
    const envelope = readEnvelope(input.text);
    if ("invalid" in envelope) return invalidEnvelope(envelope.invalid);
    const data = checkEnvelope(envelope, input.ticket, dispatch.role);
    if ("refused" in data) return data;
    const missing = missingIds(deps, change, index, input.ticket, data);
    if (missing !== undefined) return missing;
    const path = join(change.projectRoot, report);
    const replaced = deps.store.read(path) !== undefined;
    writeDocument(deps.store, path, { data, body: envelope.body });
    return {
      ticket: input.ticket,
      role: dispatch.role,
      path: report,
      status: data.status,
      entries: data.entries,
      replaced,
    };
  });
}

type ReportData = ReturnType<typeof STATE_KINDS.report.schema.parse>;

function invalidEnvelope(why: string): Refusal {
  return refuse("input/invalid-envelope", why, [
    "fix the named field and pipe the whole report again",
    `the frontmatter holds ${FIELDS.join(", ")}; reason only for blocked and needs-context`,
  ]);
}

/**
 * An empty or null `reason` on a status that needs none reads as absent: agents
 * fill the optional field in. On `blocked` and `needs-context` it stays, so the
 * schema still refuses it.
 */
function withoutEmptyReason(fields: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const { reason, ...rest } = fields;
  const empty = reason === null || reason === "";
  const needed = fields.status === "blocked" || fields.status === "needs-context";
  return empty && !needed ? rest : { ...fields };
}

/** The stamped envelope, or the refusal naming its first bad field and line. */
function checkEnvelope(envelope: Envelope, ticket: string, role: string): ReportData | Refusal {
  const at = (field: string) => `line ${String(envelope.lines[field] ?? envelope.end)}: ${field}`;
  const names = Object.keys(envelope.fields);
  const stamped = names.find((field) => STAMPED.includes(field));
  if (stamped !== undefined) {
    return refuse("input/forbidden-field", `${at(stamped)} is stamped by the kernel`, [
      "drop the field; the kernel stamps schema, ticket and role from the ticket",
    ]);
  }
  const unknown = names.find((field) => !FIELDS.includes(field));
  if (unknown !== undefined) {
    return invalidEnvelope(
      `${at(unknown)} is not an envelope field; allowed: ${FIELDS.join(", ")}`,
    );
  }
  const parsed = STATE_KINDS.report.schema.safeParse({
    schema: STATE_KINDS.report.version,
    ticket,
    role,
    ...withoutEmptyReason(envelope.fields),
  });
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  const field = String(issue?.path[0] ?? "status");
  const message = issue?.message ?? "";
  return invalidEnvelope(
    field in envelope.fields
      ? `${at(field)} is invalid: ${message}`
      : `${field} is missing from the frontmatter, which ends at line ${String(envelope.end)}: ${message}`,
  );
}

/** `policy/entries-missing` naming the envelope's ids not recorded under the ticket. */
function missingIds(
  deps: LogDeps,
  change: ActiveChange,
  index: IndexDb,
  ticket: string,
  data: ReportData,
): Refusal | undefined {
  const written = new Set(
    listEntries(index, change.id)
      .filter((entry) => entry.ticket === ticket)
      .map((entry) => entry.id),
  );
  const recorded = ticketEvidence(deps, change, ticket);
  const missing = [
    ...data.entries.filter((id) => !written.has(id)),
    ...data.evidence.filter((id) => !recorded.has(id)),
  ];
  if (missing.length === 0) return undefined;
  return refuse(
    "policy/entries-missing",
    `the envelope lists ${missing.join(", ")}, which ${missing.length === 1 ? "is" : "are"} not recorded under ${ticket}`,
    [`bdk log list`, `bdk log add <type> <summary> --ref <ref> --ticket ${ticket}`],
  );
}

/** The ids of the evidence manifests recorded under the ticket. */
function ticketEvidence(deps: LogDeps, change: ActiveChange, ticket: string): Set<string> {
  const dir = join(change.dir, "evidence");
  const ids = new Set<string>();
  for (const name of deps.store.list(dir)) {
    if (!name.endsWith(".md")) continue;
    const document = readDocument(deps.store, join(dir, name));
    if (document === undefined || !("data" in document) || document.kind !== "evidence") continue;
    if (document.data.ticket === ticket) ids.add(String(document.data.id));
  }
  return ids;
}
