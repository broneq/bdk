// `kernel-cli/log` (T20 records) through the committed bundle in real
// repositories: one case per exit code and per declared rule of `log add`,
// `list`, `show` and `resolve`, every output validated against its schema,
// and the T20 acceptance cases on the ledger; `log add --category` (P8) and
// `log ingest` (T23) with a hand-written attempt record and dispatch package.
import { readdirSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answered,
  bdk,
  bdkAsync,
  outsideRepository,
  read,
  refused,
  repository,
} from "../../../tests/support/repo.ts";
import { fileStore, writeDocument } from "../../shared/store/index.ts";

/** A repository with an open Change; answers the root and the Change directory. */
function opened(): { root: string; dir: string } {
  const root = repository();
  const result = bdk(["change", "new", "Users log in with a one-time link", "--json"], root);
  expect(result.code, result.stdout).toBe(0);
  const id = (result.json as { change: string }).change;
  return { root, dir: join(root, ".bdk/changes", id) };
}

/** Distinct words: digits normalise to one `#` in the dedupe key, so numbered summaries collide. */
function word(n: number): string {
  return String.fromCharCode(97 + n).repeat(3);
}

/** Backdates `dir` and its files past the index's 2 s racy-time guard. */
function settle(dir: string): void {
  const past = new Date(Date.now() - 60_000);
  for (const name of readdirSync(dir)) utimesSync(join(dir, name), past, past);
  utimesSync(dir, past, past);
}

function logFiles(dir: string): string[] {
  return readdirSync(join(dir, "log"));
}

function add(root: string, ...args: string[]): { entry: { id: string } } {
  return answered(bdk(["log", "add", ...args, "--json"], root), "output/log-add.json") as {
    entry: { id: string };
  };
}

describe("bdk log add", () => {
  it("exit 0: appends a stamped entry file", () => {
    const { root, dir } = opened();
    const result = answered(
      bdk(
        [
          "log",
          "add",
          "finding",
          "expired link accepted",
          "--ref",
          "src/a.ts",
          "--ref",
          "02-3",
          "--json",
        ],
        root,
      ),
      "output/log-add.json",
    ) as {
      entry: { id: string; source: string; author: string };
      path: string;
    };
    expect(result.entry).toMatchObject({ source: "kernel", author: "BDK Test <test@example.com>" });
    expect(logFiles(dir)).toContain(result.path.split("/").at(-1));
  });

  it("exit 0: --body - reads the body from stdin", () => {
    const { root, dir } = opened();
    const result = bdk(
      ["log", "add", "decision", "Keep magic links", "--ref", "design.md", "--body", "-", "--json"],
      root,
      {
        stdin: "Chosen for the MVP.\n",
      },
    );
    const path = (result.json as { path: string }).path;
    expect(read(dir, `log/${path.split("/").at(-1) ?? ""}`)).toContain("Chosen for the MVP.");
  });

  it("acceptance: --source user is exit 3 input/forbidden-field and writes no file", () => {
    const { root, dir } = opened();
    const before = logFiles(dir);
    refused(
      bdk(
        ["log", "add", "decision", "Mine", "--ref", "design.md", "--source", "user", "--json"],
        root,
      ),
      3,
      "input/forbidden-field",
    );
    expect(logFiles(dir)).toEqual(before);
  });

  it("exit 3 input/not-found: --supersedes names no entry", () => {
    const { root } = opened();
    refused(
      bdk(
        [
          "log",
          "add",
          "decision",
          "New",
          "--ref",
          "design.md",
          "--supersedes",
          "L-zzzzzzzz",
          "--json",
        ],
        root,
      ),
      3,
      "input/not-found",
    );
  });

  it("exit 2 policy/no-open-ticket: --ticket without an open attempt", () => {
    const { root } = opened();
    refused(
      bdk(
        ["log", "add", "finding", "x", "--ref", "a.ts", "--ticket", "A-00000000", "--json"],
        root,
      ),
      2,
      "policy/no-open-ticket",
    );
  });

  it("exit 2 policy/no-active-change", () => {
    refused(
      bdk(["log", "add", "finding", "x", "--ref", "a.ts", "--json"], repository()),
      2,
      "policy/no-active-change",
    );
  });

  it("exit 4 state/ledger-invalid: a log file fails its schema", () => {
    const { root, dir } = opened();
    fileStore().write(
      join(dir, "log/20260101T000000Z-finding-L-broken00.md"),
      "---\nschema: 1\n---\n",
    );
    refused(
      bdk(["log", "add", "finding", "x", "--ref", "a.ts", "--json"], root),
      4,
      "state/ledger-invalid",
    );
  });

  it("exit 5 runtime/git-missing: the author needs git", () => {
    const { root } = opened();
    refused(
      bdk(["log", "add", "finding", "x", "--ref", "a.ts", "--json"], root, { git: false }),
      5,
      "runtime/git-missing",
    );
  });

  it("acceptance: 15 parallel adds get 15 distinct ids without a lock", async () => {
    const { root, dir } = opened();
    const before = logFiles(dir).length;
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, n) =>
        bdkAsync(
          ["log", "add", "observation", `parallel ${word(n)}`, "--ref", "a.ts", "--json"],
          root,
        ),
      ),
    );
    for (const result of results) expect(result.code, result.stdout + result.stderr).toBe(0);
    const ids = results.map((result) => (result.json as { entry: { id: string } }).entry.id);
    expect(new Set(ids).size).toBe(15);
    expect(logFiles(dir)).toHaveLength(before + 15);
    expect(readdirSync(join(dir, "log")).some((name) => name.endsWith(".lock"))).toBe(false);
  });
});

