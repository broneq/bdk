// The first problem of a failed validation, worded for a usage error.
import type { z } from "zod";

export function problem(error: z.ZodError): string {
  const [issue] = error.issues;
  if (issue === undefined) return "invalid input";
  const [field] = issue.path;
  return field === undefined ? issue.message : `--${String(field)}: ${issue.message}`;
}
