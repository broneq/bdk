// A living spec file read and rendered (`kernel-state`, Living spec file;
// T30-D6): the hash is the SHA-256 of the body's UTF-8 bytes.
import { createHash } from "node:crypto";

import { renderDocument, splitFrontmatter } from "../../shared/store/index.ts";
import { parseLiving } from "../domain/grammar.ts";
import type { LivingSpec } from "../domain/grammar.ts";
import { renderBody } from "../domain/render.ts";
import type { SpecContent } from "../domain/render.ts";

/** `sha256:` and the hex SHA-256 of the body's UTF-8 bytes. */
export function bodyHash(body: string): string {
  return `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`;
}

export function livingOf(text: string): LivingSpec {
  const { frontmatter, body } = splitFrontmatter(text);
  return parseLiving(frontmatter, body);
}

/** True when the file carries a `bdk-merge-hash` equal to its body's hash. */
export function hashMatches(living: LivingSpec): boolean {
  return living.hash !== undefined && living.hash === bodyHash(living.body);
}

export function renderLiving(
  capability: string,
  content: SpecContent,
  change: string,
): { readonly text: string; readonly hash: string } {
  const body = renderBody(capability, content);
  const hash = bodyHash(body);
  // Exactly the two frontmatter keys, in this order, through the one serializer.
  return { text: renderDocument({ "bdk-merge-hash": hash, "bdk-change": change }, body), hash };
}
