// Writers for the three output forms of `kernel-cli` (Output modes,
// Conventions): the JSON object, the text rendering capped at 100 lines, the
// four-line refusal and the two-line STOP block of inject mode.
import * as z from "zod";

import type { Refusal } from "../refusal/index.ts";

/** The design's "<= 100 lines" rule: text output and list pages stop here unless `--all`. */
export const TEXT_LINE_CAP = 100;

export interface ListPage<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly truncated: boolean;
  readonly for?: string;
}

export interface PageOptions {
  readonly all?: boolean;
  readonly for?: string;
}

/** Where the kernel writes; `main.ts` binds it to the process, tests to strings. */
export interface Streams {
  stdout(text: string): void;
  stderr(text: string): void;
}

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function refusalText(refusal: Refusal): string {
  const lines = [`refused: ${refusal.rule}`, `why: ${refusal.why}`];
  for (const action of refusal.instead) lines.push(`instead: ${action}`);
  return `${lines.join("\n")}\n`;
}

export function stopBlock(refusal: Pick<Refusal, "why" | "instead">): string {
  return `BDK STOP: ${refusal.why}\nInstead: ${refusal.instead.join("; ")}\n`;
}

export function capLines(text: string, options: PageOptions = {}): string {
  const lines = text.replace(/\n+$/, "").split("\n");
  if (options.all === true || lines.length <= TEXT_LINE_CAP) return `${lines.join("\n")}\n`;
  const kept = lines.slice(0, TEXT_LINE_CAP - 1);
  const cut = lines.length - kept.length;
  return `${[...kept, `... ${cut} more lines (--all prints everything)`].join("\n")}\n`;
}

export function listPage<T>(items: readonly T[], options: PageOptions = {}): ListPage<T> {
  const truncated = options.all !== true && items.length > TEXT_LINE_CAP;
  const page = {
    items: truncated ? items.slice(0, TEXT_LINE_CAP) : items,
    total: items.length,
    truncated,
  };
  return options.for === undefined ? page : { ...page, for: options.for };
}

/** `schema/cli/common/list-page.json`; a command's own schema narrows `item`. */
export function listPageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.int().min(0),
    truncated: z.boolean(),
    for: z.string().optional(),
  });
}
