// The HTML templates of `bdk review render` (`kernel-cli/review`; T42-H, J):
// the Change report and the pull request decision page. Self-contained: inline
// CSS with light and dark tokens and one inline script that enables the form
// only inside Lavish. No timestamp is rendered, so the same view model gives
// the same bytes.
import type { PrPage } from "../domain/pr.ts";
import { PR_CHOICES } from "../domain/pr.ts";
import type {
  Card,
  ChangeReport,
  DecisionEntry,
  EntryBody,
  GridRow,
  Lines,
} from "../domain/report.ts";
import { html, safeUrl } from "./escape.ts";

const STYLE = `
:root {
  color-scheme: light dark;
  --bg: #f7f7f5; --surface: #ffffff; --fg: #1d1f21; --muted: #5f6368; --border: #d9dbde;
  --accent: #2557c9; --accent-fg: #ffffff; --ok: #1e7b34; --bad: #b3261e; --warn: #8a5a00;
  --heat-1: #eaf1fd; --heat-2: #d6e4fa; --heat-3: #bed3f6; --heat-4: #a3c0f1;
  --tag: #eef0f3; --code: #f0f1f3;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #15171a; --surface: #1d2024; --fg: #e6e7e9; --muted: #9aa0a6; --border: #33373d;
    --accent: #8ab4f8; --accent-fg: #0b1a33; --ok: #7dd38f; --bad: #f28b82; --warn: #f3c46b;
    --heat-1: #1c2533; --heat-2: #213049; --heat-3: #283d60; --heat-4: #2f4b78;
    --tag: #2a2e34; --code: #262a2f;
  }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--bg); color: var(--fg);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 1.5rem; margin: 0 0 4px; overflow-wrap: anywhere; }
h2 { font-size: 1.15rem; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
h3 { font-size: 1rem; margin: 0 0 8px; }
p { margin: 0 0 8px; }
code, .mono { font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
code { background: var(--code); padding: 1px 4px; border-radius: 4px; }
a { color: var(--accent); }
.muted { color: var(--muted); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; margin: 0 0 12px; }
.stats { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 8px 0 0; padding: 0; list-style: none; }
.stats b { font-variant-numeric: tabular-nums; }
.add { color: var(--ok); } .del { color: var(--bad); }
.scroll { overflow-x: auto; }
table.grid { border-collapse: separate; border-spacing: 4px; min-width: 100%; }
.grid th { text-align: left; font-weight: 600; font-size: 13px; padding: 4px 6px; vertical-align: bottom; }
.grid th.row { white-space: nowrap; vertical-align: top; }
.grid td { vertical-align: top; padding: 6px; border-radius: 6px; font-size: 12px; min-width: 120px; }
.grid td.empty { background: transparent; border: 1px dashed var(--border); }
.w1 { background: var(--heat-1); } .w2 { background: var(--heat-2); } .w3 { background: var(--heat-3); } .w4 { background: var(--heat-4); }
.grid ul { margin: 4px 0 0; padding: 0; list-style: none; }
.files { margin: 8px 0 0; padding: 0; list-style: none; }
.files > li { border-top: 1px solid var(--border); padding: 6px 0; }
summary { cursor: pointer; }
.files details > summary { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; }
.files details > summary::-webkit-details-marker { display: none; }
.files details > summary::before { content: "\\25B8"; color: var(--muted); width: 1em; }
.files details[open] > summary::before { content: "\\25BE"; }
.why { margin: 6px 0 0 16px; padding: 0; list-style: none; font-size: 13px; }
.tag { display: inline-block; background: var(--tag); border-radius: 999px; padding: 0 8px; font-size: 12px; text-decoration: none; color: var(--fg); }
.tag.should-fix { box-shadow: inset 0 0 0 1px var(--warn); }
.tag.blocker { box-shadow: inset 0 0 0 1px var(--bad); }
.verdict { font-weight: 600; }
.verdict.pass, .verdict.approve { color: var(--ok); }
.verdict.fail, .verdict.request-changes { color: var(--bad); }
dl.legend { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 0; }
dl.legend dt { font-weight: 600; }
dl.legend dd { margin: 0; }
.entry header { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }
.entry .meta { font-size: 13px; color: var(--muted); margin: 4px 0; }
.entry details { margin: 6px 0; }
.entry details > summary { cursor: pointer; color: var(--muted); font-size: 13px; }
.entry dl { margin: 6px 0 0; }
.entry dt { font-weight: 600; font-size: 13px; }
.entry dd { margin: 0 0 6px; }
.choices { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 6px; border: 0; padding: 0; }
.choices label { border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; cursor: pointer; background: var(--bg); }
.choices input { margin: 0 6px 0 0; }
.choices label:has(input:checked) { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.reason { width: 100%; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--fg); font: inherit; }
fieldset.form { border: 0; margin: 0; padding: 0; min-width: 0; }
fieldset.form:disabled .choices label { cursor: not-allowed; opacity: 0.7; }
.submit { position: sticky; bottom: 0; background: var(--bg); padding: 12px 0; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
button { background: var(--accent); color: var(--accent-fg); border: 0; border-radius: 6px; padding: 8px 16px; font: inherit; font-weight: 600; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.notice { background: var(--surface); border: 1px solid var(--warn); border-radius: 8px; padding: 8px 12px; margin: 0 0 12px; }
`;

