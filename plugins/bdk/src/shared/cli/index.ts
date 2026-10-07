// The frame of the bdk CLI (design D8): what slices and `main.ts` import from `shared/cli`.

export { CliError, EXIT } from "./errors.ts";
export type { ErrorClass, ErrorCode } from "./errors.ts";
export { MIN_NODE, run } from "./run.ts";
export { closest } from "./suggest.ts";
export type { RunOptions } from "./run.ts";
export type { Argument, Command, Flag, Group, Input, Result } from "./types.ts";
