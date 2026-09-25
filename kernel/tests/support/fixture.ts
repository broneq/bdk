// A throwaway git repository for E2E tests: created under the OS temp
// directory, populated with the files a case needs, removed afterwards.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface Fixture {
  readonly root: string;
  remove(): void;
}

export interface FixtureOptions {
  /** Relative path -> file content; a path ending in "/" creates a directory. */
  readonly files?: Readonly<Record<string, string>>;
  /** Skip `git init`, for cases outside a work tree. */
  readonly git?: boolean;
}

export function createFixture(options: FixtureOptions = {}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "bdk-e2e-"));
  if (options.git !== false) execFileSync("git", ["init", "--quiet"], { cwd: root });
  for (const [path, content] of Object.entries(options.files ?? {})) {
    const target = join(root, path);
    if (path.endsWith("/")) {
      mkdirSync(target, { recursive: true });
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return {
    root,
    remove: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
