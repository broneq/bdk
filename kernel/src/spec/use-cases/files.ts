// Where deltas and living specs live (`kernel-state`, Change directory layout
// and Living spec file; T30-D4): `spec-delta/<capability>.md` in the Change,
// `.bdk/specs/<capability>/spec.md` in the project, nested alike.
import { join, relative } from "node:path";

import { moduleValue, resolveOrRefuse } from "../../shared/config/index.ts";
import type { Mapping, Resolved } from "../../shared/config/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { specModule } from "../config.ts";
import { parseDelta } from "../domain/grammar.ts";
import type { Delta, LivingSpec } from "../domain/grammar.ts";
import type { SpecDeps } from "./deps.ts";
import { livingOf } from "./living.ts";

export interface DeltaFile {
  readonly capability: string;
  readonly path: string;
  readonly text: string;
  readonly delta: Delta;
}

export interface CurrentSpec {
  readonly path: string;
  /** Undefined when the capability has no spec file yet. */
  readonly text?: string;
  readonly living?: LivingSpec;
}

/** Every `spec-delta/**\/*.md` of a Change directory, in path order. */
export function listDeltas(store: Store, changeDir: string): DeltaFile[] {
  const root = join(changeDir, "spec-delta");
  const found: DeltaFile[] = [];
  const visit = (dir: string): void => {
    for (const name of store.list(dir)) {
      const path = join(dir, name);
      if (name.endsWith("/")) visit(path);
      else if (name.endsWith(".md")) {
        const text = store.read(path) ?? "";
        const capability = relative(root, path).slice(0, -".md".length).replaceAll("\\", "/");
        found.push({ capability, path, text, delta: parseDelta(text) });
      }
    }
  };
  visit(root);
  return found.sort((a, b) =>
    a.capability < b.capability ? -1 : a.capability > b.capability ? 1 : 0,
  );
}

export function specsDir(projectRoot: string): string {
  return join(projectRoot, ".bdk", "specs");
}

export function readCurrent(store: Store, projectRoot: string, capability: string): CurrentSpec {
  const path = join(specsDir(projectRoot), capability, "spec.md");
  const text = store.read(path);
  return text === undefined ? { path } : { path, text, living: livingOf(text) };
}

/** The resolved settings, removed keys ignored. */
export function specSettings(
  deps: SpecDeps,
  projectRoot: string,
  globalDir: string,
): Resolved | Refusal {
  return resolveOrRefuse(
    {
      store: deps.store,
      settings: deps.settings,
      globalDir,
      projectRoot,
      pluginRoot: deps.pluginRoot,
    },
    { removed: "ignore" },
  );
}

export function normativeWord(settings: Readonly<Mapping>): string {
  return moduleValue(specModule, settings)["normative-word"];
}
