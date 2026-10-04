// `bdk log decide <id> fix|defer|reject|track` (`kernel-cli/log`; T42-H): the
// human's disposition of a finding, observation or blocker the review left
// open, written in place with a decision line appended to the body
// (`kernel-state`, Derived state and mutation). `fix` triages the entry
// `blocker`, so the next `review-fix` round fixes it; `defer` and `track`
// accept it; `reject` resolves it.
import { join } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { findEntry, readDocument, writeDocument } from "../../shared/store/index.ts";
import type { Disposition } from "../../shared/vocabulary/index.ts";
import { withDecision } from "../domain/entry.ts";
import type { DecideResult } from "../domain/entry.ts";
import type { LogDeps } from "./deps.ts";
import { withChangeIndex } from "./deps.ts";

const DECIDED_TYPES: readonly string[] = ["finding", "blocker", "observation"];
const LIVE: readonly string[] = ["proposed", "accepted"];

export interface DecideInput {
  readonly id: string;
  readonly disposition: Disposition;
  readonly reason?: string;
  readonly issue?: string;
  readonly review: boolean;
}

export function decideEntry(
  deps: LogDeps,
  change: ActiveChange,
  input: DecideInput,
): Promise<DecideResult | Refusal> {
  const invalid = argumentProblem(input);
  if (invalid !== undefined) return Promise.resolve(invalid);
  return withChangeIndex(deps, change, (index) => {
    const id = input.id.startsWith(`${change.id}/`)
      ? input.id.slice(change.id.length + 1)
      : input.id;
    const entry = findEntry(index, change.id, id);
    if (entry === undefined) {
      return refuse("input/not-found", `${input.id} names no entry of ${change.id}`, [
        "bdk log list",
      ]);
    }
    if (!DECIDED_TYPES.includes(entry.type)) {
      return refuse(
        "input/invalid-argument",
        `${entry.id} is a ${entry.type}; a disposition applies to ${DECIDED_TYPES.join(", ")}`,
        ["bdk log list --type finding"],
      );
    }
    if (!LIVE.includes(entry.status)) {
      return refuse(
        "policy/invalid-transition",
        `${entry.id} is ${entry.status}; only a live entry is decided`,
        [`bdk log show ${entry.id}`],
      );
    }
    if (entry.level === "blocker" && input.disposition !== "fix") {
      return refuse(
        "policy/invalid-transition",
        `${entry.id} is triaged blocker; the review fixes it before its verdict passes`,
        [`bdk log decide ${entry.id} fix`, `bdk log triage ${entry.id} should-fix --reason <text>`],
      );
    }
    const path = join(change.projectRoot, entry.path);
    const document = readDocument(deps.store, path);
    if (document === undefined || !("data" in document)) {
      return refuse("input/not-found", `${input.id} names no entry of ${change.id}`, [
        "bdk log list",
      ]);
    }
    // `issue` belongs to `track` alone: any other disposition drops it.
    const kept = Object.fromEntries(
      Object.entries(document.data).filter(([key]) => key !== "issue"),
    );
    const level = input.disposition === "fix" ? "blocker" : entry.level;
    const status = statusAfter(input.disposition, entry.status);
    const review = input.review || entry.review;
    writeDocument(deps.store, path, {
      data: {
        ...kept,
        ...(level === undefined ? {} : { level }),
        status,
        disposition: input.disposition,
        ...(input.issue === undefined ? {} : { issue: input.issue }),
        ...(review ? { review: true } : {}),
      },
      body: withDecision(document.body, input.disposition, deps.clock.now(), input.reason),
    });
    return {
      record: entry.id,
      disposition: input.disposition,
      ...(input.issue === undefined ? {} : { issue: input.issue }),
      ...(level === undefined ? {} : { level }),
      status,
      review,
    };
  });
}

function argumentProblem(input: DecideInput): Refusal | undefined {
  if (input.disposition === "reject" && input.reason === undefined) {
    return refuse("input/missing-argument", "reject needs --reason: why the entry is no problem", [
      `bdk log decide ${input.id} reject --reason <text>`,
    ]);
  }
  if (input.disposition === "track" && input.issue === undefined) {
    return refuse("input/missing-argument", "track needs --issue: the filed tracker issue", [
      `bdk log decide ${input.id} track --issue <url|key>`,
    ]);
  }
  if (input.disposition !== "track" && input.issue !== undefined) {
    return refuse(
      "input/invalid-argument",
      `--issue goes with track only, not ${input.disposition}`,
      [
        `bdk log decide ${input.id} track --issue ${input.issue}`,
        `bdk log decide ${input.id} ${input.disposition}`,
      ],
    );
  }
  return undefined;
}

/** `defer` and `track` accept a proposed entry, `reject` resolves it, `fix` keeps it. */
function statusAfter(disposition: Disposition, status: string): string {
  if (disposition === "reject") return "resolved";
  if (disposition === "fix") return status;
  return status === "proposed" ? "accepted" : status;
}
