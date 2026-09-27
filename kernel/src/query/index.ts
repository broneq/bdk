// The query slice (`kernel-cli/query`): read-only SQL over the index. A
// leaf: no other slice imports it.
import type { Registration } from "../shared/registry/index.ts";
import { queryCommand } from "./commands/query.ts";
import type { QueryDeps } from "./use-cases/query.ts";

export type { QueryDeps } from "./use-cases/query.ts";

export function queryRegistrations(deps: QueryDeps): Registration[] {
  return [{ id: "query", handler: queryCommand(deps) }];
}
