// The dedupe key and the finding id (spec `bdk-cli/findings`, "Finding id and dedupe key";
// design D2). SHA-256 is a pure computation, not an OS access.
import { createHash } from "node:crypto";

export interface Keyed {
  readonly file?: string | undefined;
  readonly line?: number | undefined;
  readonly rule?: string | undefined;
  readonly summary: string;
}

/** NFKC, lowercase, every run of characters other than letters and digits to one space. */
export function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function dedupeKey({ file, line, rule, summary }: Keyed): string {
  const what = rule === undefined ? `summary:${normalise(summary)}` : `rule:${rule}`;
  return [file ?? "", line === undefined ? "" : String(line), what].join("\u001f");
}

export function findingId(finding: Keyed): string {
  return `f-${createHash("sha256").update(dedupeKey(finding)).digest("hex").slice(0, 12)}`;
}
