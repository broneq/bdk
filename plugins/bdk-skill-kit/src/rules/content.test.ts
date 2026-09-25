import { describe, expect, it } from "vitest";
import type { Document, Report, Rule } from "../index.ts";
import { agent, doc, skill } from "../testing.ts";
import { absolutePaths, argumentsTypo, body, lineLimit, modelNames } from "./content.ts";

function run<O>(rule: Rule<O>, d: Document, options: Partial<O> = {}): Report[] {
  const reports: Report[] = [];
  rule.check?.(d, {
    options: { ...(rule.defaultOptions ?? ({} as O)), ...options },
    root: "/",
    report: (r) => reports.push(r),
  });
  return reports;
}

describe("body", () => {
  it("passes a body with text", () => {
    expect(run(body, doc(skill("demo")))).toEqual([]);
  });

  it("reports an empty body after the frontmatter", () => {
    expect(run(body, doc(skill("demo", "", "\n\n")))).toEqual([
      { line: 5, message: "the body after the frontmatter is empty" },
    ]);
  });

  it("skips a file whose frontmatter is not closed", () => {
    expect(run(body, doc("---\nname: x\n"))).toEqual([]);
  });
});

describe("line-limit", () => {
  const lines = (n: number) => skill("demo", "", "x\n".repeat(n - 5));

  it("passes a file at the limit", () => {
    expect(run(lineLimit, doc(lines(500)))).toEqual([]);
  });

  it("reports a file over the default of 500", () => {
    expect(run(lineLimit, doc(lines(501)))).toMatchObject([
      { line: 501, message: "the skill file has 501 lines; the limit is 500" },
    ]);
  });

  it("uses the max option", () => {
    expect(run(lineLimit, doc(lines(201)), { max: 200 })).toHaveLength(1);
  });
});

describe("absolute-paths", () => {
  it.each([
    "Read /Users/me/notes.md",
    "Write to /home/me/out",
    "cache in ~/.cache/x",
    "open C:\\temp\\x",
    "log to /tmp/run.log",
  ])("reports %j", (line) => {
    const [report] = run(absolutePaths, doc(skill("demo", "", `${line}\n`)));
    expect(report?.line).toBe(6);
    expect(report?.message).toMatch(
      /^absolute path `.+`; use a path relative to the skill or a \$\{VAR\}$/,
    );
  });

  it.each([
    "Run ${CLAUDE_PLUGIN_ROOT}/dist/x.mjs",
    "See https://example.com/home/page",
    "Read references/guide.md",
    "Use `a/b` and ./tmp/x",
  ])("passes %j", (line) => {
    expect(run(absolutePaths, doc(skill("demo", "", `${line}\n`)))).toEqual([]);
  });

  it("checks agents too", () => {
    expect(
      run(absolutePaths, doc(agent("rev", "", "Open /Users/x\n"), { kind: "agents" })),
    ).toHaveLength(1);
  });
});

describe("model-names", () => {
  it("reports a model family in the body, not in the model field", () => {
    const d = doc(skill("demo", "model: sonnet\n", "Delegate to a Haiku agent.\n"));
    expect(run(modelNames, d)).toEqual([
      {
        line: 7,
        message: "the body names the model `Haiku`; name the capability, not the model",
        match: "Haiku",
      },
    ]);
  });

  it.each(["uses gpt-4o", "on gemini-2.5-pro", "opus"])("reports %j", (text) => {
    expect(run(modelNames, doc(skill("demo", "", `${text}\n`)))).toHaveLength(1);
  });

  it("does not match inside words", () => {
    expect(run(modelNames, doc(skill("demo", "", "the opuscule and sonnets\n")))).toEqual([]);
  });

  it("uses the names option", () => {
    expect(
      run(modelNames, doc(skill("demo", "", "try llama\n")), { names: ["llama"] }),
    ).toHaveLength(1);
  });
});

describe("arguments-typo", () => {
  it("reports $ARGUMENT without S", () => {
    expect(run(argumentsTypo, doc(skill("demo", "", "Use $ARGUMENT here\n")))).toMatchObject([
      { line: 6, message: "`$ARGUMENT` is not substituted; write `$ARGUMENTS`" },
    ]);
  });

  it("passes $ARGUMENTS and $ARGUMENTS[0]", () => {
    expect(run(argumentsTypo, doc(skill("demo", "", "$ARGUMENTS and $ARGUMENTS[0]\n")))).toEqual(
      [],
    );
  });
});
