// The fixed input of the review report tests (`report.test.ts`,
// `report-render.test.ts`).
import { moduleOf } from "../../measure/index.ts";
import { matchesGlob } from "../../shared/store/index.ts";
import type { ReportEntry, ReportInput } from "../domain/report.ts";

const LABELLED =
  "Problem: The token is compared with ==.\n\nWhy it matters: A timing attack reveals it.\n\nSuggested fix: Use timingSafeEqual.";

function entry(fields: Partial<ReportEntry> & { id: string; type: string }): ReportEntry {
  return {
    summary: `${fields.type} ${fields.id}`,
    status: "proposed",
    source: "agent:reviewer",
    refs: ["change.md"],
    body: "",
    ...fields,
  };
}

export function fixture(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    change: "2026-09-25-passwordless-login",
    intent: "Users log in with a one-time link.",
    kind: "feature",
    range: `${"a".repeat(40)}..${"b".repeat(40)}`,
    files: [
      { path: "README.md", added: 2, removed: 0 },
      { path: "src/auth/login.test.ts", added: 40, removed: 0 },
      { path: "src/auth/login.ts", added: 30, removed: 4 },
      { path: "src/mail/send.ts", added: 12, removed: 1 },
    ],
    parts: [
      {
        id: "01",
        title: "Magic link",
        tasks: [
          {
            id: "01-1",
            title: "Issue the link",
            files: ["src/auth/login.ts", "src/auth/login.test.ts"],
          },
        ],
      },
      {
        id: "02",
        title: "Mail",
        tasks: [{ id: "02-1", title: "Send the link", files: ["src/mail/send.ts"] }],
      },
    ],
    commits: new Map([
      [
        "src/auth/login.ts",
        [
          { sha: "1".repeat(40), subject: "feat: issue the link" },
          { sha: "2".repeat(40), subject: "fix: hash the token" },
        ],
      ],
    ]),
    risks: [
      { id: "auth", paths: ["**/*auth*/**"] },
      { id: "secrets", paths: ["**/.env*"] },
      { id: "public-api", paths: ["**/api/**"] },
    ],
    areas: new Map([
      ["auth", "Login gains a magic link path; password login is unchanged."],
      ["public-api", "The login endpoint accepts a link token."],
      ["unplanned", "The README documents the new flow."],
    ]),
    scenarios: [
      { capability: "auth/login", requirement: "Magic link", scenario: "link sent" },
      { capability: "auth/login", requirement: "Magic link", scenario: "link expired" },
      { capability: "auth/login", requirement: "Password login", scenario: "-" },
    ],
    traced: [
      {
        capability: "auth/login",
        requirement: "Magic link",
        scenario: "link sent",
        code: "src/auth/login.ts#issue",
        test: "src/auth/login.test.ts: sends the link",
        state: { kind: "ok" },
      },
      {
        capability: "auth/login",
        requirement: "Password login",
        scenario: "-",
        code: "src/auth/login.ts (removed)",
        test: "-",
        state: { kind: "entries", ids: ["L-00000002", "L-00000006", "L-0000000z"] },
      },
      {
        capability: "auth/login",
        requirement: "Magic link",
        scenario: "link resent",
        code: "src/auth/login.ts#resend",
        test: "-",
        state: { kind: "ok" },
      },
    ],
    entries: [
      entry({ id: "L-00000001", type: "decision", status: "accepted", summary: "Links expire" }),
      entry({
        id: "L-00000002",
        type: "finding",
        level: "should-fix",
        refs: ["src/auth/login.ts#verify"],
        severity: "high",
        category: "security",
        body: `${LABELLED}\n\nTriaged as should-fix at 2026-09-25T10:00:00Z: real`,
      }),
      entry({
        id: "L-00000003",
        type: "observation",
        level: "nice-to-have",
        disposition: "defer",
        status: "accepted",
        refs: ["auth"],
        body: "Dates are built by hand.",
      }),
      entry({ id: "L-00000004", type: "blocker", level: "blocker", refs: ["src/mail/send.ts"] }),
      entry({ id: "L-00000005", type: "finding", refs: ["README.md"] }),
      entry({
        id: "L-00000006",
        type: "finding",
        status: "resolved",
        body: "Old.\n\nResolved as resolved at 2026-09-25T11:00:00Z: fixed in 01-1",
      }),
      entry({ id: "L-00000007", type: "assumption", summary: "Mail arrives in a minute" }),
      entry({ id: "L-00000008", type: "risk", status: "resolved", summary: "Gone risk" }),
    ],
    gate: {
      tests: "pass",
      lint: "pass",
      coverage: [{ tool: "unit", min: 80, percent: 91.5, verdict: "pass" }],
      notUsed: [],
    },
    tracker: undefined,
    moduleOf,
    matches: matchesGlob,
    ...overrides,
  };
}
