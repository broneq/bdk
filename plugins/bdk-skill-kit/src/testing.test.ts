import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defineRule, type Document } from "./index.ts";
import { agent, skill } from "./test-helpers.ts";
import { checkRule } from "./testing.ts";

const everyDoc = defineRule({
  id: "every-doc",
  kinds: ["skills", "agents"],
  defaultSeverity: "error",
  check(doc, ctx) {
    ctx.report({ message: `saw ${doc.path}`, line: doc.keyLines.name ?? 1 });
  },
});

describe("checkRule", () => {
  it("runs a per-document rule over the files of one skills target", async () => {
    const findings = await checkRule(everyDoc, {
      files: {
        "plan/SKILL.md": skill("plan"),
        "plan/references/x.md": "x\n",
        "build/SKILL.md": skill("build"),
      },
    });
    expect(findings).toEqual([
      expect.objectContaining({
        rule: "every-doc",
        severity: "error",
        file: "build/SKILL.md",
        line: 2,
        message: "saw build/SKILL.md",
      }),
      expect.objectContaining({ file: "plan/SKILL.md", message: "saw plan/SKILL.md" }),
    ]);
  });

  it("parses documents as the CLI does", async () => {
    let seen: Document | undefined;
    await checkRule(
      defineRule({
        id: "probe",
        kinds: ["skills"],
        defaultSeverity: "error",
        check(doc) {
          seen = doc;
        },
      }),
      { files: { "plan/SKILL.md": skill("plan"), "plan/references/x.md": "x\n" } },
    );
    expect(seen).toMatchObject({
      kind: "skills",
      path: "plan/SKILL.md",
      dir: "plan",
      frontmatter: { name: "plan" },
      bodyStart: 5,
      files: ["references/x.md"],
      target: { kind: "skills", profile: "claude-code" },
    });
  });

  it("checks agents files when the kind is agents", async () => {
    const findings = await checkRule(everyDoc, {
      kind: "agents",
      files: { "reviewer.md": agent("reviewer") },
    });
    expect(findings.map((f) => f.file)).toEqual(["reviewer.md"]);
  });

  it("runs a project rule once over every document and the strays", async () => {
    const calls: { paths: string[]; strays: string[] }[] = [];
    const findings = await checkRule(
      defineRule({
        id: "count",
        kinds: ["skills"],
        defaultSeverity: "warning",
        checkProject(docs, ctx) {
          calls.push({ paths: docs.map((d) => d.path), strays: ctx.strays });
          ctx.report({ message: `${docs.length} skills`, file: "a/SKILL.md" });
        },
      }),
      {
        files: {
          "a/SKILL.md": skill("a"),
          "b/SKILL.md": skill("b"),
          "loose/notes.md": "notes\n",
        },
      },
    );
    expect(calls).toEqual([{ paths: ["a/SKILL.md", "b/SKILL.md"], strays: ["loose"] }]);
    expect(findings).toEqual([
      expect.objectContaining({ rule: "count", severity: "warning", message: "2 skills" }),
    ]);
  });

  it("merges options over the rule's default options", async () => {
    const seen: object[] = [];
    const rule = defineRule<{ a: number; b: number }>({
      id: "opts",
      kinds: ["skills"],
      defaultSeverity: "error",
      defaultOptions: { a: 1, b: 2 },
      check(_doc, ctx) {
        seen.push(ctx.options);
      },
    });
    const files = { "plan/SKILL.md": skill("plan") };
    await checkRule(rule, { files, options: { b: 3 } });
    await checkRule(rule, { files });
    expect(seen).toEqual([
      { a: 1, b: 3 },
      { a: 1, b: 2 },
    ]);
  });

  it("applies the profile to every document's target", async () => {
    const profiles: string[] = [];
    await checkRule(
      defineRule({
        id: "profile",
        kinds: ["skills"],
        defaultSeverity: "error",
        check(doc) {
          profiles.push(doc.target.profile);
        },
      }),
      { profile: "portable", files: { "plan/SKILL.md": skill("plan") } },
    );
    expect(profiles).toEqual(["portable"]);
  });

  it("runs a rule that is off by default, at error", async () => {
    const findings = await checkRule(
      { ...everyDoc, defaultSeverity: "off" },
      { files: { "plan/SKILL.md": skill("plan") } },
    );
    expect(findings.map((f) => f.severity)).toEqual(["error"]);
  });

  it("caps a report marked as warning", async () => {
    const findings = await checkRule(
      defineRule({
        id: "soft",
        kinds: ["skills"],
        defaultSeverity: "error",
        check(_doc, ctx) {
          ctx.report({ message: "soft", severity: "warning" });
        },
      }),
      { files: { "plan/SKILL.md": skill("plan") } },
    );
    expect(findings.map((f) => f.severity)).toEqual(["warning"]);
  });

  it("rejects options the rule's validateOptions rejects", async () => {
    const rule = defineRule<{ x?: string }>({
      id: "needs",
      kinds: ["skills"],
      defaultSeverity: "off",
      validateOptions: (o) => (o.x ? undefined : "option `x` is required"),
      check(_doc, ctx) {
        ctx.report({ message: ctx.options.x ?? "" });
      },
    });
    const files = { "plan/SKILL.md": skill("plan") };
    await expect(checkRule(rule, { files })).rejects.toThrow(
      "rule `needs` in target `skills`: option `x` is required",
    );
    expect((await checkRule(rule, { files, options: { x: "ok" } })).map((f) => f.message)).toEqual([
      "ok",
    ]);
  });

  it("rejects a target the config loader rejects", async () => {
    await expect(
      checkRule(everyDoc, { kind: "agents", profile: "portable", files: {} }),
    ).rejects.toThrow("the portable profile has no agents");
  });

  it.each(["../escape/SKILL.md", "/abs/SKILL.md", "a/../../SKILL.md"])(
    "rejects the file path %s",
    async (path) => {
      await expect(checkRule(everyDoc, { files: { [path]: "x" } })).rejects.toThrow(
        `file path \`${path}\` must stay inside the target directory`,
      );
    },
  );

  it("removes the temporary directory when it returns and when the rule throws", async () => {
    const roots: string[] = [];
    const rule = (fail: boolean) =>
      defineRule({
        id: "root",
        kinds: ["skills"],
        defaultSeverity: "error",
        check(_doc, ctx) {
          roots.push(ctx.root);
          expect(existsSync(ctx.root)).toBe(true);
          if (fail) throw new Error("boom");
        },
      });
    const files = { "plan/SKILL.md": skill("plan") };
    await checkRule(rule(false), { files });
    await expect(checkRule(rule(true), { files })).rejects.toThrow("boom");
    expect(roots).toHaveLength(2);
    for (const root of roots) expect(existsSync(root)).toBe(false);
  });
});
