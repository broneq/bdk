// The conflict rule (`kernel-cli/spec`, bdk spec merge; T30-D1): two deltas
// of one capability name the same requirement with different texts. A
// requirement named in several sections of a delta compares as the sections'
// texts in line order.
import { blockText } from "./grammar.ts";
import type { Delta } from "./grammar.ts";

/** Requirement name -> the delta's text for it. */
function namedBlocks(delta: Delta): Map<string, string> {
  const items = [
    ...delta.added.map((item) => ({ name: item.name, line: item.line, text: blockText(item) })),
    ...delta.modified.map((item) => ({ name: item.name, line: item.line, text: blockText(item) })),
    ...delta.removed.map((item) => ({ name: item.name, line: item.line, text: item.text })),
  ].sort((a, b) => a.line - b.line);
  const blocks = new Map<string, string>();
  for (const item of items) {
    const known = blocks.get(item.name);
    blocks.set(item.name, known === undefined ? item.text : `${known}\n\n${item.text}`);
  }
  return blocks;
}

export interface Counterpart {
  /** The archived Change's id. */
  readonly change: string;
  readonly delta: Delta;
  /** True when this Change's ledger holds a decision naming the Change and the delta. */
  readonly resolved: boolean;
}

export interface FoundConflict {
  readonly requirement: string;
  readonly ours: string;
  readonly theirs: string;
  readonly change: string;
}

export function conflictsOf(ours: Delta, counterparts: readonly Counterpart[]): FoundConflict[] {
  const mine = namedBlocks(ours);
  const found: FoundConflict[] = [];
  for (const counterpart of counterparts) {
    if (counterpart.resolved) continue;
    for (const [requirement, theirs] of namedBlocks(counterpart.delta)) {
      const text = mine.get(requirement);
      if (text === undefined || text === theirs) continue;
      found.push({
        requirement,
        ours: text,
        theirs: `${counterpart.change}: ${theirs}`,
        change: counterpart.change,
      });
    }
  }
  return found;
}
