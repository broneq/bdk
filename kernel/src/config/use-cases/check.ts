// `bdk config check`: errors are refusals (design D-8); warnings name files
// without a current modeline and a v2 settings file left behind. In a project
// with `.bdk/` it refreshes the snapshot and the offline schema copy.
// `inspectConfig` is the same check with every error kept, for
// `hooks session-start`, which prints one line per problem.
import { join } from "node:path";

import {
  modelineUrl,
  problemRefusal,
  resolveConfig,
  OFFLINE_SCHEMA_PATH,
  offlineSchemaText,
  overriddenKeys,
  readKernelVersion,
  settingsSchemaUrl,
  writeSnapshot,
} from "../../shared/config/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { CheckReport, CheckWarning } from "../domain/report.ts";
import { displayPath, isRefusal, resolve } from "./input.ts";
import type { ConfigInput, Resolved } from "./input.ts";

const LEGACY_SETTINGS = ".bdk/settings.json";

export function checkConfig(input: ConfigInput): CheckReport | Refusal {
  const resolved = resolve(input);
  return isRefusal(resolved) ? resolved : report(input, resolved);
}

export interface Inspection {
  /** One refusal per configuration error; empty when the configuration is valid. */
  readonly errors: readonly Refusal[];
  /** The check of a valid configuration: its warnings, snapshot and overridden keys. */
  readonly report?: CheckReport;
}

export function inspectConfig(input: ConfigInput): Inspection {
  const resolution = resolveConfig({ ...input, registry: input.settings });
  if (resolution.problems.length > 0 || resolution.value === undefined) {
    return { errors: resolution.problems.map((problem) => problemRefusal(input, problem, 0)) };
  }
  return { errors: [], report: report(input, { ...resolution, value: resolution.value }) };
}

function report(input: ConfigInput, resolved: Resolved): CheckReport {
  const url = settingsSchemaUrl(readKernelVersion(input.store, input.pluginRoot));
  const problems: CheckWarning[] = [];
  for (const layer of resolved.layers) {
    const current = modelineUrl(layer.text);
    const path = displayPath(input, layer.path);
    if (current === undefined) {
      problems.push({
        layer: layer.name,
        path,
        code: "missing-modeline",
        message: "no yaml-language-server modeline; bdk doctor --fix adds it",
      });
    } else if (current !== url) {
      problems.push({
        layer: layer.name,
        path,
        code: "schema-outdated",
        message: `the modeline points at ${current}, not ${url}; bdk doctor --fix updates it`,
      });
    }
  }
  if (input.store.exists(join(input.projectRoot, LEGACY_SETTINGS))) {
    problems.push({
      layer: "project",
      path: LEGACY_SETTINGS,
      code: "legacy-settings",
      message: "the v2 settings file is not read; bdk import converts it to .bdk/settings.yaml",
    });
  }

  const snapshot = writeSnapshot(input.store, input.projectRoot, resolved);
  if (snapshot !== undefined) {
    input.store.write(
      join(input.projectRoot, OFFLINE_SCHEMA_PATH),
      offlineSchemaText(input.settings),
    );
  }
  return {
    problems,
    ...(snapshot === undefined ? {} : { snapshot }),
    overriddenKeys: overriddenKeys(resolved),
  };
}