const FORM_SCRIPT = `
(function () {
  var form = document.getElementById("decide");
  if (!form) return;
  var fields = form.querySelector("fieldset");
  var notice = document.getElementById("offline");
  function ready() {
    if (!window.lavish) return;
    fields.disabled = false;
    notice.hidden = true;
  }
  ready();
  window.addEventListener("load", ready);
  function choice(id) {
    var checked = form.querySelector('input[name="d-' + id + '"]:checked');
    return checked ? checked.value : null;
  }
  form.addEventListener("change", function () {
    var verdicts = form.querySelectorAll("[data-pr]");
    for (var i = 0; i < verdicts.length; i++) {
      var pr = verdicts[i].getAttribute("data-pr");
      var ids = form.querySelectorAll('[data-entry^="' + pr + '-"]');
      var blocked = false;
      for (var j = 0; j < ids.length; j++) {
        if (choice(ids[j].getAttribute("data-entry")) === "blocker") blocked = true;
      }
      verdicts[i].textContent = blocked ? "request-changes" : "approve";
      verdicts[i].className = "verdict " + (blocked ? "request-changes" : "approve");
    }
  });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!window.lavish) return;
    var entries = form.querySelectorAll("[data-entry]");
    var items = [];
    for (var i = 0; i < entries.length; i++) {
      var id = entries[i].getAttribute("data-entry");
      var item = { id: id, disposition: choice(id) };
      var reason = form.querySelector('[name="r-' + id + '"]');
      if (reason) item.reason = reason.value.trim() || null;
      items.push(item);
    }
    window.lavish.queuePrompt(form.getAttribute("data-prompt"), {
      tag: "decisions",
      text: items.length + " decisions",
      element: form,
      data: { items: items },
    });
  });
})();
`;

const LEGEND: readonly (readonly [string, string])[] = [
  ["fix", "A new review round fixes it before the Change closes."],
  ["defer", "Accept it for now: it stays open in the ledger and the PR summary as deferred."],
  [
    "reject",
    "Not worth fixing: it is resolved with your reason, and the reviewers stop raising it.",
  ],
  ["track", "File it in the tracker: the issue link goes into the ledger and the PR summary."],
];

export function changeReportHtml(report: ChangeReport): string {
  const sections = [
    summarySection(report),
    gridSection(report),
    mapSection(report),
    gateSection(report),
    decisionsSection(report),
    settledSection(report),
    contextSection(report),
  ];
  return page(`Review: ${report.change}`, sections.join("\n"));
}

export function prPageHtml(page_: PrPage): string {
  const choices = PR_CHOICES.filter((choice) => choice !== "tracker" || page_.tracker);
  const prs = page_.prs.map((pr) => {
    const link = safeUrl(pr.url);
    const title = `#${String(pr.number)} ${pr.title}`;
    const findings = pr.findings.map((finding) => {
      const options = choices
        .map(
          (choice) =>
            `<label><input type="radio" name="d-${html(finding.id)}" value="${choice}"${
              choice === finding.choice ? " checked" : ""
            }>${choice}</label>`,
        )
        .join("");
      return `<article class="card entry" data-entry="${html(finding.id)}">
<header><code>${html(finding.id)}</code><b>${html(finding.problem)}</b></header>
<p class="meta"><code>${html(finding.path)}:${String(finding.line)}</code> · ${html(finding.severity)} · ${html(finding.category)}</p>
<dl>${field("Problem", finding.problem)}${finding.why === undefined ? "" : field("Why it matters", finding.why)}${field("Suggested fix", finding.fix)}</dl>
<div class="choices" role="radiogroup" aria-label="Decision for ${html(finding.id)}">${options}</div>
</article>`;
    });
    return `<section>
<h2>${link === undefined ? html(title) : `<a href="${html(link)}">${html(title)}</a>`}</h2>
<p>Verdict: <span class="verdict ${pr.verdict}" data-pr="${String(pr.number)}">${pr.verdict}</span></p>
${findings.length === 0 ? '<p class="muted">No findings.</p>' : findings.join("\n")}
</section>`;
  });
  const body = `<h1>Pull request review</h1>
<p class="muted">Choose what happens to each finding. The verdict follows your choices.</p>
${form("Pull request review decisions", prs.join("\n"))}`;
  return page("Pull request review", body);
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
${body}
</main>
<script>${FORM_SCRIPT}</script>
</body>
</html>
`;
}

function form(prompt: string, inner: string): string {
  return `<form id="decide" data-prompt="${html(prompt)}">
<fieldset class="form" disabled>
${inner}
<div class="submit">
<button type="submit">Send decisions</button>
<span id="offline" class="muted">Open this page in Lavish to send the decisions, or decide in the terminal with <code>/bdk:cr --report</code>.</span>
</div>
</fieldset>
</form>`;
}

function summarySection(report: ChangeReport): string {
  const levels = Object.entries(report.levels)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${level} ${String(count)}`);
  const dispositions = Object.entries(report.dispositions)
    .filter(([, count]) => count > 0)
    .map(([disposition, count]) => `${disposition} ${String(count)}`);
  return `<h1>${html(report.change)}</h1>
<p>${html(report.intent)}</p>
<ul class="stats">
<li>Kind: <b>${html(report.kind)}</b></li>
<li>Range: <code>${html(shortRange(report.range))}</code></li>
<li>Files: <b>${String(report.totals.files)}</b></li>
<li>Lines: ${lines(report.totals)}</li>
<li>Open entries by level: <b>${levels.length === 0 ? "none" : html(levels.join(", "))}</b></li>
<li>By disposition: <b>${dispositions.length === 0 ? "none" : html(dispositions.join(", "))}</b></li>
</ul>`;
}

