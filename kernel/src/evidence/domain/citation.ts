// The citation validator of T4 (`kernel-cli/evidence`, `evidence record`;
// T23-D8, D47). A citation names a value inside a recorded file:
// `<file>#<json-pointer>`, `<file>:<line>` or `<file>:<line>=<text>`. The file
// part is the path as given or the file name, and may be left out when one
// file is recorded; a bare `/pointer` is `#/pointer`.

/** A recorded file as the validator sees it. */
export interface CitedFile {
  /** The path as the caller gave it. */
  readonly given: string;
  /** The UTF-8 text, or undefined for a file that is not text (never citable). */
  readonly text: string | undefined;
}

type Target = { readonly pointer: string } | { readonly line: number; readonly contains?: string };

/** Why `citation` does not resolve inside `files`, or undefined when it does. */
export function citationProblem(citation: string, files: readonly CitedFile[]): string | undefined {
  const parsed = parse(citation);
  if (parsed === undefined) {
    return `${citation} is not a citation: use <file>#<json-pointer>, <file>:<line> or <file>:<line>=<text>`;
  }
  const file = parsed.file === "" ? only(files) : named(files, parsed.file);
  if (file === undefined) {
    return parsed.file === ""
      ? `${citation} names no file, and ${String(files.length)} files are recorded`
      : `${citation}: ${parsed.file} is not a recorded file`;
  }
  const where = `${citation} in ${file.given}`;
  if (file.text === undefined) return `${where}: the file is not text, so it is not citable`;
  return "pointer" in parsed.target
    ? pointerProblem(where, file.text, parsed.target.pointer)
    : lineProblem(where, file.text, parsed.target.line, parsed.target.contains);
}

/** UTF-8 without a NUL byte: the files a citation can resolve in and a Change can commit. */
export function isText(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function parse(citation: string): { file: string; target: Target } | undefined {
  if (citation.startsWith("/")) return { file: "", target: { pointer: citation } };
  const hash = citation.indexOf("#");
  if (hash >= 0) {
    return { file: citation.slice(0, hash), target: { pointer: citation.slice(hash + 1) } };
  }
  const line = /^(?<file>[^:]*):(?<line>\d+)(?:=(?<text>.*))?$/s.exec(citation)?.groups;
  if (line?.line === undefined) return undefined;
  const target =
    line.text === undefined
      ? { line: Number(line.line) }
      : { line: Number(line.line), contains: line.text };
  return { file: line.file ?? "", target };
}

function only(files: readonly CitedFile[]): CitedFile | undefined {
  return files.length === 1 ? files[0] : undefined;
}

function named(files: readonly CitedFile[], name: string): CitedFile | undefined {
  return (
    files.find((file) => file.given === name) ??
    files.find((file) => file.given.split("/").at(-1) === name)
  );
}

function pointerProblem(where: string, text: string, pointer: string): string | undefined {
  if (pointer !== "" && !pointer.startsWith("/")) {
    return `${where}: ${pointer} is not a JSON pointer; it starts with /`;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return `${where}: the file does not parse as JSON`;
  }
  const tokens = pointer === "" ? [] : pointer.slice(1).split("/");
  for (const token of tokens) {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    const next = step(value, key);
    if (next === undefined) return `${where}: ${pointer} names no value`;
    value = next.value;
  }
  return undefined;
}

function step(value: unknown, key: string): { value: unknown } | undefined {
  if (Array.isArray(value)) {
    if (!/^(?:0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) return undefined;
    return { value: value[Number(key)] as unknown };
  }
  if (typeof value === "object" && value !== null && Object.hasOwn(value, key)) {
    return { value: (value as Record<string, unknown>)[key] };
  }
  return undefined;
}

function lineProblem(
  where: string,
  text: string,
  line: number,
  contains: string | undefined,
): string | undefined {
  const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
  const found = line >= 1 && text !== "" ? lines[line - 1] : undefined;
  if (found === undefined) return `${where}: the file has no line ${String(line)}`;
  if (contains !== undefined && !found.replace(/\r$/, "").includes(contains)) {
    return `${where}: line ${String(line)} does not contain ${contains}`;
  }
  return undefined;
}
