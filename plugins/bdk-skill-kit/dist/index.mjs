import { createRequire } from "node:module"; const require = createRequire(import.meta.url);

// src/index.ts
function defineConfig(config) {
  return config;
}
function definePlugin(plugin) {
  return plugin;
}
function defineRule(rule) {
  return rule;
}
export {
  defineConfig,
  definePlugin,
  defineRule
};
