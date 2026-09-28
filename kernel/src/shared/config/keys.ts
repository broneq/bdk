// The key tree of the registry, read from the modules' zod schemas: which
// keys exist, which arrays merge by id or by appending, and where a
// free-form mapping starts.
// Validation walks it to find unknown keys before zod sees the merged tree.
import * as z from "zod";

import { joinKey } from "./values.ts";

export type KeyNode =
  | { readonly kind: "object"; readonly children: ReadonlyMap<string, KeyNode> }
  | { readonly kind: "idArray"; readonly item: KeyNode }
  | { readonly kind: "record"; readonly value: KeyNode }
  | { readonly kind: "appendArray" }
  | { readonly kind: "leaf" };

const LEAF: KeyNode = { kind: "leaf" };

const APPEND_ONLY = new WeakSet<z.ZodType>();

/**
 * Marks an array schema append-only (`kernel-settings`, Merge): each layer
 * appends the items the default and the lower layers do not hold, so no layer
 * removes an item. Wrap the finished array, after `.refine()` and `.meta()`
 * (each returns a new schema) and before `.default()`.
 */
export function appendOnly<S extends z.ZodArray>(schema: S): S {
  APPEND_ONLY.add(schema);
  return schema;
}

export function keyTree(schema: z.ZodType): KeyNode {
  const inner = unwrap(schema);
  if (inner instanceof z.ZodObject) {
    const children = new Map<string, KeyNode>();
    const shape: Record<string, z.ZodType> = inner.shape;
    for (const [key, child] of Object.entries(shape)) {
      children.set(key, keyTree(child));
    }
    return { kind: "object", children };
  }
  if (inner instanceof z.ZodArray) {
    if (APPEND_ONLY.has(inner)) return { kind: "appendArray" };
    const item = unwrap(inner.element as z.ZodType);
    if (item instanceof z.ZodObject && "id" in (item.shape as object)) {
      return { kind: "idArray", item: keyTree(item) };
    }
    return LEAF;
  }
  if (inner instanceof z.ZodRecord)
    return { kind: "record", value: keyTree(inner.valueType as z.ZodType) };
  return LEAF;
}

/** Strips defaults, optionality and pipes down to the schema that holds the shape. */
export function unwrap(schema: z.ZodType): z.ZodType {
  let current = schema;
  for (;;) {
    if (
      current instanceof z.ZodDefault ||
      current instanceof z.ZodPrefault ||
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable ||
      current instanceof z.ZodReadonly
    ) {
      current = current.unwrap() as z.ZodType;
    } else if (current instanceof z.ZodPipe) {
      current = current.in as z.ZodType;
    } else {
      return current;
    }
  }
}

/** Every declared path below `node`, parents before children; an id array or a record ends a path. */
export function keyPaths(node: KeyNode, prefix = ""): string[] {
  if (node.kind !== "object") return prefix === "" ? [] : [prefix];
  const paths: string[] = prefix === "" ? [] : [prefix];
  for (const [key, child] of node.children) paths.push(...keyPaths(child, joinKey(prefix, key)));
  return paths;
}

export function isAppendOnly(schema: z.ZodType): boolean {
  return APPEND_ONLY.has(schema);
}

/** The dotted paths of the append-only arrays below `node`. */
export function appendOnlyPaths(node: KeyNode, prefix = ""): string[] {
  if (node.kind === "appendArray") return [prefix];
  if (node.kind !== "object") return [];
  return [...node.children].flatMap(([key, child]) => appendOnlyPaths(child, joinKey(prefix, key)));
}

/** The leaf paths below `node`: records end with `.<key>`, id arrays end the path. */
export function leafPaths(node: KeyNode, prefix = ""): string[] {
  if (node.kind === "object") {
    return [...node.children].flatMap(([key, child]) => leafPaths(child, joinKey(prefix, key)));
  }
  if (node.kind === "record") return [joinKey(prefix, "<key>")];
  return [prefix];
}

/** One segment of a dotted key; `id` marks the item of an array merged by id. */
export interface KeyStep {
  readonly segment: string;
  readonly id: boolean;
}

/** The steps of `key` through `node`, or undefined when the tree does not declare it. */
export function keySteps(node: KeyNode, key: string): KeyStep[] | undefined {
  if (key === "") return undefined;
  const steps: KeyStep[] = [];
  let current: KeyNode | undefined = node;
  for (const segment of key.split(".")) {
    if (current.kind === "object") {
      current = current.children.get(segment);
      if (current === undefined) return undefined;
      steps.push({ segment, id: false });
    } else if (current.kind === "idArray") {
      steps.push({ segment, id: true });
      current = current.item;
    } else if (current.kind === "record") {
      steps.push({ segment, id: false });
      current = current.value;
    } else {
      return undefined;
    }
  }
  return steps;
}