function gridSection(report: ChangeReport): string {
  if (report.grid.modules.length === 0) {
    return `<h2>Parts and areas</h2>\n<p class="muted">The range changes no file.</p>`;
  }
  const head = report.grid.modules.map((module) => `<th><code>${html(module)}</code></th>`);
  const rows = report.grid.rows.map((row: GridRow) => {
    const cells = row.cells.map((cell) =>
      cell === undefined
        ? '<td class="empty"></td>'
        : `<td class="w${String(cell.weight)}">${lines(cell)}<ul>${cell.files
            .map((file) => `<li class="mono">${html(basename(file))}</li>`)
            .join("")}</ul></td>`,
    );
    return `<tr><th class="row" scope="row">${html(row.label)}</th>${cells.join("")}</tr>`;
  });
  return `<h2>Parts and areas</h2>
<div class="scroll"><table class="grid">
<thead><tr><th></th>${head.join("")}</tr></thead>
<tbody>
${rows.join("\n")}
</tbody>
</table></div>`;
}

function mapSection(report: ChangeReport): string {
  if (report.cards.length === 0) {
    return `<h2>Change map</h2>\n<p class="muted">No configured risk area is touched.</p>`;
  }
  return `<h2>Change map</h2>\n${report.cards.map(card).join("\n")}`;
}

function card(item: Card): string {
  const title = item.id === "unplanned" ? "Outside the plan" : item.id;
  const files = item.files.map((file) => {
    const tags = file.tags
      .map(
        (tag) =>
          `<a class="tag ${html(tag.level ?? "untriaged")}" href="#entry-${html(tag.id)}">${html(
            [tag.id, tag.level ?? "untriaged", tag.disposition].filter(Boolean).join(" · "),
          )}</a>`,
      )
      .join(" ");
    const why = [
      ...file.tasks.map(
        (task) => `<li>Task <code>${html(task.id)}</code> ${html(task.title)}</li>`,
      ),
      ...file.commits.map(
        (commit) => `<li><code>${html(commit.sha.slice(0, 7))}</code> ${html(commit.subject)}</li>`,
      ),
    ];
    return `<li><details><summary><code>${html(file.path)}</code> ${lines(file)} ${tags}</summary>
<ul class="why">${why.length === 0 ? '<li class="muted">No task declares it and no commit of the range names it.</li>' : why.join("")}</ul>
</details></li>`;
  });
  return `<div class="card">
<h3>${html(title)}</h3>
${item.summary === undefined ? "" : `<p>${html(item.summary)}</p>`}
${files.length === 0 ? '<p class="muted">No changed file matches its paths.</p>' : `<ul class="files">${files.join("\n")}</ul>`}
</div>`;
}

function gateSection(report: ChangeReport): string {
  const verdict = (value: string | undefined) =>
    value === undefined
      ? '<span class="muted">not recorded</span>'
      : `<span class="verdict ${html(value)}">${html(value)}</span>`;
  const coverage = report.gate.coverage.map(
    (item) =>
      `<li>Coverage <code>${html(item.tool)}</code>: ${
        item.percent === null ? "n/a" : `${String(item.percent)}%`
      }${item.min === null ? "" : ` (min ${String(item.min)}%)`} ${verdict(item.verdict)}</li>`,
  );
  return `<h2>Gate</h2>
<ul class="stats">
<li>Tests: ${verdict(report.gate.tests)}</li>
<li>Lint: ${verdict(report.gate.lint)}</li>
${coverage.join("\n")}
</ul>`;
}

