// Definitions every state document shares (`kernel-state`, Document schemas
// and validation). `kernel/scripts/export-schemas.ts` writes them to
// `schema/state/common.json`, and the kind schemas point there by `$ref`.
import * as z from "zod";

import { CHANGE_ID_PATTERN } from "../../ids/index.ts";

/** One document kind: its current version and the steps that reach it. */
export interface DocumentKind {
  readonly name: string;
  readonly version: number;
  readonly schema: z.ZodType<Record<string, unknown>>;
  /** `migrations[i]` turns version `i + 1` into version `i + 2`; empty at version 1. */
  readonly migrations: readonly Migration[];
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

const ID_BODY = "[0-9a-z]{8}";

export const ledgerId = z
  .string()
  .regex(new RegExp(`^L-${ID_BODY}$`))
  .meta({ description: "Ledger entry id." });

export const ticketId = z
  .string()
  .regex(new RegExp(`^A-${ID_BODY}$`))
  .meta({ description: "Attempt ticket id." });

export const evidenceId = z
  .string()
  .regex(new RegExp(`^E-${ID_BODY}$`))
  .meta({ description: "Evidence manifest id." });

export const changeId = z
  .string()
  .regex(new RegExp(`^${CHANGE_ID_PATTERN}$`))
  .meta({ description: "`<yyyy-mm-dd>-<slug>`, the slug kebab-case and at most 40 characters." });

export const idReference = z
  .string()
  .regex(new RegExp(`^(?:${CHANGE_ID_PATTERN}/)?[LAE]-${ID_BODY}$`))
  .meta({ description: "A bare id within the Change or `<changeId>/<id>` across Changes." });

export const hash = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const timestamp = z.iso
  .datetime({ precision: 0 })
  .meta({ description: "ISO 8601 UTC with seconds." });

export const date = z.iso.date();

export const relativePath = z
  .string()
  .regex(/^(?!\/|\.\/)(?!(?:.*\/)?\.\.(?:\/|$))[^\\]+$/)
  .meta({ description: "Relative to the project root, `/` separated, no `..` segment." });

export const role = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/)
  .meta({ description: "Role skill name (`implementer`, `plan-verifier`, ...)." });

export const agentSource = z.string().regex(/^agent:[a-z][a-z0-9-]*$/);

export const provenance = z
  .union([z.enum(["user", "policy", "inferred", "kernel"]), agentSource])
  .meta({ description: "Who produced the content (P1): a fixed value or `agent:<role>`." });

export const author = z.string().min(1).meta({ description: "Git `user.name <user.email>`." });

export const severity = z.enum(["critical", "high", "medium", "low"]);

export const scope = z.enum(["full", "high+", "blockers"]);

export const glob = z.string().min(1);
