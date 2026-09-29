// The pinned tool package (design D-1): promptfoo and the Agent SDK live in
// `evals/package.json` and install into `evals/node_modules`, which is an
// ancestor of every rendered config, so promptfoo resolves the SDK from it.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

export function needsInstall(evalsDir: string): boolean {
  const modules = join(evalsDir, "node_modules/.modules.yaml");
  if (!existsSync(join(evalsDir, "node_modules/.bin/promptfoo")) || !existsSync(modules))
    return true;
  return statSync(join(evalsDir, "pnpm-lock.yaml")).mtimeMs > statSync(modules).mtimeMs;
}

export function ensureTools(evalsDir: string): void {
  if (!needsInstall(evalsDir)) return;
  execFileSync("pnpm", ["--dir", evalsDir, "install", "--frozen-lockfile", "--ignore-workspace"], {
    stdio: "inherit",
  });
}

function promptfooBin(evalsDir: string): string {
  return join(evalsDir, "node_modules/.bin/promptfoo");
}

// No telemetry and no update check from the pinned tool.
const QUIET = { PROMPTFOO_DISABLE_TELEMETRY: "1", PROMPTFOO_DISABLE_UPDATE: "1" };

/** Validates a rendered config with the pinned promptfoo; no credentials, no model call. */
export function validateConfig(evalsDir: string, config: string): void {
  execFileSync(promptfooBin(evalsDir), ["validate", "config", "-c", config], {
    stdio: "pipe",
    env: { ...process.env, ...QUIET },
  });
}

/**
 * Runs a series and resolves to promptfoo's exit code: 0 all assertions
 * passed, 100 some failed (a measured outcome, not an error), anything else a
 * failure such as the budget stop.
 */
export function evaluate(
  evalsDir: string,
  config: string,
  output: string,
  env: Readonly<Record<string, string>>,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      promptfooBin(evalsDir),
      ["eval", "--no-cache", "-c", config, "-o", output],
      {
        stdio: "inherit",
        env: { ...process.env, ...QUIET, ...env },
      },
    );
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}
