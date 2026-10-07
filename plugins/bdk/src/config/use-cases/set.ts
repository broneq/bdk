// `bdk config set <key> <value> [--layer]` (spec `bdk-cli/config`, "config set"): one key into
// one layer file, refused when the key names no setting or the value adds a problem.

import { parse, YAMLParseError } from "yaml";

import { CliError, closest } from "../../shared/cli/index.ts";
import type { FileLayerName } from "../domain/layer-files.ts";
import type { Layer } from "../domain/merge.ts";
import { validate } from "../domain/validate.ts";
import type { Problem } from "../domain/validate.ts";
import type { SetResult } from "../schema/set.ts";
import { editLayer, parseLayer } from "../store/layers.ts";
import { load, requireKey } from "./load.ts";
import type { ConfigDeps } from "./load.ts";

const ORDER: readonly FileLayerName[] = ["global", "project", "local"];

function readValue(key: string, raw: string): unknown {
  try {
    return parse(raw) as unknown;
  } catch (error) {
    if (!(error instanceof YAMLParseError)) throw error;
    throw new CliError(
      "usage/invalid-value",
      `the value for ${key} is not a YAML value: ${error.message.split("\n")[0] ?? ""}`,
      "Quote a value that holds YAML punctuation.",
    );
  }
}

const same = (a: Problem, b: Problem): boolean =>
  a.layer === b.layer && a.key === b.key && a.message === b.message;

export function set(
  deps: ConfigDeps,
  key: string,
  raw: string,
  layer: FileLayerName = "project",
): SetResult {
  const steps = requireKey(key);
  const value = readValue(key, raw);
  const before = load(deps);
  const file = before.files.find((candidate) => candidate.layer === layer);
  if (file === undefined) throw new Error(`no ${layer} layer file`);
  const text = deps.files.readText(file.path) ?? "";
  const current = parseLayer(text);
  if ("error" in current) {
    throw new CliError(
      "env/config-invalid",
      `${file.path} cannot be edited: ${current.error}`,
      "Fix the file by hand, then run bdk config check.",
    );
  }
  let next: string;
  try {
    next = editLayer(text, steps, value);
  } catch {
    throw new CliError(
      "usage/invalid-value",
      `${key} cannot be set: a value on its way in ${file.path} is not a mapping`,
      "Run bdk config show for the shape of the configuration.",
    );
  }
  const edited = parseLayer(next);
  if ("error" in edited) throw new Error(`the edited layer does not parse: ${edited.error}`);
  const layers: Layer[] = ORDER.flatMap((name) => {
    if (name === layer) return [{ name, file: file.path, data: edited.data }];
    return before.layers.filter((candidate) => candidate.name === name);
  });
  const added = validate(layers, closest).problems.filter(
    (problem) => !before.problems.some((known) => same(known, problem)),
  );
  const [first] = added;
  if (first !== undefined) {
    throw new CliError(
      "usage/invalid-value",
      `invalid value for ${key}: ${first.key === "" ? "" : `${first.key}: `}${first.message}`,
      "Run bdk config set --help for the value syntax; the keys and their values are in bdk config show.",
    );
  }
  deps.files.writeText(file.path, next);
  return { key, value, layer, file: file.path };
}
