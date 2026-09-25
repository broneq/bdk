// Renders the registry in the vocabulary of the `kernel-settings` key tables
// (design D-3 of v3-t12-layered-config), so the contract test can compare
// each registered leaf with its row: type, default, owner and consumer.
import * as z from "zod";

import type { ConfigRegistry } from "../../src/shared/config/index.ts";

export interface RegisteredLeaf {
  readonly key: string;
  readonly type: string;
  readonly default: string;
  readonly owner: string;
  readonly consumer: string;
}

export function registeredLeaves(registry: ConfigRegistry): RegisteredLeaf[] {
  return registry.modules.flatMap((module) =>
    leaves(module.schema, module.key).map(({ key, schema }) => ({
      key,
      type: renderType(schema),
      default: renderDefault(schema),
      owner: module.owner,
      consumer: module.consumer,
    })),
  );
}

function leaves(schema: z.ZodType, key: string): { key: string; schema: z.ZodType }[] {
  const inner = strip(schema);
  if (inner instanceof z.ZodObject) {
    const shape: Record<string, z.ZodType> = inner.shape;
    return Object.entries(shape).flatMap(([name, child]) => leaves(child, `${key}.${name}`));
  }
  if (inner instanceof z.ZodRecord)
    return [{ key: `${key}.<key>`, schema: inner.valueType as z.ZodType }];
  return [{ key, schema }];
}

function strip(schema: z.ZodType): z.ZodType {
  let current = schema;
  while (
    current instanceof z.ZodDefault ||
    current instanceof z.ZodPrefault ||
    current instanceof z.ZodOptional
  ) {
    current = current.unwrap() as z.ZodType;
  }
  return current;
}

function renderDefault(schema: z.ZodType): string {
  for (let current = schema; ;) {
    if (current instanceof z.ZodDefault) {
      const value: unknown = current.def.defaultValue;
      return typeof value === "string" ? value : JSON.stringify(value);
    }
    if (current instanceof z.ZodOptional || current instanceof z.ZodPrefault) {
      current = current.unwrap() as z.ZodType;
    } else {
      return "none";
    }
  }
}

function renderType(schema: z.ZodType): string {
  const inner = strip(schema);
  const title = z.globalRegistry.get(inner)?.title;
  if (title !== undefined) return title;
  if (inner instanceof z.ZodBoolean) return "boolean";
  if (inner instanceof z.ZodString)
    return (inner.minLength ?? 0) > 0 ? "non-empty string" : "string";
  if (inner instanceof z.ZodNumber && inner.format?.includes("int") === true) {
    const { minValue, maxValue } = inner;
    const bounded = (value: number | null): value is number =>
      value !== null && Number.isSafeInteger(value);
    if (bounded(minValue) && bounded(maxValue)) return `integer ${minValue} to ${maxValue}`;
    if (bounded(minValue)) return `integer >= ${minValue}`;
    return "integer";
  }
  if (inner instanceof z.ZodEnum)
    return either(inner.options.map((option) => `\`${String(option)}\``));
  if (inner instanceof z.ZodArray) {
    const unique = z.globalRegistry.get(inner)?.uniqueItems === true ? "unique " : "";
    return `array of ${unique}${plural(renderType(inner.element as z.ZodType))}`;
  }
  if (inner instanceof z.ZodUnion) {
    return (inner.options as z.ZodType[]).map((option) => renderType(option)).join(" or ");
  }
  if (inner instanceof z.ZodObject) return `\`{${Object.keys(inner.shape).join(", ")}}\``;
  throw new Error(`no table wording for a ${inner.def.type} schema`);
}

function either(items: readonly string[]): string {
  return items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} or ${items.at(-1) ?? ""}`;
}

function plural(noun: string): string {
  return noun.endsWith("y") ? `${noun.slice(0, -1)}ies` : `${noun}s`;
}
