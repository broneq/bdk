// The layer files of the configuration (spec `bdk-cli/config`, "Layer files"; design D2, D5):
// finding the project root, reading and parsing each layer, and editing one key of a layer file
// with the yaml Document API, which keeps comments and key order.

import { dirname, isAbsolute, join } from "node:path";
import { isMap, isSeq, parseDocument } from "yaml";
import type { Document } from "yaml";

import type { Files } from "../../shared/fs/index.ts";
import type { Step } from "../domain/keys.ts";
import type { FileLayerName, LayerFile } from "../domain/layer-files.ts";
import { isMapping } from "../domain/merge.ts";
import type { Layer, Mapping } from "../domain/merge.ts";
import type { Problem } from "../domain/validate.ts";

/** Where the user's files are: the home directory and the environment. */
export interface UserDirs {
  readonly home: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}

/** The nearest directory from `cwd` upwards holding `.bdk/` or `.git`, else `cwd`. */
export function findRoot(files: Files, cwd: string): string {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const entries = files.list(dir) ?? [];
    if (entries.some((entry) => (entry.name === ".bdk" && entry.dir) || entry.name === ".git")) {
      return dir;
    }
    if (dirname(dir) === dir) return cwd;
  }
}

export function hasOpenSpec(files: Files, root: string): boolean {
  return (files.list(root) ?? []).some((entry) => entry.name === "openspec" && entry.dir);
}

export function layerPaths(user: UserDirs, root: string): Record<FileLayerName, string> {
  const xdg = user.env.XDG_CONFIG_HOME;
  const config = xdg !== undefined && isAbsolute(xdg) ? xdg : join(user.home, ".config");
  return {
    global: join(config, "bdk", "settings.yaml"),
    project: join(root, ".bdk", "settings.yaml"),
    local: join(root, ".bdk", "settings.local.yaml"),
  };
}

export interface ReadLayers {
  readonly files: readonly LayerFile[];
  /** The layers that exist and parse, in order. */
  readonly layers: readonly Layer[];
  /** Files that do not parse or whose top level is not a mapping. */
  readonly problems: readonly Problem[];
}

/** Parses a layer file; an empty file is an empty layer. */
export function parseLayer(text: string): { data: Mapping } | { error: string } {
  const doc = parseDocument(text);
  const [error] = doc.errors;
  if (error !== undefined) {
    const line = error.linePos?.[0].line;
    const reason = (error.message.split("\n")[0] ?? "").replace(/ at line \d+, column \d+:?$/, "");
    return { error: `YAML syntax error${line === undefined ? "" : ` at line ${line}`}: ${reason}` };
  }
  const data: unknown = doc.toJS();
  if (data === null || data === undefined) return { data: {} };
  if (!isMapping(data)) return { error: "the top level must be a mapping of keys" };
  return { data };
}

export function readLayers(files: Files, user: UserDirs, root: string): ReadLayers {
  const paths = layerPaths(user, root);
  const found: LayerFile[] = [];
  const layers: Layer[] = [];
  const problems: Problem[] = [];
  for (const layer of ["global", "project", "local"] as const) {
    const path = paths[layer];
    const text = files.readText(path);
    found.push({ layer, path, present: text !== undefined });
    if (text === undefined) continue;
    const parsed = parseLayer(text);
    if ("error" in parsed) problems.push({ layer, file: path, key: "", message: parsed.error });
    else layers.push({ name: layer, file: path, data: parsed.data });
  }
  return { files: found, layers, problems };
}

/** The physical path of `steps` in `doc`, creating a missing item of an id array. */
function physicalPath(doc: Document, steps: readonly Step[]): (string | number)[] {
  const path: (string | number)[] = [];
  for (const step of steps) {
    if (step.kind === "key") {
      path.push(step.name);
      continue;
    }
    const node: unknown = doc.getIn(path, true);
    if (isSeq(node)) {
      let at = node.items.findIndex((item) => isMap(item) && item.get("id") === step.id);
      if (at === -1) {
        node.add(doc.createNode({ id: step.id }));
        at = node.items.length - 1;
      }
      path.push(at);
    } else {
      doc.setIn(path, doc.createNode([{ id: step.id }]));
      path.push(0);
    }
  }
  return path;
}

/**
 * The text of a layer file with the key at `steps` set to `value`. Throws when the layer does
 * not parse, or when a value on the way to the key is not a mapping or a list of items.
 */
export function editLayer(text: string, steps: readonly Step[], value: unknown): string {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) throw new Error("the layer file does not parse");
  doc.setIn(physicalPath(doc, steps), doc.createNode(value));
  return doc.toString({ flowCollectionPadding: false });
}
