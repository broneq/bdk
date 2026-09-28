// The `bdk-entries` block of a role's report (`kernel-cli/log`, bdk log
// ingest; T22 design D-13): exactly one fenced block, a YAML sequence of
// mappings, every line number counted in the whole input.
import { isMap, isScalar, isSeq, LineCounter, parseDocument } from "yaml";
import type { Node, Pair } from "yaml";

const INFO = "bdk-entries";

/** One item of the block: its fields as plain values, and the input line of each. */
export interface BlockItem {
  /** 1-based position in the block. */
  readonly position: number;
  /** The input line of the item's first field. */
  readonly line: number;
  readonly fields: Readonly<Record<string, unknown>>;
  /** The input line of each field's key. */
  readonly lines: Readonly<Record<string, number>>;
}

export interface Block {
  readonly items: readonly BlockItem[];
  /** True when the input holds anything besides the block: a whole report. */
  readonly report: boolean;
}

/** The block's items, or why the input holds no valid block. */
export function readBlock(input: string): Block | { readonly invalid: string } {
  const lines = input.split("\n");
  const found = fences(lines);
  if (typeof found === "string") return { invalid: found };
  if (found.length !== 1) {
    return {
      invalid: `the input holds ${String(found.length)} fenced ${INFO} blocks; it needs exactly one`,
    };
  }
  const [fence] = found as [Fence];
  const outside = [...lines.slice(0, fence.open), ...lines.slice(fence.close + 1)];
  const offset = fence.open + 1;
  const counter = new LineCounter();
  const document = parseDocument(lines.slice(fence.open + 1, fence.close).join("\n"), {
    lineCounter: counter,
    uniqueKeys: true,
    prettyErrors: false,
  });
  const lineOf = (node: { range?: readonly number[] | null | undefined } | null | undefined) =>
    counter.linePos(node?.range?.[0] ?? 0).line + offset;
  const [error] = document.errors;
  if (error !== undefined) {
    const line = counter.linePos(error.pos[0]).line + offset;
    return { invalid: `line ${String(line)}: ${error.message.split("\n")[0] ?? ""}` };
  }
  const root = document.contents;
  if (!isSeq(root)) {
    return {
      invalid: `line ${String(lineOf(root))}: the ${INFO} block is not a YAML sequence of entries`,
    };
  }
  const items: BlockItem[] = [];
  for (const [at, node] of root.items.entries()) {
    const position = at + 1;
    if (!isMap(node)) {
      return {
        invalid: `item ${String(position)}, line ${String(lineOf(node))}: an entry is a mapping of fields`,
      };
    }
    const fields: Record<string, unknown> = {};
    const keyLines: Record<string, number> = {};
    for (const pair of node.items as Pair[]) {
      const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
      fields[key] = isScalar(pair.value) ? pair.value.value : (pair.value as Node | null)?.toJSON();
      keyLines[key] = lineOf(pair.key as Node);
    }
    items.push({ position, line: lineOf(node), fields, lines: keyLines });
  }
  return { items, report: outside.some((line) => line.trim() !== "") };
}

interface Fence {
  /** 0-based index of the opening fence line. */
  readonly open: number;
  readonly close: number;
}

/** The `bdk-entries` fences outside other fenced blocks, or why one never closes. */
function fences(lines: readonly string[]): Fence[] | string {
  const found: Fence[] = [];
  let at = 0;
  while (at < lines.length) {
    const opening = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/.exec(lines[at] ?? "");
    if (opening === null) {
      at++;
      continue;
    }
    const marker = opening[1] ?? "";
    const closing = new RegExp(
      `^ {0,3}${marker.startsWith("`") ? "`" : "~"}{${String(marker.length)},}\\s*$`,
    );
    let close = at + 1;
    while (close < lines.length && !closing.test(lines[close] ?? "")) close++;
    if (opening[2] === INFO) {
      if (close === lines.length)
        return `line ${String(at + 1)}: the ${INFO} fence is never closed`;
      found.push({ open: at, close });
    }
    at = close + 1;
  }
  return found;
}
