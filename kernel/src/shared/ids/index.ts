// Ids, Change ids and qualified references (`kernel-state`, Identifiers). An
// id is its prefix plus eight base36 characters drawn from a CSPRNG: no
// allocator, so two branches never collide on a counter. Ids stay opaque to
// every caller, so only this module knows the format.
import { randomInt } from "node:crypto";

export const ID_PREFIXES = ["L-", "A-", "E-"] as const;

export type IdPrefix = (typeof ID_PREFIXES)[number];

export interface Reference {
  readonly changeId?: string;
  readonly id: string;
}

/** Unanchored, so the state schemas can compose qualified references from it. */
export const ID_PATTERN = "[LAE]-[0-9a-z]{8}";

/** `<yyyy-mm-dd>-<slug>`: the lookahead caps the kebab-case slug at 40 characters. */
export const CHANGE_ID_PATTERN = String.raw`\d{4}-\d{2}-\d{2}-(?=[a-z0-9-]{1,40}(?:/|$))[a-z0-9]+(?:-[a-z0-9]+)*`;

const ID_LENGTH = 8;
const ID = new RegExp(`^${ID_PATTERN}$`);
const CHANGE_ID = new RegExp(`^${CHANGE_ID_PATTERN}$`);

/**
 * A fresh id. `random` returns a number in [0, 1) and replaces `node:crypto`
 * in tests; production callers leave it out.
 */
export function newId(prefix: IdPrefix, random?: () => number): string {
  let body = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    const digit = random === undefined ? randomInt(36) : Math.floor(random() * 36);
    body += digit.toString(36);
  }
  return `${prefix}${body}`;
}

/** `<yyyy-mm-dd>-<slug>`, the slug kebab-case and at most 40 characters. */
export function isChangeId(text: string): boolean {
  return CHANGE_ID.test(text);
}

/** `L-m2x9v7qa` within the active Change, `<changeId>/L-m2x9v7qa` across Changes. */
export function parseReference(text: string): Reference | undefined {
  const parts = text.split("/");
  if (parts.length === 1 && ID.test(text)) return { id: text };
  const [changeId = "", id = ""] = parts;
  if (parts.length === 2 && isChangeId(changeId) && ID.test(id)) return { changeId, id };
  return undefined;
}
