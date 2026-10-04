// `bdk log ingest` (`kernel-cli/log`; T23-D25, D26): a role's report with its
// envelope as frontmatter, validated whole before anything is written, then
// stored at the dispatch package's `report` path with `schema`, `ticket` and
// `role` stamped. It writes no ledger entry: entries come only from `log add`.
// A `<ticket>@<group>` report goes to the group package's path, and the
// reserved group `merge` stores the orchestrator's merged review of a round
// without a package (T42-A1, B1).
import { join, posix } from "node:path";

import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  listEntries,
  MERGE_GROUP,
  mergeReportName,
  readDocument,
  resolveTicketRef,
  STATE_KINDS,
  writeDocument,
} from "../../shared/store/index.ts";
import type { IndexDb, ResolvedRef } from "../../shared/store/index.ts";
import type { IngestReport } from "../domain/entry.ts";
import type { LogDeps } from "./deps.ts";
import { withChangeIndex } from "./deps.ts";
import { readEnvelope } from "./envelope.ts";
import type { Envelope } from "./envelope.ts";

/** Stamped by the kernel from the ticket and its package (P1). */
const STAMPED: readonly string[] = ["schema", "ticket", "role"];
const FIELDS: readonly string[] = ["status", "files", "entries", "evidence", "reason"];

/** The role a merged review is stored under: the main thread's, never a dispatched agent's. */
const ORCHESTRATOR = "orchestrator";

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
    const ref = resolveTicketRef(deps.store, change.projectRoot, change.dir, input.ticket);
    if (isRefusal(ref)) return ref;
    const target = reportTarget(change, ref);
    if (target === undefined) {
      return refuse(
        "policy/no-open-ticket",
        `${input.ticket} has no open attempt record with a dispatch package in ${change.id}`,
        ["bdk attempt list", "bdk dispatch build <target>"],
      );
    }
    const { role, report } = target;
    const envelope = readEnvelope(input.text);
    if ("invalid" in envelope) return invalidEnvelope(envelope.invalid);
    const checked = checkEnvelope(envelope, ref.ticket, role);
    if ("refused" in checked) return checked;
    const data = ref.group === undefined ? checked : { ...checked, group: ref.group };
    const missing = missingIds(deps, change, index, ref, data);
    if (missing !== undefined) return missing;
    const path = join(change.projectRoot, report);
    const replaced = deps.store.read(path) !== undefined;
    writeDocument(deps.store, path, { data, body: envelope.body });
    return {
      ticket: ref.ticket,
      role,
      path: report,
      status: data.status,
      entries: data.entries,
      replaced,
    };
  });
}

type ReportData = ReturnType<typeof STATE_KINDS.report.schema.parse>;

/**
 * The role and report path of the reference: the open ticket's active
 * package, the group's package, or for `merge` the orchestrator's merge
 * report of an open round; undefined when there is none.
 */
function reportTarget(
  change: ActiveChange,
  ref: ResolvedRef,
): { readonly role: string; readonly report: string } | undefined {
  if (!ref.open || ref.record === undefined) return undefined;
  if (ref.group === MERGE_GROUP) {
    const changeRel = posix.relative(change.projectRoot, change.dir);
    const name = mergeReportName(ref.record.data.target, ref.ticket);
    return { role: ORCHESTRATOR, report: `${changeRel}/reports/${name}` };
  }
  const report = ref.package?.data.report;
  return ref.package === undefined || report === undefined
    ? undefined
    : { role: ref.package.role, report };
}

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
  ref: ResolvedRef,
  data: ReportData,
): Refusal | undefined {
  const ticket = ref.group === undefined ? ref.ticket : `${ref.ticket}@${ref.group}`;
  // A group report lists its own group's entries; the merged review lists any of the round.
  const ofGroup = ref.group === undefined || ref.group === MERGE_GROUP ? undefined : ref.group;
  const written = new Set(
    listEntries(index, change.id)
      .filter((entry) => entry.ticket === ref.ticket)
      .filter((entry) => ofGroup === undefined || entry.group === ofGroup)
      .map((entry) => entry.id),
  );
  const recorded = ticketEvidence(deps, change, ref.ticket);
  const missing = [
    ...data.entries.filter((id) => !written.has(id)),
    ...data.evidence.filter((id) => !recorded.has(id)),
  ];
  if (missing.length === 0) return undefined;
  return refuse(
    "policy/entries-missing",
    `the envelope lists ${missing.join(", ")}, which ${missing.length === 1 ? "is" : "are"} not recorded under ${ticket}`,
    ref.group === MERGE_GROUP
      ? [
          `list in entries only the entries written under ${ref.ticket}; name entries of earlier rounds in the report body`,
          `bdk log list --since-ticket-start ${ref.ticket} --json: the items whose ticket is ${ref.ticket}`,
        ]
      : [`bdk log list`, `bdk log add <type> <summary> --ref <ref> --ticket ${ticket}`],
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