describe("bdk log list", () => {
  it("exit 0: entries with derived status, filtered by type", () => {
    const { root } = opened();
    add(root, "finding", "one", "--ref", "src/a.ts");
    const page = answered(
      bdk(["log", "list", "--type", "finding", "--json"], root),
      "output/log-list.json",
    ) as { items: { type: string; status: string }[] };
    expect(page.items).toEqual([expect.objectContaining({ type: "finding", status: "proposed" })]);
  });

  it("acceptance: under 200 ms at 1 000 entries on the second run, with its telemetry line", () => {
    const { root, dir } = opened();
    const store = fileStore();
    for (let n = 0; n < 1000; n++) {
      const id = `L-${n.toString(36).padStart(8, "0")}`;
      writeDocument(store, join(dir, `log/20260925T100000Z-observation-${id}.md`), {
        data: {
          schema: 1,
          id,
          type: "observation",
          summary: `observation ${n.toString(36).replace(/\d/g, (digit) => word(Number(digit)))}`,
          status: "proposed",
          source: "kernel",
          author: "BDK Test <test@example.com>",
          at: "2026-09-25T10:00:00Z",
          refs: ["src/a.ts"],
        },
        body: "",
      });
    }
    settle(join(dir, "log"));
    settle(dir);
    expect(bdk(["log", "list", "--all", "--json"], root).code).toBe(0);
    const second = bdk(["log", "list", "--all", "--json"], root);
    expect(second.code).toBe(0);
    expect((second.json as { total: number }).total).toBe(1001);

    const lines = read(root, ".bdk/.machine/telemetry/log-list.jsonl").trim().split("\n");
    expect(lines).toHaveLength(2);
    const last = JSON.parse(lines[1] ?? "") as { ms: number; entries: number; refreshed: boolean };
    expect(last).toMatchObject({ entries: 1001, refreshed: false });
    expect(last.ms).toBeLessThan(200);
  });

  it("acceptance: the index deleted and rebuilt gives identical output", () => {
    const { root } = opened();
    add(root, "finding", "one", "--ref", "src/a.ts");
    add(root, "risk", "two", "--ref", "design.md");
    const before = bdk(["log", "list", "--json"], root).stdout;
    for (const suffix of ["", "-wal", "-shm"]) {
      rmSync(join(root, `.bdk/.machine/index.sqlite${suffix}`), { force: true });
    }
    expect(bdk(["log", "list", "--json"], root).stdout).toBe(before);
  });

  it("exit 2 policy/no-active-change", () => {
    refused(bdk(["log", "list", "--json"], repository()), 2, "policy/no-active-change");
  });

  it("exit 3 input/invalid-argument: an unknown --type", () => {
    const { root } = opened();
    refused(bdk(["log", "list", "--type", "note", "--json"], root), 3, "input/invalid-argument");
  });

  it("exit 4 state/change-dir-missing", () => {
    const { root, dir } = opened();
    rmSync(dir, { recursive: true });
    refused(bdk(["log", "list", "--json"], root), 4, "state/change-dir-missing");
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(bdk(["log", "list", "--json"], outsideRepository()), 5, "runtime/not-a-repo");
  });
});

