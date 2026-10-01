// The expectations of a stage case, checked after the session against the
// kernel state it left (design D-8 of v3-t41-setup-change): state, read
// through kernel commands, decides a case; the reply only where a case says so.
import { isDeepStrictEqual } from "node:util";

import type { Expectation } from "./cases.ts";

export interface KernelCall {
  readonly code: number;
  readonly json: unknown;
}

export interface CheckResult {
  readonly pass: boolean;
  readonly failures: readonly string[];
}

/** The value at a dotted path: object keys, array indexes and `length`. */
export function valueAt(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const key of path.split(".")) {
    if (Array.isArray(current)) {
      current = key === "length" ? current.length : current[Number(key)];
    } else if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

export function checkExpectations(
  expectations: readonly Expectation[],
  kernel: (args: string) => KernelCall,
  reply: string,
): CheckResult {
  const failures: string[] = [];
  for (const expectation of expectations) {
    if ("reply" in expectation) {
      if (!new RegExp(expectation.reply).test(reply)) {
        failures.push(`reply does not match /${expectation.reply}/`);
      }
      continue;
    }
    const call = kernel(expectation.run);
    const reads = expectation.json !== undefined || expectation.match !== undefined;
    const exit = expectation.exit ?? (reads ? 0 : undefined);
    if (exit !== undefined && call.code !== exit) {
      failures.push(`${expectation.run}: exit ${String(call.code)}, expected ${String(exit)}`);
      continue;
    }
    for (const [path, expected] of Object.entries(expectation.json ?? {})) {
      const actual = valueAt(call.json, path);
      // `null` in a case file also stands for a path the answer does not hold.
      if (!isDeepStrictEqual(actual ?? null, expected)) {
        failures.push(
          `${expectation.run}: ${path} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
        );
      }
    }
    for (const [path, pattern] of Object.entries(expectation.match ?? {})) {
      const actual = valueAt(call.json, path);
      if (typeof actual !== "string" || !new RegExp(pattern).test(actual)) {
        failures.push(
          `${expectation.run}: ${path} is ${JSON.stringify(actual)}, expected to match ${pattern}`,
        );
      }
    }
  }
  return { pass: failures.length === 0, failures };
}
