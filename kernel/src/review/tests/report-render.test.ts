// The templates of `bdk review render` (`kernel-cli/review`; T42-H, J): byte
// snapshots of the fixture report in HTML and Markdown, escaping, the legend,
// no external resource, `track` only with a tracker, and the form that sends
// one prompt through Lavish and stays disabled outside it.
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

import { prPage } from "../domain/pr.ts";
import { changeReport } from "../domain/report.ts";
import { changeReportHtml, prPageHtml } from "../render/report-html.ts";
import { changeReportMd } from "../render/report-md.ts";
import { fixture } from "./report-fixture.ts";

const SCRIPT = "<script>alert(1)</script>";

function hostile(): string {
  const base = fixture();
  return changeReportHtml(
    changeReport({
      ...base,
      files: [...base.files, { path: `src/auth/${SCRIPT}.ts`, added: 1, removed: 0 }],
      areas: new Map([["auth", SCRIPT]]),
      entries: base.entries.map((item) =>
        item.id === "L-00000002" ? { ...item, summary: SCRIPT, body: SCRIPT } : item,
      ),
    }),
  );
}

/** Runs the page's inline script against a minimal DOM of the Decisions form. */
function runForm(page: string, lavish: boolean) {
  const script = /<script>([\s\S]*)<\/script>/.exec(page)?.[1] ?? "";
  const ids = [...page.matchAll(/data-entry="([^"]+)"/g)].map((match) => match[1] ?? "");
  const checked = new Map(
    [...page.matchAll(/name="d-([^"]+)" value="([^"]+)" checked/g)].map((match) => [
      match[1] ?? "",
      match[2] ?? "",
    ]),
  );
  const prompts: { text: string; options: { data: unknown } }[] = [];
  const listeners: Record<string, (event: { preventDefault(): void }) => void> = {};
  const fieldset = { disabled: true };
  const notice = { hidden: false };
  const form = {
    getAttribute: () => "Review decisions",
    addEventListener: (name: string, listener: (event: { preventDefault(): void }) => void) => {
      listeners[name] = listener;
    },
    querySelector: (selector: string) => {
      if (selector === "fieldset") return fieldset;
      const choice = /^input\[name="d-(.+)"\]:checked$/.exec(selector);
      if (choice !== null) {
        const value = checked.get(choice[1] ?? "");
        return value === undefined ? null : { value };
      }
      const reason = /^\[name="r-(.+)"\]$/.exec(selector);
      if (reason !== null) return { value: reason[1] === "L-00000005" ? " not worth it " : "" };
      return null;
    },
    querySelectorAll: (selector: string) =>
      selector === "[data-entry]" ? ids.map((id) => ({ getAttribute: () => id })) : [],
  };
  const window: Record<string, unknown> = { addEventListener: () => undefined };
  if (lavish) {
    window.lavish = {
      queuePrompt: (text: string, options: { data: unknown }) => prompts.push({ text, options }),
    };
  }
  runInNewContext(script, {
    window,
    document: { getElementById: (id: string) => (id === "decide" ? form : notice) },
  });
  listeners.submit?.({ preventDefault: () => undefined });
  return { prompts, fieldset, notice };
}

