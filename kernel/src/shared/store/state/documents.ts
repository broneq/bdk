// Reading, writing and migrating state documents (`kernel-state`, Document
// schemas and validation, Schema versions and migrations; design D-3, D-7).
// Every Change document passes through here, so no invalid file is written
// and no invalid committed file is read without a refusal naming it.
import { parse } from "yaml";
import type * as z from "zod";

import { KernelRefusal, refuse } from "../../refusal/index.ts";
import type { Rule } from "../../refusal/index.ts";
import { splitFrontmatter } from "../frontmatter.ts";
import type { Store } from "../store.ts";
import type { DocumentKind } from "./common.ts";
import { locate, STATE_KINDS } from "./registry.ts";
import type { KindName, Located, OpaqueKind } from "./registry.ts";
import { renderDocument } from "./render.ts";

type Data = Record<string, unknown>;

export type StateDocument =
  | { readonly kind: KindName; readonly data: Data; readonly body: string }
  | { readonly kind: OpaqueKind; readonly body: string };

/** Replaces kinds, e.g. a later version with its migrations in tests. */
export type KindOverrides = Partial<Readonly<Record<KindName, DocumentKind>>>;

export type MigrationResult =
  | { readonly status: "current" }
  | { readonly status: "migrated"; readonly from: number; readonly to: number }
  | { readonly status: "skipped"; readonly why: string };

/** The document at `path`, validated; undefined when there is no file. */
export function readDocument(
  store: Store,
  path: string,
  kinds: KindOverrides = {},
): StateDocument | undefined {
  const text = store.read(path);
  if (text === undefined) return undefined;
  const located = locateOr(path, "state/ledger-invalid");
  if (isOpaque(located.kind)) return { kind: located.kind, body: text };
  const kind = kindOf(located.kind, kinds);
  const { data, body } = parseText(located, text);
  const version = data.schema;
  if (version !== kind.version && Number.isInteger(version)) {
    const found = Number(version);
    if (found < kind.version) {
      throw invalid(
        "state/ledger-invalid",
        `${located.display} carries ${located.kind} schema ${found}, this kernel reads ${kind.version}`,
        ["bdk rebuild"],
      );
    }
    throw invalid(
      "state/ledger-invalid",
      `${located.display} carries ${located.kind} schema ${found}, written by a newer BDK than this kernel (${kind.version})`,
      ["upgrade the BDK plugin, then retry"],
    );
  }
  return {
    kind: located.kind,
    data: validate(located, kind.schema, data, "state/ledger-invalid"),
    body,
  };
}

/** Validates, then writes in one step; an invalid document leaves the store unchanged. */
export function writeDocument(
  store: Store,
  path: string,
  document: { readonly data?: Readonly<Data>; readonly body: string },
  kinds: KindOverrides = {},
): void {
  const located = locateOr(path, "policy/validation-failed");
  if (isOpaque(located.kind)) {
    if (document.data !== undefined) {
      throw invalid("policy/validation-failed", `${located.display} takes no frontmatter`, [
        "write the body only",
      ]);
    }
    store.write(path, document.body);
    return;
  }
  if (document.data === undefined) {
    throw invalid("policy/validation-failed", `${located.display} needs frontmatter`, [
      `write a ${located.kind} document`,
    ]);
  }
  const kind = kindOf(located.kind, kinds);
  const data = validate(located, kind.schema, document.data, "policy/validation-failed");
  store.write(path, renderDocument(data, document.body));
}

/** Brings an older document to the current version of its kind; never downgrades. */
export function migrateDocument(
  store: Store,
  path: string,
  kinds: KindOverrides = {},
): MigrationResult {
  const text = store.read(path);
  const located = locate(path);
  if (text === undefined) return { status: "skipped", why: `${path} does not exist` };
  if (located === undefined) return { status: "skipped", why: `${path} is not a state document` };
  if (isOpaque(located.kind)) return { status: "current" };
  const kind = kindOf(located.kind, kinds);
  try {
    const { data, body } = parseText(located, text);
    const from = Number(data.schema);
    if (from === kind.version) return { status: "current" };
    if (from > kind.version) {
      return { status: "skipped", why: `${located.display} was written by a newer BDK` };
    }
    let migrated = data;
    for (let version = from; version < kind.version; version++) {
      const step = kind.migrations[version - 1];
      if (step === undefined) {
        return {
          status: "skipped",
          why: `${located.display}: no migration from ${located.kind} schema ${version}`,
        };
      }
      migrated = step(migrated);
    }
    const valid = validate(located, kind.schema, migrated, "state/ledger-invalid");
    store.write(path, renderDocument(valid, body));
    return { status: "migrated", from, to: kind.version };
  } catch (error) {
    if (error instanceof KernelRefusal) return { status: "skipped", why: error.refusal.why };
    throw error;
  }
}

function locateOr(path: string, rule: Rule): Located {
  const located = locate(path);
  if (located !== undefined) return located;
  throw invalid(rule, `${path} matches no row of the layout table`, [
    "move or remove the file; kernel-state lists the paths of a Change",
  ]);
}

function isOpaque(kind: KindName | OpaqueKind): kind is OpaqueKind {
  return kind === "spec-delta" || kind === "evidence-capture";
}

function kindOf(name: KindName, kinds: KindOverrides): DocumentKind {
  return kinds[name] ?? STATE_KINDS[name];
}

/** Frontmatter and body; the frontmatter must be a mapping with an integer `schema`. */
function parseText(located: Located, text: string): { data: Data; body: string } {
  const { frontmatter, body } = splitFrontmatter(text);
  const fail = (why: string): never => {
    throw invalid("state/ledger-invalid", `${located.display}: ${why}`, [
      `fix ${located.display} or restore it from git`,
    ]);
  };
  if (frontmatter === undefined) return fail("no YAML frontmatter");
  let data: unknown;
  try {
    data = parse(frontmatter);
  } catch (error) {
    return fail(`invalid YAML (${error instanceof Error ? error.message.split("\n")[0] : "?"})`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return fail("the frontmatter is not a mapping");
  }
  const record = data as Data;
  if (!Number.isInteger(record.schema)) return fail("schema: expected an integer version");
  return { data: record, body };
}

function validate(located: Located, schema: z.ZodType<Data>, data: unknown, rule: Rule): Data {
  const result = schema.safeParse(data);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const path = issue.path.join(".");
      const keys = issue.code === "unrecognized_keys" ? issue.keys.join(", ") : "";
      const name = [path, keys].filter((part) => part !== "").join(".");
      return name === "" ? issue.message : `${name}: ${issue.message}`;
    });
    throw invalid(rule, `${located.display}: ${problems.join("; ")}`, [`fix ${located.display}`]);
  }
  const mismatch = located.check(result.data);
  if (mismatch !== undefined) {
    throw invalid(rule, `${located.display}: ${mismatch} does not match the file name`, [
      `rename ${located.display} or fix ${mismatch}`,
    ]);
  }
  return result.data;
}

function invalid(rule: Rule, why: string, instead: readonly string[]): KernelRefusal {
  return new KernelRefusal(refuse(rule, why, instead));
}
