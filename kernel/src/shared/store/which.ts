// `which` for the kernel: whether a command is installed, answered from the
// file system so slices stay free of `node:fs` (`kernel-architecture`,
// shared/store). The runtime passes its environment and platform.
import { accessSync, constants, statSync } from "node:fs";
import { join } from "node:path";

export interface ExecutableLookup {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: string;
}

/** The first executable file named `name` on `PATH`, or undefined. */
export function findExecutable(name: string, lookup: ExecutableLookup): string | undefined {
  const windows = lookup.platform === "win32";
  const path = envValue(lookup.env, "PATH", windows) ?? "";
  const dirs = path.split(windows ? ";" : ":").filter((dir) => dir !== "");
  const names = windows
    ? (envValue(lookup.env, "PATHEXT", windows) ?? ".COM;.EXE;.BAT;.CMD")
        .split(";")
        .filter((ext) => ext !== "")
        .map((ext) => `${name}${ext}`)
    : [name];
  for (const dir of dirs) {
    for (const candidate of names) {
      const file = join(dir, candidate);
      if (isExecutableFile(file, windows)) return file;
    }
  }
  return undefined;
}

/** Windows keeps environment names case-insensitive (`Path`). */
function envValue(
  env: ExecutableLookup["env"],
  name: string,
  windows: boolean,
): string | undefined {
  if (!windows) return env[name];
  const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === name);
  return key === undefined ? undefined : env[key];
}

function isExecutableFile(file: string, windows: boolean): boolean {
  try {
    if (!statSync(file).isFile()) return false;
    if (!windows) accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
