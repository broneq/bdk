// Plain-data helpers shared by the merge, the validation and the commands.

export type Mapping = Record<string, unknown>;

export function isRecord(value: unknown): value is Mapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** An array whose items are all mappings with a string `id`: merged and addressed by id. */
export function isIdArray(value: unknown): value is (Mapping & { id: string })[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isRecord(item) && typeof item.id === "string")
  );
}

export function joinKey(prefix: string, segment: string): string {
  return prefix === "" ? segment : `${prefix}.${segment}`;
}

/** The value `steps` reach in `root`; an id step picks the array item with that id. */
export function valueAt(
  root: unknown,
  steps: readonly { readonly segment: string; readonly id: boolean }[],
): unknown {
  let value = root;
  for (const { segment, id } of steps) {
    if (id) value = isIdArray(value) ? value.find((item) => item.id === segment) : undefined;
    else value = isRecord(value) ? value[segment] : undefined;
    if (value === undefined) return undefined;
  }
  return value;
}
