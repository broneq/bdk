// `bdk export agents`: write or check the host's adapter files. Only the five
// adapter paths are read or written, so the v2 agents next to them stay
// untouched until T42 (design T23-D3, D22 of v3-t23a-roles-adapters).
import { join, relative } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { ADAPTERS } from "../domain/adapters.ts";
import { adapterFile, HOSTS } from "../domain/hosts.ts";
import type { AgentFile, AgentsReport } from "../domain/report.ts";
import type { HostId } from "../domain/hosts.ts";

export type { AgentsReport } from "../domain/report.ts";
export type { HostId } from "../domain/hosts.ts";

export interface ExportDeps {
  readonly store: Store;
  readonly pluginRoot: string;
}

export interface AgentsRequest {
  readonly host: HostId;
  /** Absolute; default the plugin root's `agents/`. */
  readonly out?: string;
  readonly check: boolean;
  /** Absolute; the output names paths relative to it. */
  readonly root: string;
}

export function exportAgents(deps: ExportDeps, request: AgentsRequest): AgentsReport | Refusal {
  const host = HOSTS[request.host];
  const out = request.out ?? join(deps.pluginRoot, "agents");
  const drift: string[] = [];
  const files = ADAPTERS.map((adapter): AgentFile => {
    const target = join(out, `${adapter.name}.md`);
    const path = relative(request.root, target);
    const content = adapterFile(adapter, host);
    const current = deps.store.read(target);
    const changed = current !== content;
    if (changed && request.check)
      drift.push(`${path} (${current === undefined ? "missing" : "edited"})`);
    if (changed && !request.check) deps.store.write(target, content);
    return { adapter: adapter.name, path, changed };
  });
  if (drift.length > 0) {
    return refuse(
      "policy/generated-drift",
      `${drift.length === 1 ? "1 generated adapter file differs" : `${drift.length} generated adapter files differ`} from bdk export agents --host ${host.id}: ${drift.join(", ")}`,
      [`bdk export agents --host ${host.id}`],
    );
  }
  return { host: host.id, files, changed: files.some((file) => file.changed) };
}
