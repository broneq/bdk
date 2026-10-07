// What `check run` works on: what the part and evidence use cases work on,
// since it runs the diff check, reads the graph and records evidence, and
// the shell the project's commands run in.
import type { EvidenceDeps } from "../../evidence/index.ts";
import type { PartDeps } from "../../part/index.ts";
import type { Shell } from "../../shared/git/index.ts";

export type CheckDeps = PartDeps & EvidenceDeps & { readonly shell: Shell };
