// What each settings key is, for the settings Reference (spec `bdk-cli/config`, "Every settings
// key has a description"). Walks the settings schema: a mapping key by its name, an item of an
// array merged by `id` as `<id>`, the value of a record as `<entry>` from the record's meta.

import { z } from "zod";

export type SettingType =
  "mapping" | "items" | "list" | "map" | "enum" | "integer" | "string" | "boolean";

export interface SettingDoc {
  /** Dotted key; `<id>` stands for an item's id, `<role>`-style names for a record key. */
  readonly key: string;
  readonly type: SettingType;
  /** Allowed values of an enum. */
  readonly values?: readonly string[];
  /** Bounds of an integer. */
  readonly min?: number;
  readonly max?: number;
  /** Element type of a plain list. */
  readonly of?: SettingType;
  /** Absent when the key has no default. */
  readonly default?: unknown;
  /** Required: no default and not optional. */
  readonly required: boolean;
  /** Empty when the schema gives none. */
  readonly description: string;
  /** Values of the key as a settings file would hold them, from the schema's meta. */
  readonly examples?: readonly unknown[];
}

interface Meta {
  description?: string | undefined;
  entry?: string | undefined;
  examples?: unknown[] | undefined;
}

interface Unwrapped {
  readonly node: z.ZodType;
  readonly meta: Meta;
  readonly hasDefault: boolean;
  readonly default?: unknown;
  readonly optional: boolean;
}

function unwrap(schema: z.ZodType): Unwrapped {
  let node = schema;
  const meta: Meta = {};
  let hasDefault = false;
  let fallback: unknown;
  let optional = false;
  for (;;) {
    const own = node.meta() as Meta | undefined;
    if (own !== undefined) {
      meta.description ??= own.description;
      meta.entry ??= own.entry;
      meta.examples ??= own.examples;
    }
    if (node instanceof z.ZodDefault) {
      hasDefault = true;
      fallback = node.def.defaultValue;
    } else if (node instanceof z.ZodPrefault) {
      hasDefault = true;
    } else if (node instanceof z.ZodOptional) {
      optional = true;
    } else {
      break;
    }
    node = node.unwrap() as z.ZodType;
  }
  return {
    node,
    meta,
    hasDefault,
    optional,
    ...(hasDefault && fallback !== undefined ? { default: fallback } : {}),
  };
}

function idItem(node: z.ZodType): z.ZodObject | undefined {
  if (!(node instanceof z.ZodArray)) return undefined;
  const element = unwrap(node.element as z.ZodType).node;
  return element instanceof z.ZodObject && "id" in element.shape ? element : undefined;
}

function typeOf(node: z.ZodType): SettingType {
  if (node instanceof z.ZodObject) return "mapping";
  if (node instanceof z.ZodArray) return idItem(node) ? "items" : "list";
  if (node instanceof z.ZodRecord) return "map";
  if (node instanceof z.ZodEnum) return "enum";
  if (node instanceof z.ZodNumber) return "integer";
  if (node instanceof z.ZodBoolean) return "boolean";
  return "string";
}

function walk(key: string, schema: z.ZodType, out: SettingDoc[]): void {
  const at = unwrap(schema);
  const { node } = at;
  const type = typeOf(node);
  out.push({
    key,
    type,
    ...(node instanceof z.ZodEnum ? { values: node.options.map(String) } : {}),
    ...(node instanceof z.ZodNumber &&
    node.minValue !== null &&
    node.minValue > Number.MIN_SAFE_INTEGER
      ? { min: node.minValue }
      : {}),
    ...(node instanceof z.ZodNumber &&
    node.maxValue !== null &&
    node.maxValue < Number.MAX_SAFE_INTEGER
      ? { max: node.maxValue }
      : {}),
    ...(type === "list" && node instanceof z.ZodArray
      ? { of: typeOf(unwrap(node.element as z.ZodType).node) }
      : {}),
    ...("default" in at ? { default: at.default } : {}),
    required: !at.hasDefault && !at.optional,
    description: at.meta.description ?? "",
    ...(at.meta.examples === undefined ? {} : { examples: at.meta.examples }),
  });
  children(key, node, at.meta, out);
}

function children(key: string, node: z.ZodType, meta: Meta, out: SettingDoc[]): void {
  const prefix = key === "" ? "" : `${key}.`;
  if (node instanceof z.ZodObject) {
    const shape: Record<string, z.ZodType> = node.shape;
    for (const [name, child] of Object.entries(shape)) {
      walk(`${prefix}${name}`, child, out);
    }
    return;
  }
  const item = idItem(node);
  if (item !== undefined) {
    children(`${prefix}<id>`, item, {}, out);
    return;
  }
  if (node instanceof z.ZodRecord) {
    walk(`${prefix}<${meta.entry ?? "key"}>`, node.valueType as z.ZodType, out);
  }
}

/** Every key of `schema` below its root, depth first in schema order. */
export function describeSettings(schema: z.ZodType): SettingDoc[] {
  const out: SettingDoc[] = [];
  children("", unwrap(schema).node, {}, out);
  return out;
}
