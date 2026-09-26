// Fingerprints (`kernel-state`, Fingerprints; design D-5): the kernel computes
// them and never takes them as input. The normalisation removes what carries
// no meaning in a lesson or a finding (case, punctuation, numbers) and nothing
// else; grouping differently worded lessons is T31's.
import { createHash } from "node:crypto";

const DIGITS = /\p{Nd}+/gu;
const OTHER = /[^\p{L}\p{M}\p{Nd}#]+/gu;
const SEPARATOR = "\u001f";

export function normalise(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(DIGITS, "#").replace(OTHER, " ").trim();
}

/** `sha256:` plus the hex SHA-256 of the parts joined by U+001F. */
export function fingerprint(parts: readonly string[]): string {
  return `sha256:${createHash("sha256").update(parts.join(SEPARATOR)).digest("hex")}`;
}

export function learningFingerprint(summary: string): string {
  return fingerprint(["learning", normalise(summary)]);
}

export function findingFingerprint(
  type: string,
  file: string,
  symbol: string | undefined,
  problem: string,
): string {
  return fingerprint(["finding", type, file, symbol ?? "", normalise(problem)]);
}
