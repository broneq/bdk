import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { splitLines } from "../document.ts";
import { defineRule, type Document } from "../index.ts";

interface Reference {
  target: string;
  line: number;
}

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const TICKED = /`([^`\s]+)`/g;
const SKILL_DIR = /\$\{CLAUDE_SKILL_DIR\}\/([^\s`'")]+)/g;
const CONVENTIONAL_DIRS = ["references", "scripts", "assets", "examples", "templates"];

/**
 * Relative paths a Markdown text points at inside its skill directory: links,
 * `${CLAUDE_SKILL_DIR}/...` anywhere, and backticked paths outside code fences
 * whose first segment is a conventional directory or an existing top-level entry.
 */
function references(
  lines: string[],
  inFence: (line: number) => boolean,
  topLevel: Set<string>,
): Reference[] {
  const out: Reference[] = [];
  lines.forEach((text, i) => {
    const line = i + 1;
    for (const m of text.matchAll(SKILL_DIR)) out.push({ target: clean(m[1] ?? ""), line });
    if (inFence(line)) return;
    for (const m of text.matchAll(LINK)) {
      const target = clean(m[1] ?? "");
      if (isLocal(target)) out.push({ target, line });
    }
    for (const m of text.matchAll(TICKED)) {
      const target = clean(m[1] ?? "");
      const first = target.split("/")[0] ?? "";
      if (
        target.includes("/") &&
        isLocal(target) &&
        (CONVENTIONAL_DIRS.includes(first) || topLevel.has(first))
      ) {
        out.push({ target, line });
      }
    }
  });
  return out;
}

const clean = (target: string) =>
  target
    .replace(/#.*$/, "")
    .replace(/^\.\//, "")
    .replace(/[.,;:]+$/, "");
const isLocal = (t: string) =>
  t !== "" && !/^(?:[a-z][a-z0-9+.-]*:|#|\/|~|\$|\.\.\/)/i.test(t) && !t.includes("${");

function topLevelOf(doc: Document): Set<string> {
  return new Set(doc.files.map((f) => f.split("/")[0] ?? f));
}

/** Whether `target` names a file of the skill, or a directory that holds one. */
function resolves(doc: Document, target: string): boolean {
  const t = target.replace(/\/$/, "");
  return doc.files.some((f) => f === t || f.startsWith(`${t}/`)) || t === basename(doc.path);
}

function readSkillFile(root: string, doc: Document, file: string): string[] {
  return splitLines(readFileSync(join(root, doc.dir, file), "utf8"));
}

const isText = (file: string) => /\.(md|markdown|txt)$/i.test(file);

export const referencesRule = defineRule({
  id: "references",
  kinds: ["skills"],
  defaultSeverity: "error",
  check(doc, ctx) {
    const top = topLevelOf(doc);
    const direct = references(doc.lines, doc.inFence, top);
    const linked = new Set(direct.map((r) => r.target));
    for (const ref of direct) {
      if (!resolves(doc, ref.target)) {
        ctx.report({
          line: ref.line,
          message: `\`${ref.target}\` does not exist in the skill directory`,
          match: ref.target,
        });
      }
    }
    for (const file of [...linked].filter((f) => doc.files.includes(f) && isText(f))) {
      const lines = readSkillFile(ctx.root, doc, file);
      for (const ref of references(lines, () => false, top)) {
        // Only a file one level down is hidden; naming a directory links nothing.
        if (ref.target === file || linked.has(ref.target) || !doc.files.includes(ref.target))
          continue;
        ctx.report({
          file: `${doc.dir}/${file}`,
          line: ref.line,
          severity: "warning",
          message: `\`${file}\` links on to \`${ref.target}\`; link it from SKILL.md to keep references one level deep`,
          match: `${file}->${ref.target}`,
        });
      }
    }
  },
});

export const unusedFiles = defineRule({
  id: "unused-files",
  kinds: ["skills"],
  defaultSeverity: "error",
  check(doc, ctx) {
    const mentioned = (text: string) => doc.files.filter((f) => text.includes(f));
    const first = mentioned(doc.text);
    const used = new Set(first);
    for (const file of first.filter(isText)) {
      for (const f of mentioned(readSkillFile(ctx.root, doc, file).join("\n"))) used.add(f);
    }
    for (const file of doc.files.filter((f) => !used.has(f))) {
      ctx.report({
        file: `${doc.dir}/${file}`,
        message: `\`${file}\` is not referenced from SKILL.md or a file it references`,
        match: file,
      });
    }
  },
});

export const layout = defineRule<{ allowed?: string[] }>({
  id: "layout",
  kinds: ["skills"],
  defaultSeverity: "error",
  defaultOptions: {},
  check(doc, ctx) {
    const { allowed } = ctx.options;
    if (!allowed) return;
    const entries = new Map<string, boolean>();
    for (const file of doc.files) {
      const [head = file, ...rest] = file.split("/");
      entries.set(head, (entries.get(head) ?? false) || rest.length > 0);
    }
    for (const [entry, isDir] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
      if (allowed.includes(entry)) continue;
      ctx.report({
        file: `${doc.dir}/${entry}`,
        message: `\`${entry}${isDir ? "/" : ""}\` is not an allowed top-level entry of a skill (allowed: ${allowed.join(", ")})`,
        match: entry,
      });
    }
  },
});

export const uniqueNames = defineRule({
  id: "unique-names",
  kinds: ["skills"],
  defaultSeverity: "error",
  checkProject(docs, ctx) {
    const byName = new Map<string, Document[]>();
    for (const doc of docs) {
      const name =
        typeof doc.frontmatter?.name === "string" ? doc.frontmatter.name : basename(doc.dir);
      byName.set(name, [...(byName.get(name) ?? []), doc]);
    }
    for (const [name, group] of byName) {
      if (group.length < 2) continue;
      for (const doc of group) {
        const others = group.filter((d) => d !== doc).map((d) => d.path);
        ctx.report({
          file: doc.path,
          line: doc.keyLines.name ?? 1,
          message: `skill name \`${name}\` is also used by ${others.join(", ")}`,
          match: name,
        });
      }
    }
  },
});
