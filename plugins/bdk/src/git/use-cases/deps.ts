// What the git slice needs from the OS, injected by `src/main.ts` (design D7).

import type { Files } from "../../shared/fs/index.ts";

export interface GitDeps {
  /** Runs `git <args>` in `cwd`: `git` of `shared/git` or a fake in tests. */
  readonly git: (cwd: string, args: readonly string[]) => string;
  readonly files: Files;
  /** The working directory: where git runs and relative paths resolve. */
  readonly cwd: string;
}