describe("bdk log show and resolve", () => {
  it("exit 0: shows an entry with its body", () => {
    const { root } = opened();
    const { entry } = add(
      root,
      "decision",
      "Keep magic links",
      "--ref",
      "design.md",
      "--body",
      "Why.",
    );
    const shown = answered(bdk(["log", "show", entry.id, "--json"], root), "output/log-show.json");
    expect(shown).toMatchObject({ entry: { id: entry.id, body: "Why." } });
  });

  it("show exit 3 input/not-found", () => {
    const { root } = opened();
    refused(bdk(["log", "show", "L-zzzzzzzz", "--json"], root), 3, "input/not-found");
  });

  it("show exit 3 input/invalid-argument: a malformed id", () => {
    const { root } = opened();
    refused(bdk(["log", "show", "nope", "--json"], root), 3, "input/invalid-argument");
  });

  it("exit 0: resolve supersedes with --by, then refuses a second move", () => {
    const { root } = opened();
    const old = add(root, "decision", "Magic links", "--ref", "design.md").entry.id;
    const next = add(root, "decision", "WebAuthn", "--ref", "design.md").entry.id;
    answered(
      bdk(
        ["log", "resolve", old, "superseded", "--by", next, "--reason", "WebAuthn wins", "--json"],
        root,
      ),
      "output/log-resolve.json",
    );
    expect(bdk(["log", "show", old, "--json"], root).json).toMatchObject({ supersededBy: next });
    refused(
      bdk(["log", "resolve", old, "accepted", "--json"], root),
      2,
      "policy/invalid-transition",
    );
  });

  it("resolve exit 3 input/not-found", () => {
    const { root } = opened();
    refused(
      bdk(["log", "resolve", "L-zzzzzzzz", "resolved", "--json"], root),
      3,
      "input/not-found",
    );
  });

  it("resolve exit 4 state/corrupted-index", () => {
    const { root } = opened();
    const index = join(root, ".bdk/.machine/index.sqlite");
    rmSync(index, { force: true });
    fileStore().write(join(index, "x"), "");
    refused(
      bdk(["log", "resolve", "L-zzzzzzzz", "resolved", "--json"], root),
      4,
      "state/corrupted-index",
    );
  });

  it("resolve exit 5 runtime/not-a-repo", () => {
    refused(
      bdk(["log", "resolve", "L-zzzzzzzz", "resolved", "--json"], outsideRepository()),
      5,
      "runtime/not-a-repo",
    );
  });
});

const TICKET = "A-9c2d4f6h";

/** An open ticket of `role` with its dispatch package; answers the package's report path. */
function ticketed(dir: string, closed = false, role = "verifier"): string {
  const id = dir.split("/").at(-1) ?? "";
  const report = `.bdk/changes/${id}/reports/02-${role}-${TICKET}.md`;
  writeDocument(fileStore(), join(dir, `attempts/verifier-02-${TICKET}.md`), {
    data: {
      schema: 1,
      ticket: TICKET,
      loop: "verifier",
      target: "02",
      attempt: 1,
      of: 2,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00Z",
      author: "BDK Test <test@example.com>",
      ...(closed ? { "closed-at": "2026-09-25T10:30:00Z", outcome: "ok" } : {}),
    },
    body: "",
  });
  writeDocument(fileStore(), join(dir, `dispatch/02-${role}-${TICKET}.md`), {
    data: {
      schema: 1,
      ticket: TICKET,
      target: "02",
      role,
      adapter: role === "implementer" ? "worker" : "reader",
      attempt: 1,
      of: 2,
      scope: "full",
      at: "2026-09-25T10:00:01Z",
      "kernel-version": "3.0.0",
      "template-hash": `sha256:${"0".repeat(64)}`,
      report,
    },
    body: "",
  });
  return report;
}

describe("bdk log add --category (P8)", () => {
  const blocker = (root: string, ...extra: string[]) =>
    answered(
      bdk(
        [
          "log",
          "add",
          "blocker",
          "naming is inconsistent",
          "--ref",
          "02",
          "--ticket",
          TICKET,
          ...extra,
          "--json",
        ],
        root,
      ),
      "output/log-add.json",
    ) as { entry: { id: string; type: string; review: boolean }; downgraded?: unknown };

  it("exit 0: a verifier blocker without a category is an observation for review", () => {
    const { root, dir } = opened();
    ticketed(dir);
    const result = blocker(root);
    expect(result.entry).toMatchObject({ type: "observation", review: true });
    expect(result.downgraded).toStrictEqual({ type: "blocker", category: null });
    const shown = bdk(["log", "show", result.entry.id, "--json"], root);
    expect((shown.json as { entry: { body: string } }).entry.body).toMatch(
      /^Downgraded from blocker: category none is not a blocking category \(P8\)\./,
    );
  });

  it("exit 0: a verifier blocker in a blocking category stays a blocker", () => {
    const { root, dir } = opened();
    ticketed(dir);
    const result = blocker(root, "--category", "false-code-claim");
    expect(result.entry.type).toBe("blocker");
    expect(result.downgraded).toBeUndefined();
  });

  it("exit 0: an implementer blocker is never downgraded", () => {
    const { root, dir } = opened();
    ticketed(dir, false, "implementer");
    expect(blocker(root).entry.type).toBe("blocker");
  });
});

