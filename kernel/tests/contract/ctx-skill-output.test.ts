// `bdk ctx skill` output for every manifest entry, byte for byte (T23-D30 of
// v3-t23b-dispatch-envelope): the rule prompt values and `languages` moved
// from `ctx` to `rules`, and a skill's context must not change with the
// owner. The plugin texts are stand-ins named after their file, so a rule
// edit does not touch the snapshot; the settings exercise every part kind.
import { describe, expect, it } from "vitest";

import { renderContext } from "../../src/ctx/render/sections.ts";
import { SKILL_CONTEXT } from "../../src/ctx/use-cases/manifest.ts";
import { composeSkill } from "../../src/ctx/use-cases/skill.ts";
import { settingsRegistry } from "../../src/registrations.ts";
import { memoryStore } from "../../src/shared/store/index.ts";

const PLUGIN = "/plugin";
const PROJECT = "/repo";
const GLOBAL = "/home/dev/.config/bdk";

const registry = settingsRegistry();

/** Every default file of a declared prompt key, plus the plugin files the manifest names. */
function pluginFiles(): Record<string, string> {
  const paths = new Set<string>();
  for (const prompt of registry.prompts) {
    if (prompt.key === "rules/languages/*") {
      for (const name of ["typescript", "react"]) paths.add(`rules/languages/${name}.md`);
    } else if (prompt.defaultFile !== undefined) {
      paths.add(prompt.defaultFile);
    }
  }
  for (const parts of Object.values(SKILL_CONTEXT)) {
    for (const part of parts) if (part.kind === "file") paths.add(part.path);
  }
  return Object.fromEntries(
    [...paths].map((path) => [`${PLUGIN}/${path}`, `# ${path}\n\n- **Default.** Plugin text.\n`]),
  );
}

const SETTINGS = [
  "languages: [typescript, react, cobol]",
  "tools:",
  "  test:",
  "    - id: unit",
  "      command: pnpm test:unit",
  "      scoped: pnpm vitest run {files}",
  "      tier: fast",
  "  lint:",
  "    - id: eslint",
  "      command: pnpm lint",
  "      tier: lint",
  "",
].join("\n");

const input = {
  store: memoryStore({
    ...pluginFiles(),
    [`${PROJECT}/.bdk/settings.yaml`]: SETTINGS,
    [`${PROJECT}/.bdk/prompts/rules/security.md`]: "- **Project.** Extends security.\n",
    [`${PROJECT}/.bdk/prompts/rules/languages/react.md`]: "- **Project.** Extends react.\n",
  }),
  pluginRoot: PLUGIN,
  settings: registry,
  globalDir: GLOBAL,
  projectRoot: PROJECT,
  which: (name: string) => (name === "lavish-axi" ? "/usr/bin/lavish-axi" : undefined),
};

describe("ctx skill output", () => {
  it.each(Object.keys(SKILL_CONTEXT).sort())("%s is unchanged", (name) => {
    const outcome = composeSkill(input, name);
    if ("refused" in outcome) throw new Error(`refused: ${outcome.why}`);
    expect(JSON.stringify(renderContext(outcome), null, 2)).toMatchSnapshot();
  });
});
