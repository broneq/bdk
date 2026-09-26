import type * as z from "zod";

/** The fields a failed parse names: issue paths, plus the keys of an unknown-key issue. */
export function issues(schema: z.ZodType, data: unknown): string[] {
  const result = schema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.flatMap((issue) => {
    const path = issue.path.join(".");
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => (path === "" ? key : `${path}.${key}`));
    }
    return [path];
  });
}

/** `data` without `key`. */
export function without(data: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([name]) => name !== key));
}
