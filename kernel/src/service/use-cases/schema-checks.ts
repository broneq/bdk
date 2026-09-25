// The settings schema checks of `doctor` (T12, `kernel-cli/service`): the
// modeline of the project and local files and the offline schema copy. They
// run only in a project with `.bdk/settings.yaml`; `--fix` repairs both.
import { join } from "node:path";

import {
  modelineUrl,
  OFFLINE_SCHEMA_PATH,
  offlineSchemaText,
  readKernelVersion,
  settingsSchemaUrl,
  withModeline,
} from "../../shared/config/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import type { Store } from "../../shared/store/index.ts";
import type { Finding } from "../domain/report.ts";

const SETTINGS_FILES = [".bdk/settings.yaml", ".bdk/settings.local.yaml"] as const;
const REPAIR = "bdk doctor --fix";

export interface SchemaCheckInput {
  readonly store: Store;
  readonly settings: ConfigRegistry;
  readonly pluginRoot: string;
  readonly root: string;
  readonly fix: boolean;
}

export function schemaFindings(input: SchemaCheckInput): Finding[] {
  const { store, root } = input;
  if (!store.exists(join(root, SETTINGS_FILES[0]))) return [];
  const version = readKernelVersion(store, input.pluginRoot);
  const url = settingsSchemaUrl(version);
  const findings: Finding[] = [];

  const stale: string[] = [];
  for (const file of SETTINGS_FILES) {
    const path = join(root, file);
    const text = store.read(path);
    if (text === undefined || modelineUrl(text) === url) continue;
    if (input.fix) store.write(path, withModeline(text, version));
    else stale.push(file);
  }
  if (stale.length > 0) {
    findings.push({
      id: "schema-modeline",
      level: "warn",
      summary: `${stale.join(" and ")} lack the yaml-language-server modeline of v${version}`,
      repair: REPAIR,
    });
  }

  const copy = join(root, OFFLINE_SCHEMA_PATH);
  const expected = offlineSchemaText(input.settings);
  const current = store.read(copy);
  if (current !== expected) {
    if (input.fix) store.write(copy, expected);
    else {
      findings.push({
        id: "schema-offline",
        level: "warn",
        summary: `${OFFLINE_SCHEMA_PATH} is ${current === undefined ? "missing" : "outdated"}`,
        repair: REPAIR,
      });
    }
  }
  return findings;
}