describe("review report templates", () => {
  const report = changeReport(fixture());

  it("renders the fixture HTML byte for byte", async () => {
    await expect(changeReportHtml(report)).toMatchFileSnapshot("__snapshots__/report.html");
  });

  it("renders the fixture Markdown byte for byte, without a form", async () => {
    const md = changeReportMd(report);
    await expect(md).toMatchFileSnapshot("__snapshots__/report.md");
    expect(md).not.toMatch(/<form|<input/);
    for (const id of ["L-00000002", "L-00000003", "L-00000005"]) expect(md).toContain(id);
  });

  it("shows Failure scenario after Problem and the triage reason next to the level (#158)", () => {
    const base = fixture();
    const entries = base.entries.map((entry) =>
      entry.id === "L-00000002"
        ? {
            ...entry,
            body: "Problem: p<1>\n\nFailure scenario: f<2>\n\nWhy it matters: w\n\nSuggested fix: s\n\nTriaged as should-fix at 2026-10-07T10:00:00Z: the null body reaches parse\n",
          }
        : entry,
    );
    const withFailure = changeReport({ ...base, entries });
    const md = changeReportMd(withFailure);
    expect(md).toContain(
      "  - Problem: p\\<1\\>\n  - Failure scenario: f\\<2\\>\n  - Why it matters: w\n  - Suggested fix: s",
    );
    expect(md).toMatch(/should-fix \(the null body reaches parse\)/);
    const page = changeReportHtml(withFailure);
    expect(page).toContain(
      "<dt>Problem</dt><dd>p&lt;1&gt;</dd><dt>Failure scenario</dt><dd>f&lt;2&gt;</dd><dt>Why it matters</dt>",
    );
    expect(page).toContain("should-fix (the null body reaches parse)");
  });

  it("lists the binary files under Not reviewed as text and puts them on no card (#158)", () => {
    const base = fixture();
    const snapshot = "src/auth/__snapshots__/<b>login</b>.png";
    const withBinary = changeReport({
      ...base,
      files: [...base.files, { path: snapshot, added: 0, removed: 0, binary: true }],
    });
    const md = changeReportMd(withBinary);
    expect(md).toContain(
      "- Files: 5, lines +84 -5\n- Not reviewed as text: `src/auth/__snapshots__/<b>login</b>.png`\n",
    );
    const page = changeReportHtml(withBinary);
    expect(page).toContain(
      "<li>Not reviewed as text: <code>src/auth/__snapshots__/&lt;b&gt;login&lt;/b&gt;.png</code></li>",
    );
    expect(withBinary.cards.flatMap((card) => card.files.map((file) => file.path))).not.toContain(
      snapshot,
    );
    expect(changeReportMd(report)).not.toContain("Not reviewed as text");
  });

  it("shows a tool group declared none as not used, tests as a warning (T49)", () => {
    const base = fixture();
    const notUsed = changeReport({ ...base, gate: { ...base.gate, notUsed: ["lint", "test"] } });
    const md = changeReportMd(notUsed);
    expect(md).toContain("- Tests: not used (tools.test is none): this Change ran no test\n");
    expect(md).toContain("- Lint: not used (tools.lint is none)\n");
    const page = changeReportHtml(notUsed);
    expect(page).toContain(
      '<li class="warn">Tests: not used (tools.test is none): this Change ran no test</li>',
    );
    expect(page).toContain("<li>Lint: not used (tools.lint is none)</li>");
  });

  it("shows no test tool beside a lint verdict (T49)", () => {
    const base = fixture();
    const md = changeReportMd(
      changeReport({ ...base, gate: { ...base.gate, tests: undefined, notUsed: ["test"] } }),
    );
    expect(md).toContain(
      "- Tests: not used (tools.test is none): this Change ran no test\n- Lint: pass\n",
    );
  });

  it("keeps the sections in order", () => {
    const page = changeReportHtml(report);
    const titles = ["Parts and areas", "Intent", "Change map", "Gate", "Decisions", "Settled"];
    const order = [...titles, "Context"].map((title) => page.indexOf(`<h2>${title}</h2>`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toStrictEqual(order);
  });

  it("shows the Intent rows of the spec deltas, untraced ones as warnings (#158)", () => {
    const page = changeReportHtml(report);
    expect(page).toContain(
      '<tr><td><code>auth/login</code></td><td>Magic link</td><td>link sent</td><td>src/auth/login.ts#issue</td><td>src/auth/login.test.ts: sends the link</td><td><span class="verdict pass">ok</span></td></tr>',
    );
    expect(page).toContain(
      '<tr class="warn"><td><code>auth/login</code></td><td>Magic link</td><td>link expired</td><td></td><td></td><td>untraced</td></tr>',
    );
    expect(page).toContain(
      '<td>Password login</td><td>-</td><td>src/auth/login.ts (removed)</td><td>-</td><td><a href="#entry-L-00000002">L-00000002</a> <a href="#entry-L-00000006">L-00000006</a> L-0000000z</td></tr>',
    );
    expect(page).toContain('<li id="entry-L-00000006">');
    expect(page).not.toContain("link resent");
    expect(page).not.toContain("No integration report holds");
    const md = changeReportMd(report);
    expect(md).toContain(
      [
        "## Intent",
        "",
        "| Capability | Requirement | Scenario | Code | Test | State |",
        "|---|---|---|---|---|---|",
        "| `auth/login` | Magic link | link sent | src/auth/login.ts#issue | src/auth/login.test.ts: sends the link | ok |",
        "| `auth/login` | Magic link | link expired |  |  | untraced |",
        "| `auth/login` | Password login | - | src/auth/login.ts (removed) | - | L-00000002, L-00000006, L-0000000z |",
      ].join("\n"),
    );
    expect(md).not.toContain("link resent");
  });

  it("warns once above the rows when no integration report holds an Intent table (#158)", () => {
    const missing = changeReport(fixture({ traced: undefined }));
    const page = changeReportHtml(missing);
    const warning =
      '<p class="warn">No integration-reviewer report holds an <code>## Intent</code> table: every scenario is untraced.</p>';
    expect(page.split(warning)).toHaveLength(2);
    expect(page.indexOf(warning)).toBeGreaterThan(page.indexOf("<h2>Intent</h2>"));
    expect(page.match(/<td>untraced<\/td>/g)).toHaveLength(3);
    expect(changeReportMd(missing)).toContain(
      "## Intent\n\nNo integration-reviewer report holds an `## Intent` table: every scenario is untraced.\n\n| Capability",
    );
  });

  it("has no Intent section without spec deltas (#158)", () => {
    const without = changeReport(fixture({ scenarios: [] }));
    expect(without.trace).toBeUndefined();
    const page = changeReportHtml(without);
    expect(page).not.toContain("<h2>Intent</h2>");
    expect(page.indexOf("<h2>Change map</h2>")).toBeGreaterThan(
      page.indexOf("<h2>Parts and areas</h2>"),
    );
    expect(changeReportMd(without)).not.toContain("## Intent");
  });

  it("escapes the scenario names and the report's Code and Test cells (#158)", () => {
    const base = fixture();
    const hostileTrace = changeReport({
      ...base,
      scenarios: [{ capability: "auth/login", requirement: "R", scenario: SCRIPT }],
      traced: [
        {
          capability: "auth/login",
          requirement: "R",
          scenario: SCRIPT,
          code: `${SCRIPT} | x`,
          test: SCRIPT,
          state: { kind: "ok" },
        },
      ],
    });
    const page = changeReportHtml(hostileTrace);
    expect(page).not.toContain(SCRIPT);
    expect(page).toContain(
      "<td>&lt;script&gt;alert(1)&lt;/script&gt;</td><td>&lt;script&gt;alert(1)&lt;/script&gt; | x</td>",
    );
    const md = changeReportMd(hostileTrace);
    expect(md).toContain("\\<script\\>alert(1)\\</script\\> \\| x");
  });

  it("escapes ledger text, area summaries and paths", () => {
    const page = hostile();
    expect(page).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(page).not.toContain(SCRIPT);
  });

  it("splits a labelled body into three fields", () => {
    const page = changeReportHtml(report);
    expect(page).toContain(
      "<dt>Problem</dt><dd>The token is compared with ==.</dd><dt>Why it matters</dt><dd>A timing attack reveals it.</dd><dt>Suggested fix</dt><dd>Use timingSafeEqual.</dd>",
    );
    expect(page).toContain("<p>Dates are built by hand.</p>");
  });

  it("explains each disposition above Decisions", () => {
    const page = changeReportHtml(report);
    const legend = page.indexOf('<dl class="legend">');
    expect(legend).toBeGreaterThan(page.indexOf("<h2>Decisions</h2>"));
    expect(legend).toBeLessThan(page.indexOf("<h3>should-fix"));
    for (const name of ["fix", "defer", "reject"]) expect(page).toContain(`<dt>${name}</dt>`);
  });

  it("references no external resource", () => {
    const page = changeReportHtml(report);
    expect(page).not.toMatch(/<link|\ssrc=|@import|url\(/);
  });

  it("offers track only while tracker is set", () => {
    const without = changeReportHtml(report);
    expect(without).not.toContain('value="track"');
    expect(without).not.toContain("<dt>track</dt>");
    const withTracker = changeReportHtml(changeReport(fixture({ tracker: "github" })));
    expect(withTracker.match(/value="track"/g)).toHaveLength(3);
    expect(withTracker).toContain("<dt>track</dt>");
  });

  it("preselects the current disposition", () => {
    expect(changeReportHtml(report)).toContain('name="d-L-00000003" value="defer" checked');
  });

  it("sends one prompt with an item per Decisions entry inside Lavish", () => {
    const { prompts, fieldset, notice } = runForm(changeReportHtml(report), true);
    expect(fieldset.disabled).toBe(false);
    expect(notice.hidden).toBe(true);
    expect(prompts).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(prompts[0]?.options.data))).toStrictEqual({
      items: [
        { id: "L-00000002", disposition: null, reason: null },
        { id: "L-00000003", disposition: "defer", reason: null },
        { id: "L-00000005", disposition: null, reason: "not worth it" },
      ],
    });
  });

  it("stays disabled outside Lavish and names /bdk:cr --report", () => {
    const page = changeReportHtml(report);
    expect(page).toContain('<fieldset class="form" disabled>');
    expect(page).toContain("<code>/bdk:cr --report</code>");
    const { prompts, fieldset } = runForm(page, false);
    expect(fieldset.disabled).toBe(true);
    expect(prompts).toStrictEqual([]);
  });
});

describe("pull request page template", () => {
  const page = prPageHtml(
    prPage(
      {
        prs: [
          {
            number: 41,
            url: "https://github.com/acme/app/pull/41",
            title: "Magic link",
            findings: [
              {
                path: "src/a.ts",
                line: 3,
                severity: "high",
                category: "security",
                blocking: true,
                problem: "Token logged",
                why: "Leaks the token",
                fix: "Drop the log line",
              },
              {
                path: "src/b.ts",
                line: 9,
                severity: "low",
                category: "tests",
                blocking: false,
                problem: "Missing case",
                fix: "Add a test",
              },
            ],
          },
        ],
      },
      false,
    ),
  );

  it("preselects from blocking, shows why when given, and the computed verdict", () => {
    expect(page).toContain('name="d-41-1" value="blocker" checked');
    expect(page).toContain('name="d-41-2" value="nice-to-have" checked');
    expect(page).toContain("<dt>Why it matters</dt><dd>Leaks the token</dd>");
    expect(page).toContain('data-pr="41">request-changes</span>');
    expect(page).not.toContain('value="tracker"');
    expect(page).toContain('value="drop"');
  });
});
