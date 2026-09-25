// Test helpers: build throwaway project trees in the OS temp directory.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseDocument } from "./document.ts";
import type { Document, ResolvedTarget, TargetKind } from "./index.ts";

export function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "skill-check-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

export function skill(name: string, extra = "", body = "Do the thing.\n"): string {
  return `---\nname: ${name}\ndescription: Checks a thing. Use when a thing needs checking.\n${extra}---\n\n${body}`;
}

export function agent(name: string, extra = "", body = "Review the change.\n"): string {
  return `---\nname: ${name}\ndescription: Reviews a change. Use when a change needs review.\n${extra}---\n\n${body}`;
}

interface DocOptions {
  kind?: TargetKind;
  profile?: ResolvedTarget["profile"];
  path?: string;
  dir?: string;
  files?: string[];
}

/** A parsed document without touching the file system. */
export function doc(text: string, options: DocOptions = {}): Document {
  const kind = options.kind ?? "skills";
  const dir = options.dir ?? (kind === "skills" ? "skills/demo" : "agents");
  return parseDocument({
    kind,
    target: { kind, dirs: [kind], profile: options.profile ?? "claude-code", name: kind },
    path: options.path ?? (kind === "skills" ? `${dir}/SKILL.md` : `${dir}/demo.md`),
    dir,
    text,
    files: options.files ?? [],
  });
}
