// `bdk config set` (design D-11): edits the layer file as a YAML document, so
// its comments, key order and modeline survive, and writes it only after the
// whole configuration with the edit validates.
import { isCollection, isMap, isNode, isScalar, isSeq, parseDocument, YAMLParseError } from "yaml";
import type { Document, Node } from "yaml";

import {
  declaredSteps,
  layerFiles,
  readKernelVersion,
  withModeline,
  writeSnapshot,
} from "../../shared/config/index.ts";
import type { KeyStep } from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { Store } from "../../shared/store/index.ts";
import type { FileLayerName, SetReport } from "../domain/report.ts";
import { displayPath, isRefusal, resolve } from "./input.ts";
import type { ConfigInput } from "./input.ts";
import { unknownKey } from "./show.ts";

export interface SetRequest {
  readonly key: string;
  /** The value as typed: a YAML scalar or inline collection. */
  readonly value: string;
  readonly global?: boolean;
  readonly local?: boolean;
}

export function setConfig(input: ConfigInput, request: SetRequest): SetReport | Refusal {
  const { key } = request;
  const usage = `bdk config set ${key} <value>`;
  if (request.global === true && request.local === true) {
    return refuse("input/invalid-argument", "--global and --local name two layers; give one", [
      `${usage} --local`,
      `${usage} --global`,
    ]);
  }
  const layer: FileLayerName =
    request.global === true ? "global" : request.local === true ? "local" : "project";
  const file = layerFiles(input.globalDir, input.projectRoot).find((entry) => entry.name === layer);
  if (file === undefined) throw new Error(`no file for the ${layer} layer`);

  const value = parseValue(request.value, usage);
  if (isRefusal(value)) return value;
  const steps = declaredSteps(input.settings, key);
  if (steps === undefined) return unknownKey(input, key);

  const text = input.store.read(file.path);
  const document = parseDocument(text ?? "");
  if (document.errors.length > 0) {
    return refuse("policy/config-invalid", `${displayPath(input, file.path)} is not valid YAML`, [
      `fix ${displayPath(input, file.path)}`,
    ]);
  }
  const edit = editDocument(document, steps, value, request.value);
  if (isRefusal(edit)) return edit;
  const next =
    text === undefined
      ? withModeline(document.toString(FORMAT), readKernelVersion(input.store, input.pluginRoot))
      : edit.splice === undefined
        ? document.toString(FORMAT)
        : `${text.slice(0, edit.splice.start)}${edit.splice.text}${text.slice(edit.splice.end)}`;

  const resolved = resolve(input, overlay(input.store, file.path, next));
  if (isRefusal(resolved)) return resolved;
  input.store.write(file.path, next);
  writeSnapshot(input.store, input.projectRoot, resolved);
  return {
    key,
    value: value.toJSON(),
    ...(edit.previous === undefined ? {} : { previous: edit.previous }),
    layer,
    path: displayPath(input, file.path),
  };
}

/** The typed value as a YAML node, keeping its flow or block style. */
function parseValue(raw: string, usage: string): Node | Refusal {
  const parsed = parseDocument(raw);
  const [error] = parsed.errors;
  if (error !== undefined || !isNode(parsed.contents)) {
    const reason = error instanceof YAMLParseError ? `: ${error.message.split("\n")[0] ?? ""}` : "";
    return refuse("input/invalid-argument", `${raw} is not a YAML value${reason}`, [usage]);
  }
  return parsed.contents;
}

/** Flow collections as `[a, b]`, the way people type them. */
const FORMAT = { flowCollectionPadding: false } as const;

interface Edit {
  readonly previous?: unknown;
  /** A one-line value replaced in the source text, leaving every other byte as it was. */
  readonly splice?: { readonly start: number; readonly end: number; readonly text: string };
}

/**
 * Sets `value` at `steps`. An id step picks the sequence item with that id; a
 * missing item is appended, as the whole value when the id is the last step.
 */
function editDocument(
  document: Document,
  steps: readonly KeyStep[],
  value: Node,
  raw: string,
): Edit | Refusal {
  const path: (string | number)[] = [];
  for (const [index, step] of steps.entries()) {
    const last = index === steps.length - 1;
    if (!step.id) {
      path.push(step.segment);
      continue;
    }
    const sequence = document.getIn(path, true);
    const items = isSeq(sequence) ? sequence.items : [];
    const found = items.findIndex((item) => isMap(item) && item.get("id") === step.segment);
    if (found !== -1) {
      path.push(found);
      continue;
    }
    const item = last
      ? withId(document, value, step.segment)
      : document.createNode({ id: step.segment });
    if (isRefusal(item)) return item;
    if (isSeq(sequence)) sequence.add(item);
    else document.setIn(path, document.createNode([item]));
    if (last) return {};
    path.push(isSeq(sequence) ? sequence.items.length - 1 : 0);
  }

  const current = document.getIn(path, true);
  const previous: unknown = isNode(current) ? current.toJSON() : undefined;
  const kept = previous === undefined ? {} : { previous };
  if (isNode(current) && inline(current) && inline(value) && !raw.includes("\n")) {
    const [start, end] = current.range ?? [0, 0];
    const [from, to] = value.range ?? [0, raw.length];
    return { ...kept, splice: { start, end, text: raw.slice(from, to) } };
  }
  document.setIn(path, value);
  return kept;
}

/** A scalar or a flow collection: a value that sits on its key's line. */
function inline(node: Node): boolean {
  return isScalar(node) || (isCollection(node) && node.flow === true);
}

function withId(document: Document, value: Node, id: string): Node | Refusal {
  if (!isMap(value)) {
    return refuse(
      "input/invalid-argument",
      `a new item ${id} needs a mapping value, e.g. {command: ...}`,
      ["bdk config schema"],
    );
  }
  const given: unknown = value.get("id");
  if (given === undefined) value.items.unshift(document.createPair("id", id));
  else if (given !== id) {
    return refuse(
      "input/invalid-argument",
      `the value's id ${JSON.stringify(given)} differs from the key's ${id}`,
      ["bdk config schema"],
    );
  }
  return value;
}

/** `store` with `path` holding `text`, for validating an edit before writing it. */
function overlay(store: Store, path: string, text: string): Store {
  return {
    read: (candidate) => (candidate === path ? text : store.read(candidate)),
    write: () => {
      throw new Error("the validation overlay is read-only");
    },
    list: (dir) => store.list(dir),
    exists: (candidate) => candidate === path || store.exists(candidate),
    isDirectory: (candidate) => store.isDirectory(candidate),
  };
}
