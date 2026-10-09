// Dotted keys against the settings schema (spec `bdk-cli/config`, "Settings keys"): which keys
// name a setting, how a key walks mappings, records and id arrays, and the names known at a
// place, for "did you mean".

import { z } from "zod";

import { KEBAB, SettingsSchema } from "./settings.ts";

/** One segment of a resolved key: a mapping key, or the id of an item in an id array. */
export type Step =
  { readonly kind: "key"; readonly name: string } | { readonly kind: "id"; readonly id: string };

export type Resolution =
  | { readonly ok: true; readonly steps: readonly Step[] }
  | {
      readonly ok: false;
      /** The resolved part of the key before the segment that names nothing. */
      readonly at: string;
      readonly segment: string;
      /** The names a segment may take at `at`, when the place has a fixed set. */
      readonly known: readonly string[];
    };

function unwrap(node: z.ZodType): z.ZodType {
  let at = node;
  while (at instanceof z.ZodDefault || at instanceof z.ZodPrefault || at instanceof z.ZodOptional) {
    at = at.unwrap() as z.ZodType;
  }
  return at;
}

function itemSchema(node: z.ZodType): z.ZodObject | undefined {
  if (!(node instanceof z.ZodArray)) return undefined;
  const element = unwrap(node.element as z.ZodType);
  return element instanceof z.ZodObject && "id" in element.shape ? element : undefined;
}

/** Walks `key` through the schema; fails at the first segment that names no setting. */
export function resolveKey(key: string): Resolution {
  const segments = key.split(".");
  const steps: Step[] = [];
  let node = unwrap(SettingsSchema);
  for (const [i, segment] of segments.entries()) {
    const at = segments.slice(0, i).join(".");
    const fail = (known: readonly string[]): Resolution => ({ ok: false, at, segment, known });
    if (node instanceof z.ZodObject) {
      const shape = node.shape as Record<string, z.ZodType>;
      const child = shape[segment];
      if (child === undefined) return fail(Object.keys(shape).filter((name) => name !== "id"));
      steps.push({ kind: "key", name: segment });
      node = unwrap(child);
      continue;
    }
    if (node instanceof z.ZodRecord) {
      const keyType = node.keyType as z.ZodType;
      if (!keyType.safeParse(segment).success) {
        return fail(keyType instanceof z.ZodEnum ? keyType.options.map(String) : []);
      }
      steps.push({ kind: "key", name: segment });
      node = unwrap(node.valueType as z.ZodType);
      continue;
    }
    const item = itemSchema(node);
    if (item !== undefined && KEBAB.test(segment)) {
      steps.push({ kind: "id", id: segment });
      node = item;
      continue;
    }
    return fail([]);
  }
  return { ok: true, steps };
}

/** The names known directly under `key`, when the schema fixes them (a mapping). */
export function knownUnder(key: string): readonly string[] {
  const resolved = resolveKey(key === "" ? "\u0000" : `${key}.\u0000`);
  return resolved.ok ? [] : resolved.known;
}
