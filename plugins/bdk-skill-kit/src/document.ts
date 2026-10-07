import { isMap, isScalar, LineCounter, parseDocument as parseYaml } from "yaml";
import type { Document, ResolvedTarget, TargetKind } from "./index.ts";

export interface DocumentInput {
  kind: TargetKind;
  target: ResolvedTarget;
  path: string;
  dir: string;
  text: string;
  files: string[];
}

interface Frontmatter {
  map: Record<string, unknown> | undefined;
  error: string | undefined;
  keyLines: Record<string, number>;
  bodyStart: number;
}

export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

export function parseDocument(input: DocumentInput): Document {
  const lines = splitLines(input.text);
  const fm = readFrontmatter(lines);
  const fence = fenceMask(lines, fm.bodyStart);
  return {
    kind: input.kind,
    target: input.target,
    path: input.path,
    dir: input.dir,
    text: input.text,
    lines,
    frontmatter: fm.map,
    frontmatterError: fm.error,
    keyLines: fm.keyLines,
    bodyStart: fm.bodyStart,
    inFence: (line) => fence[line - 1] ?? false,
    files: input.files,
  };
}

function readFrontmatter(lines: string[]): Frontmatter {
  if (lines[0]?.trim() !== "---") {
    return failed("the file does not open with a `---` frontmatter block", 1);
  }
  const close = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (close === -1) return failed("the frontmatter block is not closed with `---`", 1);

  const bodyStart = close + 2;
  const source = lines.slice(1, close).join("\n");
  const counter = new LineCounter();
  const doc = parseYaml(source, { lineCounter: counter });
  const [first] = doc.errors;
  if (first) {
    return failed(
      `the frontmatter is not valid YAML: ${first.message.split("\n")[0] ?? ""}`,
      bodyStart,
    );
  }
  if (doc.contents === null) return { map: {}, error: undefined, keyLines: {}, bodyStart };
  if (!isMap(doc.contents)) return failed("the frontmatter is not a YAML map", bodyStart);

  const keyLines: Record<string, number> = {};
  for (const pair of doc.contents.items) {
    if (isScalar(pair.key)) {
      // +1 for the opening `---`, which the YAML source does not contain.
      keyLines[String(pair.key.value)] = counter.linePos(pair.key.range[0]).line + 1;
    }
  }
  return { map: doc.toJS() as Record<string, unknown>, error: undefined, keyLines, bodyStart };
}

function failed(error: string, bodyStart: number): Frontmatter {
  return { map: undefined, error, keyLines: {}, bodyStart };
}

/** Per line: inside a fenced code block, fence lines included. */
function fenceMask(lines: string[], from: number): boolean[] {
  const mask = lines.map(() => false);
  let open: string | undefined;
  for (let i = from - 1; i < lines.length; i++) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(lines[i] ?? "")?.[1];
    if (open === undefined) {
      if (marker) {
        open = marker;
        mask[i] = true;
      }
    } else {
      mask[i] = true;
      if (marker?.startsWith(open[0] ?? "") && marker.length >= open.length) open = undefined;
    }
  }
  return mask;
}
