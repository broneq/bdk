// Ids and qualified references (`kernel-cli`, Conventions, Identifiers). The
// format is provisional: T14 fixes the merge-safe one. Ids stay opaque to
// every caller, so only this module changes when it does.

export const ID_PREFIXES = ["L-", "A-", "E-"] as const;

export type IdPrefix = (typeof ID_PREFIXES)[number];

export interface Reference {
  readonly changeId?: string;
  readonly id: string;
}

const ID_LENGTH = 5;
const ID = /^[LAE]-[0-9a-z]+$/;
const CHANGE_ID = /^[a-z0-9][a-z0-9-]*$/;

/** A non-sequential id: no allocator, so two branches never collide on a counter. */
export function newId(prefix: IdPrefix, random: () => number = Math.random): string {
  let body = "";
  for (let i = 0; i < ID_LENGTH; i++) body += Math.floor(random() * 36).toString(36);
  return `${prefix}${body}`;
}

/** `L-m2x9v` within the active Change, `<changeId>/L-m2x9v` across Changes. */
export function parseReference(text: string): Reference | undefined {
  const parts = text.split("/");
  if (parts.length === 1 && ID.test(text)) return { id: text };
  const [changeId = "", id = ""] = parts;
  if (parts.length === 2 && CHANGE_ID.test(changeId) && ID.test(id)) return { changeId, id };
  return undefined;
}
