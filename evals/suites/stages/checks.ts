// The expectations of a stage case, checked after the session against the
// kernel state it left (design D-8 of v3-t41-setup-change): state, read
// through kernel commands, decides a case; the reply only where a case says so.
import { isDeepStrictEqual } from "node:util";

import type { Expectation } from "./cases.ts";

export interface KernelCall {
  readonly code: number;
  readonly json: unknown;
}

export interface ShellCall {
  readonly code: number;
  readonly stdout: string;
}

export interface CheckResult {
  readonly pass: boolean;
  readonly failures: readonly string[];
}

/**
 * The values at a dotted path: object keys, array indexes, `length`, and `*`
 * for every element of an array, so `items.*.level` holds one value per item.
 */
export function valuesAt(value: unknown, path: string): unknown[] {
  let current: unknown[] = [value];
  for (const key of path.split(".")) {
    current = current.flatMap((item) => step(item, key));
  }
  return current;
}

function step(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) {
    if (key === "*") return value;
    return [key === "length" ? value.length : value[Number(key)]];
  }
  if (typeof value === "object" && value !== null) {
    return [(value as Record<string, unknown>)[key]];
  }
  return [undefined];
}

/** How a check names what it found: the one value, or every value of a `*` path. */
function shown(values: readonly unknown[], path: string): string {
  return JSON.stringify(path.split(".").includes("*") ? values : values[0]);
}

export function checkExpectations(
  expectations: readonly Expectation[],
  kernel: (args: string) => KernelCall,
  reply: string,
  shell: (command: string) => ShellCall = () => {
    throw new Error("this check runs no shell command");
  },
): CheckResult {
  const failures: string[] = [];
  for (const expectation of expectations) {
    if ("shell" in expectation) {
      const call = shell(expectation.shell);
      const exit = expectation.exit ?? 0;
      if (call.code !== exit) {
        failures.push(`${expectation.shell}: exit ${String(call.code)}, expected ${String(exit)}`);
      } else if (
        expectation.stdout !== undefined &&
        !new RegExp(expectation.stdout).test(call.stdout)
      ) {
        failures.push(`${expectation.shell}: stdout does not match /${expectation.stdout}/`);
      }
      continue;
    }
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
      const values = valuesAt(call.json, path);
      // `null` in a case file also stands for a path the answer does not hold;
      // a `*` path holds when any of its values does.
      if (!values.some((actual) => isDeepStrictEqual(actual ?? null, expected))) {
        failures.push(
          `${expectation.run}: ${path} is ${shown(values, path)}, expected ${JSON.stringify(expected)}`,
        );
      }
    }
    for (const [path, pattern] of Object.entries(expectation.match ?? {})) {
      const values = valuesAt(call.json, path);
      if (
        !values.some((actual) => typeof actual === "string" && new RegExp(pattern).test(actual))
      ) {
        failures.push(
          `${expectation.run}: ${path} is ${shown(values, path)}, expected to match ${pattern}`,
        );
      }
    }
  }
  return { pass: failures.length === 0, failures };
}