function decisionsSection(report: ChangeReport): string {
  const legend = LEGEND.filter(([name]) => name !== "track" || report.tracker !== undefined)
    .map(([name, text]) => `<dt>${name}</dt><dd>${html(text)}</dd>`)
    .join("");
  const groups = report.decisions.map(
    (group) =>
      `<h3>${group.group} (${String(group.entries.length)})</h3>\n${
        group.entries.length === 0
          ? '<p class="muted">None.</p>'
          : group.entries.map((entry) => decision(entry, report.tracker !== undefined)).join("\n")
      }`,
  );
  return `<h2>Decisions</h2>
<div class="card"><dl class="legend">${legend}</dl></div>
${form(`Review decisions for ${report.change}`, groups.join("\n"))}`;
}

function decision(entry: DecisionEntry, tracker: boolean): string {
  const choices = LEGEND.map(([name]) => name).filter((name) => name !== "track" || tracker);
  const options = choices
    .map(
      (choice) =>
        `<label><input type="radio" name="d-${html(entry.id)}" value="${choice}"${
          choice === entry.disposition ? " checked" : ""
        }>${choice}</label>`,
    )
    .join("");
  const meta = [
    entry.type,
    entry.severity,
    entry.category,
    `by ${entry.writer}`,
    entry.disposition === undefined ? "undecided" : `decided ${entry.disposition}`,
    entry.review ? "to be reviewed" : undefined,
  ].filter((part): part is string => part !== undefined);
  const issue = entry.issue === undefined ? undefined : safeUrl(entry.issue);
  return `<article class="card entry" id="entry-${html(entry.id)}" data-entry="${html(entry.id)}">
<header><code>${html(entry.id)}</code><b>${html(entry.summary)}</b></header>
<p class="meta">${html(meta.join(" · "))}${
    entry.issue === undefined
      ? ""
      : ` · issue ${issue === undefined ? html(entry.issue) : `<a href="${html(issue)}">${html(entry.issue)}</a>`}`
  }</p>
<p class="meta">Refs: ${entry.refs.map((ref) => `<code>${html(ref)}</code>`).join(" ")}</p>
<details><summary>Details</summary>${body(entry.body)}${
    entry.history.length === 0
      ? ""
      : `<ul class="why">${entry.history.map((line) => `<li class="muted">${html(line)}</li>`).join("")}</ul>`
  }</details>
<div class="choices" role="radiogroup" aria-label="Decision for ${html(entry.id)}">${options}</div>
<input class="reason" type="text" name="r-${html(entry.id)}" placeholder="Reason (required for reject)" aria-label="Reason for ${html(entry.id)}">
</article>`;
}

function body(value: EntryBody): string {
  if (value.kind === "labelled") {
    return `<dl>${field("Problem", value.problem)}${field("Why it matters", value.why)}${field(
      "Suggested fix",
      value.fix,
    )}</dl>`;
  }
  return value.text === ""
    ? '<p class="muted">No details.</p>'
    : `<p>${html(value.text).replace(/\n/g, "<br>")}</p>`;
}

function field(label: string, text: string): string {
  return `<dt>${label}</dt><dd>${html(text).replace(/\n/g, "<br>")}</dd>`;
}

function settledSection(report: ChangeReport): string {
  if (report.settled.length === 0) return `<h2>Settled</h2>\n<p class="muted">None.</p>`;
  const items = report.settled.map(
    (entry) =>
      `<li><code>${html(entry.id)}</code> ${html(entry.summary)}${
        entry.reason === undefined ? "" : ` <span class="muted">(${html(entry.reason)})</span>`
      }</li>`,
  );
  return `<h2>Settled</h2>
<details class="card"><summary>${String(report.settled.length)} resolved</summary><ul class="files">${items.join("")}</ul></details>`;
}

function contextSection(report: ChangeReport): string {
  if (report.context.length === 0) return `<h2>Context</h2>\n<p class="muted">None.</p>`;
  const items = report.context.map(
    (entry) =>
      `<li><code>${html(entry.id)}</code> ${html(entry.type)}: ${html(entry.summary)}</li>`,
  );
  return `<h2>Context</h2>\n<div class="card"><ul class="files">${items.join("")}</ul></div>`;
}

function lines(value: Lines): string {
  return `<span class="add">+${String(value.added)}</span> <span class="del">-${String(value.removed)}</span>`;
}

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

/** `<base>..<head>` with each sha cut to 12 characters. */
export function shortRange(range: string): string {
  return range
    .split("..")
    .map((sha) => sha.slice(0, 12))
    .join("..");
}
