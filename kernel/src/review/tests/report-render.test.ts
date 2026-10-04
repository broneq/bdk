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

  it("keeps the sections in order", () => {
    const page = changeReportHtml(report);
    const order = ["Parts and areas", "Change map", "Gate", "Decisions", "Settled", "Context"].map(
      (title) => page.indexOf(`<h2>${title}</h2>`),
    );
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toStrictEqual(order);
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
