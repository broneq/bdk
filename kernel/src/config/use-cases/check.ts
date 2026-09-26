// `bdk config check`: errors are refusals (design D-8); warnings name files
// without a current modeline and a v2 settings file left behind. In a project
// with `.bdk/` it refreshes the snapshot and the offline schema copy.
import { join } from "node:path";

import {
  modelineUrl,
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
import type { ConfigInput } from "./input.ts";

const LEGACY_SETTINGS = ".bdk/settings.json";

export function checkConfig(input: ConfigInput): CheckReport | Refusal {
  const resolved = resolve(input);
  if (isRefusal(resolved)) return resolved;

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
