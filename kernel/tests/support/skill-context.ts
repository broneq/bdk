// The skill context lines check of `plugin-tooling`, Skill context lines: a
// skill that asks for its context does it with exactly the two lines of
// `kernel-cli`, Output modes, naming itself, and no skill injects anything
// another way. Inputs are passed in, so the negative controls seed a
// violation without touching disk.

export interface SkillFile {
  /** The skill's directory name. */
  readonly name: string;
  readonly text: string;
}

export interface ContextLineForms {
  /** `content-wrapper` of `kernel-cli`; its group is `ctx skill <name>` or `next`. */
  readonly wrapper: RegExp;
  /** `content-fallback` of `kernel-cli`; its group 1 is the skill name. */
  readonly fallback: RegExp;
}

export interface ContextLineCheck {
  readonly violations: string[];
  /** The skills that carry valid context lines. */
  readonly withLines: string[];
}

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
const FORBIDDEN = [
  { re: /!`[^`]*bdk\.mjs/, what: "a kernel `!` block" },
  { re: /!`[^`]*inject(-rules|-language-rules)?\.py/, what: "an inject script `!` block" },
  { re: /!`cat /, what: "a `cat` `!` block" },
];

export function contextLineViolations(
  skills: readonly SkillFile[],
  forms: ContextLineForms,
): ContextLineCheck {
  const violations: string[] = [];
  const withLines: string[] = [];
  for (const { name, text } of skills) {
    const lines = text.replace(FRONTMATTER, "").split("\n");
    const nonEmpty = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.trim() !== "");
    const asks = lines.some((line) => line.includes("ctx skill"));
    const context = new Set<number>();
    if (asks) {
      const [first, second] = nonEmpty;
      const wrapper = first === undefined ? null : forms.wrapper.exec(first.line);
      const fallback = second === undefined ? null : forms.fallback.exec(second.line);
      const wrapperName = /^ctx skill (.+)$/.exec(wrapper?.[1] ?? "")?.[1];
      if (wrapper === null || wrapperName === undefined) {
        violations.push(
          `${name}: the first body line is not the content wrapper calling ctx skill`,
        );
      } else if (wrapperName !== name) {
        violations.push(`${name}: the content wrapper names ${wrapperName}, not ${name}`);
      }
      if (fallback === null) {
        violations.push(`${name}: the second body line is not the fallback sentence`);
      } else if (fallback[1] !== name) {
        violations.push(`${name}: the fallback sentence names ${fallback[1] ?? ""}, not ${name}`);
      }
      if (first !== undefined) context.add(first.index);
      if (second !== undefined) context.add(second.index);
      if (wrapperName === name && fallback?.[1] === name) withLines.push(name);
    }
    lines.forEach((line, index) => {
      if (context.has(index)) return;
      for (const { re, what } of FORBIDDEN) {
        if (re.test(line)) violations.push(`${name}: line ${index + 1} holds ${what}`);
      }
    });
  }
  return { violations, withLines };
}

/** The skills with context lines must be exactly the manifest entries. */
export function manifestViolations(
  withLines: readonly string[],
  manifest: readonly string[],
): string[] {
  const lines = new Set(withLines);
  const entries = new Set(manifest);
  return [
    ...manifest
      .filter((name) => !lines.has(name))
      .map((name) => `${name}: a manifest entry, but its SKILL.md has no context lines`),
    ...withLines
      .filter((name) => !entries.has(name))
      .map((name) => `${name}: context lines, but no manifest entry`),
  ];
}
