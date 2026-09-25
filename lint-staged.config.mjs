// A JavaScript config, not a package.json key: the skill-check entry needs the
// function form.
export default {
  // ESLint covers kernel/ and tools/; a staged root config is ignored, not a warning.
  "*.ts": ["eslint --max-warnings 0 --no-warn-ignored --fix", "prettier --write"],
  "*.{js,mjs,json,yaml,yml,md}": "prettier --write",
  // The function form runs one check over every target, without the staged
  // paths: project rules (unique names, namespaced references) need them all.
  "{skills,agents}/**": () => "pnpm skill-check",
};
