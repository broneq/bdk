// The rule store (`kernel-cli/rules`, bdk rules check; `rule-pack`, Pack
// layout): the bundle's pack and `.bdk/rules/` read with one schema, and every
// problem `rules check` reports.
import { describe, expect, it } from "vitest";

import { memoryStore } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { loadRules } from "../use-cases/store.ts";

const PLUGIN = "/plugin";
const ROOT = "/repo";

function rule(id: string, extra = "", body = `Text of ${id}.`): string {
  return `---\nschema: 1\nid: ${id}\nkind: house\nseverity: medium\norigin: bdk\nsince: 2026-09-30\n${extra}---\n\n${body}\n`;
}

function project(id: string, extra = ""): string {
  return rule(id, extra).replace("origin: bdk", "origin: user");
}

function load(store: Store, disabled: readonly string[] = []) {
  return loadRules({ store, pluginRoot: PLUGIN, projectRoot: ROOT, disabled });
}

function codes(store: Store, disabled: readonly string[] = []): [string, string][] {
  return load(store, disabled).problems.map((problem) => [problem.code, problem.file]);
}

describe("loadRules", () => {
  it("reads the bundle's pack and the project's rules with their text", () => {
    const store = memoryStore({
      [`${PLUGIN}/rules/README.md`]: "# The pack\n",
      [`${PLUGIN}/rules/code-quality/BDK-CQ-1.md`]: rule("BDK-CQ-1"),
      [`${PLUGIN}/rules/languages/react/BDK-REACT-2.md`]: rule(
        "BDK-REACT-2",
        "applies: ['**/*.tsx']\n",
      ),
      [`${ROOT}/.bdk/rules/API-1.md`]: project("API-1", "applies: [src/api/**]\n"),
    });
    const loaded = load(store);
    expect(loaded.problems).toStrictEqual([]);
    expect(
      loaded.rules.map((entry) => [entry.id, entry.scope, entry.file, entry.pack ?? null]),
    ).toStrictEqual([
      ["BDK-CQ-1", "bundle", "rules/code-quality/BDK-CQ-1.md", "code-quality"],
      ["BDK-REACT-2", "bundle", "rules/languages/react/BDK-REACT-2.md", "languages/react"],
      ["API-1", "project", ".bdk/rules/API-1.md", null],
    ]);
    const api = loaded.rules[2];
    expect(api?.prefix).toBe("API");
    expect(api?.number).toBe(1);
    expect(api?.applies).toStrictEqual(["src/api/**"]);
    expect(api?.text).toBe("Text of API-1.");
  });

  it("keeps a tombstone with its reason", () => {
    const store = memoryStore({
      [`${ROOT}/.bdk/rules/API-2.md`]: project("API-2", "removed: superseded by API-5\n"),
    });
    expect(load(store).rules[0]?.removed).toBe("superseded by API-5");
  });

  it("accepts origin user and qualified evidence", () => {
    const store = memoryStore({
      [`${ROOT}/.bdk/rules/API-1.md`]: project(
        "API-1",
        "evidence: [2026-09-25-passwordless-login/L-m2x9v7qa, 2026-09-27-export-csv/A-7f3k9m2q]\n",
      ).replace("origin: user", "origin: 2026-09-25-passwordless-login/L-m2x9v7qa"),
      [`${ROOT}/.bdk/rules/API-2.md`]: project("API-2"),
    });
    expect(codes(store)).toStrictEqual([]);
  });

  it("refuses a BDK- id in the project and a bundle id without it", () => {
    const store = memoryStore({
      [`${PLUGIN}/rules/code-quality/CQ-1.md`]: rule("CQ-1"),
      [`${ROOT}/.bdk/rules/BDK-CQ-9.md`]: project("BDK-CQ-9"),
    });
    expect(codes(store)).toStrictEqual([
      ["bundle-prefix", "rules/code-quality/CQ-1.md"],
      ["bundle-prefix", ".bdk/rules/BDK-CQ-9.md"],
    ]);
  });

  it("refuses a pack rule outside its prefix's directory", () => {
    const store = memoryStore({
      [`${PLUGIN}/rules/code-quality/BDK-SEC-1.md`]: rule("BDK-SEC-1"),
      [`${PLUGIN}/rules/misc/BDK-MISC-1.md`]: rule("BDK-MISC-1"),
      [`${PLUGIN}/rules/languages/go/BDK-GO-1.md`]: rule("BDK-GO-1"),
    });
    expect(codes(store)).toStrictEqual([
      ["pack-dir", "rules/code-quality/BDK-SEC-1.md"],
      ["pack-dir", "rules/languages/go/BDK-GO-1.md"],
      ["pack-dir", "rules/misc/BDK-MISC-1.md"],
    ]);
  });

  it("refuses an id that differs from the file name", () => {
    const store = memoryStore({ [`${ROOT}/.bdk/rules/API-1.md`]: project("API-4") });
    expect(codes(store)).toStrictEqual([["id-mismatch", ".bdk/rules/API-1.md"]]);
  });

  it("names the field a knowledge rule lacks", () => {
    const store = memoryStore({
      [`${ROOT}/.bdk/rules/LIB-1.md`]: project("LIB-1", "source: https://example.com\n").replace(
        "kind: house",
        "kind: knowledge",
      ),
    });
    const [problem] = load(store).problems;
    expect(problem?.code).toBe("format");
    expect(problem?.message).toMatch(/verified/);
  });

  it("refuses a file without frontmatter or with broken YAML", () => {
    const store = memoryStore({
      [`${ROOT}/.bdk/rules/API-1.md`]: "Just text.\n",
      [`${ROOT}/.bdk/rules/API-2.md`]: "---\nid: [\n---\n\nText.\n",
    });
    expect(codes(store)).toStrictEqual([
      ["format", ".bdk/rules/API-1.md"],
      ["format", ".bdk/rules/API-2.md"],
    ]);
  });

  it("names both files of an id declared twice", () => {
    const store = memoryStore({
      [`${ROOT}/.bdk/rules/API-3.md`]: project("API-3"),
      [`${ROOT}/.bdk/rules/API-4.md`]: project("API-3"),
    });
    const problems = load(store).problems;
    const duplicate = problems.find((problem) => problem.code === "duplicate-id");
    expect(duplicate?.message).toMatch(/\.bdk\/rules\/API-3\.md/);
    expect(duplicate?.message).toMatch(/\.bdk\/rules\/API-4\.md/);
  });

  it("refuses a disabled id that names no rule", () => {
    const store = memoryStore({ [`${PLUGIN}/rules/code-quality/BDK-CQ-1.md`]: rule("BDK-CQ-1") });
    expect(codes(store, ["BDK-CQ-1", "BDK-CQ-99"])).toStrictEqual([
      ["unknown-disabled-id", "rules.disabled"],
    ]);
  });
});
