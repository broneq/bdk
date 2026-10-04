// The citation validator of T4 (`kernel-cli/evidence`, `evidence record`;
// T23-D8, D47). A citation names a value inside a recorded file:
// `<file>#<json-pointer>`, `<file>:<line>` or `<file>:<line>=<text>`. The file
// part is the path as given, another spelling of the same path (relative to
// the project or absolute) or the file name, and may be left out when one
// file is recorded; a bare `/pointer` is `#/pointer` unless it starts with a
// recorded file's path, so an absolute path cites its file.

/** A recorded file as the validator sees it. */
export interface CitedFile {
  /** The path as the caller gave it. */
  readonly given: string;
  /** Other spellings of the same path a citation may use, such as project-relative and absolute. */
  readonly aliases?: readonly string[];
  /** The UTF-8 text, or undefined for a file that is not text (never citable). */
  readonly text: string | undefined;
}

type Target = { readonly pointer: string } | { readonly line: number; readonly contains?: string };

/** Why `citation` does not resolve inside `files`, or undefined when it does. */
export function citationProblem(citation: string, files: readonly CitedFile[]): string | undefined {
  const parsed = parse(citation, files);
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

function parse(
  citation: string,
  files: readonly CitedFile[],
): { file: string; target: Target } | undefined {
  const file = recordedPrefix(citation, files);
  if (file !== undefined) return located(file, citation.slice(file.length));
  if (citation.startsWith("/")) return { file: "", target: { pointer: citation } };
  const hash = citation.indexOf("#");
  if (hash >= 0) return located(citation.slice(0, hash), citation.slice(hash));
  const colon = citation.indexOf(":");
  return colon < 0 ? undefined : located(citation.slice(0, colon), citation.slice(colon));
}

/** The longest path or name of a recorded file that `citation` starts with, then `#` or `:`. */
function recordedPrefix(citation: string, files: readonly CitedFile[]): string | undefined {
  return files
    .flatMap((file) => [...spellings(file), file.given.split("/").at(-1) ?? file.given])
    .filter((name) => citation.startsWith(`${name}#`) || citation.startsWith(`${name}:`))
    .sort((a, b) => b.length - a.length)[0];
}

/** `rest` is `#<pointer>`, `:<line>` or `:<line>=<text>`. */
function located(file: string, rest: string): { file: string; target: Target } | undefined {
  if (rest.startsWith("#")) return { file, target: { pointer: rest.slice(1) } };
  const line = /^:(?<line>\d+)(?:=(?<text>.*))?$/s.exec(rest)?.groups;
  if (line?.line === undefined) return undefined;
  const target =
    line.text === undefined
      ? { line: Number(line.line) }
      : { line: Number(line.line), contains: line.text };
  return { file, target };
}

function only(files: readonly CitedFile[]): CitedFile | undefined {
  return files.length === 1 ? files[0] : undefined;
}

function named(files: readonly CitedFile[], name: string): CitedFile | undefined {
  return (
    files.find((file) => spellings(file).includes(name)) ??
    files.find((file) => file.given.split("/").at(-1) === name)
  );
}

function spellings(file: CitedFile): string[] {
  return [file.given, ...(file.aliases ?? [])];
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