const REPORT =
  "# Plan verification\n\nPart 02 leans on a helper that does not exist.\n\n" +
  "```bdk-entries\n" +
  "- type: blocker\n" +
  "  summary: plan claims verifyToken exists; it does not\n" +
  "  refs: [plan/parts/02-login.md, src/auth/token.ts]\n" +
  "- type: finding\n" +
  "  summary: part 02 has no test for expiry\n" +
  "  refs: [plan/parts/02-login.md]\n" +
  "  severity: high\n" +
  "```\n";

function ingest(root: string, stdin: string, ...args: string[]) {
  return bdk(["log", "ingest", "--ticket", TICKET, ...args, "--json"], root, { stdin });
}

describe("bdk log ingest", () => {
  it("exit 0: a report on stdin is stored and its entries carry the role", () => {
    const { root, dir } = opened();
    const report = ticketed(dir);
    const result = answered(ingest(root, REPORT), "output/log-ingest.json") as {
      entries: { source: string; ticket: string; type: string }[];
      downgraded: unknown[];
    };
    expect(result.entries.map((entry) => [entry.type, entry.source, entry.ticket])).toEqual([
      ["blocker", "agent:plan-verifier", TICKET],
      ["finding", "agent:plan-verifier", TICKET],
    ]);
    expect(result.downgraded).toEqual([]);
    expect(read(root, report)).toBe(REPORT);
    expect(logFiles(dir)).toHaveLength(3);
  });

  it("exit 0: --file reads the report without copying it; a second ingest deduplicates", () => {
    const { root, dir } = opened();
    const report = ticketed(dir);
    fileStore().write(join(root, "notes.md"), REPORT);
    const first = answered(ingest(root, "", "--file", "notes.md"), "output/log-ingest.json");
    const again = answered(ingest(root, "", "--file", "notes.md"), "output/log-ingest.json");
    expect(again.entries).toEqual(first.entries);
    expect(() => read(root, report)).toThrow();
    expect(logFiles(dir)).toHaveLength(3);
  });

  it("exit 3 input/invalid-block: a wrong type names item, field and line; nothing written", () => {
    const { root, dir } = opened();
    ticketed(dir);
    const before = logFiles(dir);
    const result = refused(
      ingest(root, REPORT.replace("- type: finding", "- type: bug")),
      3,
      "input/invalid-block",
    );
    expect(result.why).toMatch(/^item 2, line 9: type "bug" /);
    expect(logFiles(dir)).toEqual(before);
  });

  it("exit 3 input/forbidden-field: an item carries source", () => {
    const { root, dir } = opened();
    ticketed(dir);
    const result = refused(
      ingest(root, REPORT.replace("  severity: high", "  source: user")),
      3,
      "input/forbidden-field",
    );
    expect(result.why).toBe("item 2, line 12: source is stamped by the kernel");
  });

  it("exit 3 input/missing-argument: no --ticket", () => {
    const { root } = opened();
    refused(bdk(["log", "ingest", "--json"], root, { stdin: REPORT }), 3, "input/missing-argument");
  });

  it("exit 2 policy/no-open-ticket: the ticket is closed", () => {
    const { root, dir } = opened();
    ticketed(dir, true);
    refused(ingest(root, REPORT), 2, "policy/no-open-ticket");
  });

  it("exit 2 policy/no-active-change", () => {
    refused(ingest(repository(), REPORT), 2, "policy/no-active-change");
  });

  it("exit 4 state/ledger-invalid", () => {
    const { root, dir } = opened();
    ticketed(dir);
    fileStore().write(
      join(dir, "log/20260101T000000Z-finding-L-broken00.md"),
      "---\nschema: 1\n---\n",
    );
    refused(ingest(root, REPORT), 4, "state/ledger-invalid");
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(ingest(outsideRepository(), REPORT), 5, "runtime/not-a-repo");
  });
});
