// `commit` works on what the part commands work on: the store, git, the
// index, the clock, the plugin files and the settings registry.
import type { PartDeps } from "../../part/index.ts";

export type CommitDeps = PartDeps;
