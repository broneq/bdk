// One valid frontmatter per document kind, taken from the Change reviewed at
// the kernel-state gate. Tests copy one and break a single field.
const HASH = `sha256:${"a".repeat(64)}`;
const AUTHOR = "Jan Kowalski <jan@example.com>";

export const change = {
  schema: 1,
  id: "2026-09-25-passwordless-login",
  kind: "feature",
  profile: "small",
  intent: "Users log in with a one-time link sent by email instead of a password.",
  source: "user",
  at: "2026-09-25T09:12:03Z",
  author: AUTHOR,
  overridden: ["policy.escalation.enabled"],
};

export const decision = {
  schema: 1,
  id: "L-m2x9v7qa",
  type: "decision",
  summary: "Magic links expire after 15 minutes and are single use",
  status: "accepted",
  source: "kernel",
  author: AUTHOR,
  at: "2026-09-25T09:41:07Z",
  refs: ["design.md", "src/auth/magic-link.ts#issueLink"],
};

export const finding = {
  ...decision,
  id: "L-0p4dk7ws",
  type: "finding",
  summary: "verifyLink accepts an expired token when the clock skew exceeds 60 s",
  status: "proposed",
  source: "agent:reviewer",
  ticket: "A-7f3kx2p9",
  severity: "high",
};

export const learning = {
  ...decision,
  id: "L-q81c0zt4",
  type: "learning",
  summary: "Scoped test runs must include the negative case",
  status: "proposed",
  source: "agent:reviewer",
  ticket: "A-7f3kx2p9",
  fingerprint: `sha256:${"4".repeat(64)}`,
  evidence: ["A-7f3kx2p9", "L-0p4dk7ws"],
  applies: ["**/*.test.ts"],
};

export const transition = {
  ...decision,
  id: "L-h6s1d3ne",
  type: "transition",
  summary: "Design gate passed by /bdk:plan",
  source: "user",
  refs: ["gate:design", "design.md"],
  to: "plan",
  gate: "gate:design",
  session: "0c1d6f0e-2b7a-4c55-9d1e-7a3f0b2c9e41",
  command: "/bdk:plan",
};

export const attempt = {
  schema: 1,
  ticket: "A-7f3kx2p9",
  loop: "task-redispatch",
  target: "02-3",
  attempt: 1,
  of: 3,
  scope: "full",
  "opened-at": "2026-09-25T11:02:40Z",
  author: AUTHOR,
  "closed-at": "2026-09-25T11:51:09Z",
  outcome: "fail",
  findings: [
    { fingerprint: HASH, type: "finding", file: "src/auth/magic-link.ts", symbol: "verifyLink" },
  ],
};

export const evidence = {
  schema: 1,
  id: "E-5hq0m2vd",
  kind: "tests-scoped",
  ticket: "A-7f3kx2p9",
  target: "02-3",
  at: "2026-09-25T11:30:44Z",
  author: AUTHOR,
  source: "agent:implementer",
  "tree-hash": HASH,
  files: [
    {
      path: ".bdk/changes/2026-09-25-passwordless-login/evidence/02-3-E-5hq0m2vd.junit.xml",
      hash: HASH,
      stored: "committed",
    },
  ],
  verdict: "pass",
  citations: ["/testsuites/@tests"],
};

export const dispatch = {
  schema: 1,
  ticket: "A-7f3kx2p9",
  target: "02-3",
  role: "implementer",
  attempt: 1,
  of: 3,
  scope: "full",
  at: "2026-09-25T11:02:41Z",
  "kernel-version": "3.0.0-dev",
  "template-hash": HASH,
  report: ".bdk/changes/2026-09-25-passwordless-login/reports/02-3-implementer-A-7f3kx2p9.md",
};

export const report = {
  schema: 1,
  ticket: "A-7f3kx2p9",
  role: "implementer",
  status: "done",
  files: ["src/auth/magic-link.ts", "src/auth/magic-link.test.ts"],
  entries: [],
  evidence: ["E-5hq0m2vd"],
};

export const planPart = {
  schema: 1,
  id: "02",
  title: "Login with a magic link",
  goal: "A registered user can log in with a link from email.",
  "success-measure": "The login E2E test passes with a link and fails with a reused one.",
  "do-not-touch": ["src/billing/**"],
  "depends-on": ["01"],
  "spec-impact": ["auth-login"],
};

export const design = { schema: 1, title: "Passwordless login" };

export const designPart = { schema: 1, id: "01", title: "Auth service", "depends-on": [] };

export const rule = {
  schema: 1,
  id: "TQ-7",
  kind: "house",
  applies: ["**/*.test.ts"],
  roles: ["implementer", "reviewer"],
  severity: "medium",
  origin: "2026-09-25-passwordless-login/L-q81c0zt4",
  since: "2026-09-26",
};
