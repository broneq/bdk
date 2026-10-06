// `config show --origins`: the leaves of the shown value, each of which gets
// its layer; an id array's entries are addressed by id.

export function leafKeys(value: unknown, prefix: string): string[] {
  if (isMapping(value) && Object.keys(value).length > 0) {
    return Object.entries(value).flatMap(([key, child]) => leafKeys(child, join(prefix, key)));
  }
  if (Array.isArray(value) && value.length > 0 && value.every(hasId)) {
    return value.flatMap((item) => leafKeys(item, join(prefix, item.id)));
  }
  return [prefix];
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasId(value: unknown): value is Record<string, unknown> & { id: string } {
  return isMapping(value) && typeof value.id === "string";
}

function join(prefix: string, key: string): string {
  return prefix === "" ? key : `${prefix}.${key}`;
}
