// The configuration of `kernel-settings`: layers, merge, module registry,
// prompt values, snapshot and JSON Schema. Slices declare their modules in
// their own `config.ts` and read resolved values through this module.
export { pluginRootOf, readKernelVersion, UNKNOWN_VERSION } from "./manifest.ts";
export { globalDir, LAYER_NAMES, layerFiles, readLayers } from "./layers.ts";
export type { Environment, FileLayerName, Layer, LayerName, LayerPaths } from "./layers.ts";
export { closest } from "./hint.ts";
export { mergeLayers } from "./merge.ts";
export type { Merged } from "./merge.ts";
export type { ConfigProblem } from "./problems.ts";
export { createConfigRegistry, defineConfigModule, definePromptKey } from "./registry.ts";
export type { ConfigModule, ConfigRegistry, PromptKey } from "./registry.ts";
export { declaredSteps, unknownKeyMessage, validateLayers } from "./validate.ts";
export type { Validated } from "./validate.ts";
export { PLANNED_KEYS, REMOVED_KEYS } from "./known.ts";
export type { PlannedKey, RemovedKey } from "./known.ts";
export { keyPaths, keySteps, leafPaths, unwrap } from "./keys.ts";
export type { KeyNode, KeyStep } from "./keys.ts";
export { promptsModule } from "./modules.ts";
export { promptContent, resolvePrompts } from "./prompts.ts";
export type { PromptFile, PromptInput, PromptMode, PromptValue, Prompts } from "./prompts.ts";
export { resolveConfig } from "./resolve.ts";
export { displayPath, problemRefusal, resolveOrRefuse, schemaCommand } from "./refusal.ts";
export type { ResolveScope, Resolved } from "./refusal.ts";
export type { ConfigContext, Resolution } from "./resolve.ts";
export { overriddenKeys, SNAPSHOT_PATH, writeSnapshot } from "./snapshot.ts";
export { SETTINGS_SCHEMA_ID, settingsJsonSchema } from "./json-schema.ts";
export {
  modeline,
  modelineUrl,
  OFFLINE_SCHEMA_PATH,
  offlineSchemaText,
  settingsSchemaUrl,
  withModeline,
} from "./modeline.ts";
export { isRecord, valueAt } from "./values.ts";
export type { Mapping } from "./values.ts";
