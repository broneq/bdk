// `bdk ctx skill` output for every manifest entry, byte for byte (T23-D30 of
// v3-t23b-dispatch-envelope): the rule prompt values and `languages` moved
// from `ctx` to `rules`, and a skill's context must not change with the
// owner. The plugin texts and the pack rules are stand-ins named after their
// file or id, so a rule edit does not touch the snapshot; the settings, the
// work tree and the project rules exercise every part kind and every way a
// rule is left out.
import { describe, expect, it } from "vitest";

import { renderContext } from "../../src/ctx/render/sections.ts";
import { SKILL_CONTEXT } from "../../src/ctx/use-cases/manifest.ts";
import { composeSkill } from "../../src/ctx/use-cases/skill.ts";
import { PACK_DIRS } from "../../src/rules/domain/rule.ts";
import { settingsRegistry } from "../../src/registrations.ts";
import { memoryStore } from "../../src/shared/store/index.ts";
import { fakeGit } from "../../src/log/tests/support.ts";
import { LANGUAGE_PATHS, PACK_STAGES } from "../support/pack-layout.ts";
import { ruleFile } from "../support/rule-file.ts";

const PLUGIN = "/plugin";
const PROJECT = "/repo";
const GLOBAL = "/home/dev/.config/bdk";

const registry = settingsRegistry();

/** Every default file of a declared prompt key, the plugin files the manifest names, and two rules per pack directory, with its stages and paths. */
function pluginFiles(): Record<string, string> {
  const paths = new Set<string>();
  for (const prompt of registry.prompts) {
    if (prompt.defaultFile !== undefined) paths.add(prompt.defaultFile);
  }
  for (const parts of Object.values(SKILL_CONTEXT)) {
    for (const part of parts) if (part.kind === "file") paths.add(part.path);
  }
  const pack = Object.entries(PACK_DIRS).flatMap(([dir, prefix]) =>
    [1, 2].map((n): [string, string] => [
      `${PLUGIN}/rules/${dir}/BDK-${prefix}-${String(n)}.md`,
      ruleFile(`BDK-${prefix}-${String(n)}`, {
        origin: "bdk",
        paths: LANGUAGE_PATHS[dir] ?? ["**"],
        stages: PACK_STAGES[dir] ?? [],
      }),
    ]),
  );
  return Object.fromEntries([
    ...[...paths].map((path): [string, string] => [
      `${PLUGIN}/${path}`,
      `# ${path}\n\n- **Default.** Plugin text.\n`,
    ]),
    ...pack,
  ]);
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
  "rules:",
  "  disabled: [BDK-SEC-2]",
  "",
].join("\n");

// TypeScript and API files: the TS and REACT packs and the scoped API-1 apply, the JS pack does not.
const git = fakeGit();
git.workTree.push("src/api/x.ts", "web/App.tsx", "README.md");

const input = {
  store: memoryStore({
    ...pluginFiles(),
    [`${PROJECT}/.bdk/settings.yaml`]: SETTINGS,
    [`${PROJECT}/.bdk/rules/NAMING-1.md`]: ruleFile("NAMING-1"),
    [`${PROJECT}/.bdk/rules/API-1.md`]: ruleFile("API-1", { paths: ["src/api/**"] }),
    [`${PROJECT}/.bdk/rules/E2E-1.md`]: ruleFile("E2E-1", { stages: ["execute", "review"] }),
  }),
  git,
  pluginRoot: PLUGIN,
  settings: registry,
  globalDir: GLOBAL,
  projectRoot: PROJECT,
  which: (name: string) => (name === "lavish-axi" ? "/usr/bin/lavish-axi" : undefined),
};

describe("ctx skill output", () => {
  it.each(Object.keys(SKILL_CONTEXT).sort())("%s is unchanged", async (name) => {
    const outcome = await composeSkill(input, name);
    if ("refused" in outcome) throw new Error(`refused: ${outcome.why}`);
    expect(JSON.stringify(renderContext(outcome), null, 2)).toMatchSnapshot();
  });
});
