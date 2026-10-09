import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openspecWarning, runPath } from "../evals/run.ts";

// Free checks of the eval suite (spec skill-evals, design D6 of v3-189-eval-setup). Paid runs
// never happen here: the loader check runs `claude plugin eval` at a cost ceiling of zero, which
// loads every case and starts no run.

const PLUGIN = join(import.meta.dirname, "..");
const REPO = join(PLUGIN, "..", "..");
const EVALS = join(PLUGIN, "evals");
const CLAUDE = join(REPO, "node_modules", ".bin", "claude");
const NOT_CASES = new Set(["fixtures", "results"]);
// The grants the eval README recommends; a grader that cannot pass with them is a broken case.
const GRANTS = ["Write", "Edit"];
const SCAFFOLD_LIMIT_MS = 120_000;

let scratch: string;

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "bdk-evals-"));
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function fresh(name: string): string {
  const dir = mkdtempSync(join(scratch, `${name}-`));
  mkdirSync(join(dir, "home"));
  return dir;
}

/** The case directories of a suite. */
function cases(evals: string): string[] {
  return readdirSync(evals, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NOT_CASES.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/** Loads a plugin's suite with the pinned loader, at zero cost and with no credentials. */
function load(plugin: string): { status: number | null; stderr: string; result: unknown } {
  const dir = fresh("load");
  const { status, stderr } = spawnSync(
    CLAUDE,
    [
      "plugin",
      "eval",
      plugin,
      "--trust-plugin",
      "--scaffold",
      "--max-cost-usd",
      "0",
      "--no-publish",
      "--output-dir",
      join(dir, "out"),
      "--report",
      join(dir, "report.html"),
      "--json",
      join(dir, "result.json"),
      "--allow-tools",
      ...GRANTS,
    ],
    {
      cwd: dir,
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: join(dir, "home") },
      timeout: 60_000,
    },
  );
  const json = join(dir, "result.json");
  const result: unknown = existsSync(json) ? JSON.parse(readFileSync(json, "utf8")) : null;
  return { status, stderr, result };
}

/** Lines of the loader's stderr that report a broken case. */
function problems(stderr: string): string[] {
  return stderr
    .split("\n")
    .filter(
      (line) =>
        line.startsWith("✗") || line.includes("failed to load") || line.includes("cannot pass"),
    );
}

/** Runs a script the way the harness runs a scaffold_script: empty directory, minimal env. */
function scaffold(script: string): { status: number | null; stderr: string; dir: string } {
  const root = fresh("scaffold");
  const dir = join(root, "workspace");
  mkdirSync(dir);
  const { status, stderr } = spawnSync("bash", [script], {
    cwd: dir,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: join(root, "home"), TMPDIR: root, TERM: "dumb" },
    timeout: SCAFFOLD_LIMIT_MS,
  });
  return { status, stderr, dir };
}

function frontmatter(file: string): string {
  return /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, "utf8"))?.[1] ?? "";
}

function tags(caseDir: string): string[] {
  const list = /^tags:\s*\[(.*)\]\s*$/m.exec(frontmatter(join(caseDir, "prompt.md")))?.[1] ?? "";
  return list
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
}

function graderTypes(caseDir: string): string[] {
  const dir = join(caseDir, "graders");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => /^type:\s*(\S+)/m.exec(frontmatter(join(dir, file)))?.[1] ?? "");
}

function scaffoldScript(caseDir: string): string | undefined {
  const yaml = join(caseDir, "case.yaml");
  if (!existsSync(yaml)) return undefined;
  const name = /^\s+scaffold_script:\s*(\S+)\s*$/m.exec(readFileSync(yaml, "utf8"))?.[1];
  return name === undefined ? undefined : join(caseDir, name);
}

describe("eval suite loader check", () => {
  it("loads every case of plugins/bdk with no problem, no run and no cost", () => {
    const { status, stderr, result } = load(PLUGIN);
    expect(problems(stderr)).toEqual([]);
    // Exit 2 with partialReason cost_ceiling: the suite loaded and the zero ceiling stopped
    // every run before it started.
    expect(status).toBe(2);
    expect(result).toMatchObject({ partial: true, partialReason: "cost_ceiling", costUsd: 0 });
  });

  it("detects a broken case, so a loader upgrade cannot make the check pass silently", () => {
    const plugin = join(fresh("planted"), "plugin");
    cpSync(join(PLUGIN, ".claude-plugin"), join(plugin, ".claude-plugin"), { recursive: true });
    cpSync(EVALS, join(plugin, "evals"), {
      recursive: true,
      filter: (src) => !src.startsWith(join(EVALS, "results")),
    });
    const unknownKey = join(plugin, "evals", "planted-unknown-key");
    mkdirSync(join(unknownKey, "graders"), { recursive: true });
    writeFileSync(join(unknownKey, "prompt.md"), "---\nbogus: 1\n---\n\nHello.\n");
    writeFileSync(join(unknownKey, "graders", "any.md"), "---\ntype: llm\n---\n\nPASS always.\n");
    const ungranted = join(plugin, "evals", "planted-ungranted");
    mkdirSync(join(ungranted, "graders"), { recursive: true });
    writeFileSync(
      join(ungranted, "prompt.md"),
      "---\nallowed_tools: [Read, Bash]\n---\n\nHello.\n",
    );
    writeFileSync(join(ungranted, "graders", "ran.md"), "---\ntype: tool_used\ntool: Bash\n---\n");

    const found = problems(load(plugin).stderr).join("\n");
    expect(found).toContain("planted-unknown-key");
    expect(found).toContain("failed to load");
    expect(found).toMatch(/planted-ungranted.*cannot pass/);
  });
});

describe("eval suite fixtures", () => {
  const fixtures = readdirSync(join(EVALS, "fixtures"))
    .filter((file) => file.endsWith(".sh"))
    .sort();

  it("has at least one shared fixture", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures)(
    "fixtures/%s builds a workspace in an empty directory",
    (file) => {
      const { status, stderr, dir } = scaffold(join(EVALS, "fixtures", file));
      expect(stderr).toBe("");
      expect(status).toBe(0);
      expect(readdirSync(dir).length).toBeGreaterThan(0);
    },
    SCAFFOLD_LIMIT_MS + 10_000,
  );

  it.each(cases(EVALS).filter((name) => scaffoldScript(join(EVALS, name)) !== undefined))(
    "%s: its scaffold_script exits 0",
    (name) => {
      const script = scaffoldScript(join(EVALS, name));
      expect(script).toBeDefined();
      if (script === undefined) return;
      expect(existsSync(script)).toBe(true);
      const { status, stderr } = scaffold(script);
      expect(stderr).toBe("");
      expect(status).toBe(0);
    },
    SCAFFOLD_LIMIT_MS + 10_000,
  );
});

describe("eval suite layout", () => {
  const names = cases(EVALS);

  it("has cases", () => {
    expect(names.length).toBeGreaterThan(0);
  });

  it.each(names)("%s is named <block>-<case> and holds a case", (name) => {
    expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)+$/);
    const dir = join(EVALS, name);
    expect(existsSync(join(dir, "prompt.md")) || existsSync(join(dir, "case.yaml"))).toBe(true);
  });

  it.each(names)("%s carries exactly one of the tags block, orchestrator, sample", (name) => {
    const kinds = tags(join(EVALS, name)).filter((tag) =>
      ["block", "orchestrator", "sample"].includes(tag),
    );
    expect(kinds).toHaveLength(1);
  });

  it.each(names.filter((name) => tags(join(EVALS, name)).includes("block")))(
    "%s grades the result and the steps",
    (name) => {
      const types = graderTypes(join(EVALS, name));
      expect(types.some((type) => ["file_exists", "regex", "llm"].includes(type))).toBe(true);
      expect(types.some((type) => ["tool_used", "tool_order"].includes(type))).toBe(true);
    },
  );

  it.each(names.filter((name) => tags(join(EVALS, name)).includes("orchestrator")))(
    "%s grades the order of its blocks and the files it writes",
    (name) => {
      const types = graderTypes(join(EVALS, name));
      expect(types).toContain("tool_order");
      expect(types).toContain("file_exists");
    },
  );

  it("keeps run results out of git", () => {
    const { status } = spawnSync(
      "git",
      ["check-ignore", "--quiet", "plugins/bdk/evals/results/2026-01-01T00-00-00-000Z/x.json"],
      { cwd: REPO },
    );
    expect(status).toBe(0);
  });
});

describe("eval launcher", () => {
  /** A directory holding an executable `openspec`. */
  function withOpenspec(parent: string): string {
    const bin = join(parent, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "openspec"), "#!/bin/sh\n", { mode: 0o755 });
    return bin;
  }

  it("is what the eval script runs after the build", () => {
    const pkg = JSON.parse(readFileSync(join(PLUGIN, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.eval).toBe("node build.ts && node evals/run.ts");
  });

  it("drops every workspace bin directory from PATH and keeps the rest in order", () => {
    const path = [
      ".git/bdk-eval/bin",
      join(PLUGIN, "node_modules", ".bin"),
      join(REPO, "node_modules", ".bin"),
      "/opt/homebrew/bin",
      "/usr/bin",
      "/x/node_modules/.bin/",
    ].join(delimiter);
    expect(runPath(path)).toBe(
      [".git/bdk-eval/bin", "/opt/homebrew/bin", "/usr/bin"].join(delimiter),
    );
  });

  it("puts the directory of an absolute shell prefix first, once", () => {
    const path = ["/opt/homebrew/bin", "/usr/bin"].join(delimiter);
    const prefix = "/Users/Shared/bdk-eval/bin/macos-git-prefix.sh";
    expect(runPath(path, prefix)).toBe(
      ["/Users/Shared/bdk-eval/bin", "/opt/homebrew/bin", "/usr/bin"].join(delimiter),
    );
    expect(runPath(["/usr/bin", "/Users/Shared/bdk-eval/bin"].join(delimiter), prefix)).toBe(
      ["/Users/Shared/bdk-eval/bin", "/usr/bin"].join(delimiter),
    );
  });

  it("leaves PATH alone for an unset, empty or relative shell prefix", () => {
    const path = ["/opt/homebrew/bin", "/usr/bin"].join(delimiter);
    expect(runPath(path, undefined)).toBe(path);
    expect(runPath(path, "")).toBe(path);
    expect(runPath(path, "bin/macos-git-prefix.sh")).toBe(path);
  });

  it("grants what /bdk:execute uses in the README command of the execute-* cases", () => {
    const readme = readFileSync(join(EVALS, "README.md"), "utf8");
    const command = readme.split("\n").find((line) => line.includes("--case 'execute-*'"));
    for (const grant of ["Write", "Edit", "SendMessage", "ToolSearch"]) {
      expect(command).toMatch(new RegExp(` ${grant}\\b`));
    }
    for (const bash of ["*/bin/bdk *", "mkdir -p *", "cd *", "git *"]) {
      expect(command).toContain(`"Bash(${bash})"`);
    }
  });

  it("warns when no openspec is on PATH", () => {
    const dir = fresh("no-openspec");
    expect(openspecWarning(join(dir, "empty"), join(dir, "home"))).toMatch(/openspec/);
  });

  it("warns when the openspec on PATH lies under the home directory", () => {
    const dir = fresh("home-openspec");
    const bin = withOpenspec(join(dir, "home", ".nvm"));
    expect(openspecWarning(bin, join(dir, "home"))).toMatch(/openspec.*home directory/s);
  });

  it("is quiet for an openspec outside the home directory, after a directory without one", () => {
    const dir = fresh("global-openspec");
    const bin = withOpenspec(join(dir, "opt"));
    const path = [join(dir, "empty"), bin].join(delimiter);
    expect(openspecWarning(path, join(dir, "home"))).toBeUndefined();
  });
});

describe("offline gh stand-in", () => {
  const GH = join(EVALS, "fixtures", "bin", "gh");
  const ISSUE = {
    number: 42,
    title: "Export the ledger as CSV",
    body: "## Goal\nExport.",
    labels: [{ id: "L1", name: "enhancement", description: "", color: "a2eeef" }],
    state: "OPEN",
    url: "https://github.com/acme/tiny-ledger/issues/42",
  };

  /** A git workspace whose scaffold wrote issue 42, the way a case scaffold does. */
  function workspace(): string {
    const dir = join(fresh("gh"), "workspace");
    mkdirSync(join(dir, ".git", "bdk-eval", "issues"), { recursive: true });
    writeFileSync(join(dir, ".git", "bdk-eval", "issues", "42.json"), JSON.stringify(ISSUE));
    mkdirSync(join(dir, "src"));
    return dir;
  }

  function gh(cwd: string, ...args: string[]) {
    return spawnSync(GH, args, { cwd, encoding: "utf8", env: { PATH: process.env.PATH } });
  }

  it("prints only the --json fields, from a subdirectory too", () => {
    const { status, stdout } = gh(
      join(workspace(), "src"),
      "issue",
      "view",
      "#42",
      "--json",
      "number,title",
    );
    expect(status).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ number: 42, title: "Export the ledger as CSV" });
  });

  it.each([["42"], ["https://github.com/acme/tiny-ledger/issues/42"], ["acme/tiny-ledger#42"]])(
    "resolves the reference %s",
    (ref) => {
      const { status, stdout } = gh(workspace(), "issue", "view", ref, "--json", "url");
      expect(status).toBe(0);
      expect(JSON.parse(stdout)).toEqual({ url: ISSUE.url });
    },
  );

  it("accepts --repo and -R before or after the number", () => {
    const dir = workspace();
    expect(
      gh(dir, "issue", "view", "--repo", "acme/tiny-ledger", "42", "--json", "state").status,
    ).toBe(0);
    expect(gh(dir, "issue", "view", "42", "-R", "acme/tiny-ledger", "--json", "state").status).toBe(
      0,
    );
  });

  it("prints title, state and body as text without --json", () => {
    const { status, stdout } = gh(workspace(), "issue", "view", "42");
    expect(status).toBe(0);
    expect(stdout).toContain("title:\tExport the ledger as CSV");
    expect(stdout).toContain("state:\tOPEN");
    expect(stdout).toContain("labels:\tenhancement");
    expect(stdout).toContain("## Goal\nExport.");
  });

  it("fails like gh for an issue the scaffold did not write", () => {
    const { status, stderr } = gh(workspace(), "issue", "view", "7");
    expect(status).toBe(1);
    expect(stderr).toContain(
      "GraphQL: Could not resolve to an issue or pull request with the number of 7.",
    );
  });

  it("refuses every other command and names itself", () => {
    const { status, stderr } = gh(workspace(), "pr", "list");
    expect(status).toBe(1);
    expect(stderr).toContain("offline gh stand-in");
  });

  function prFile(dir: string, number: number) {
    return JSON.parse(
      readFileSync(join(dir, ".git", "bdk-eval", "prs", `${number}.json`), "utf8"),
    ) as Record<string, unknown>;
  }

  it("records a pull request from a body file and prints its URL", () => {
    const dir = workspace();
    writeFileSync(join(dir, "body.md"), "## Summary\n\nAdds `tally total`.\n");
    const { status, stdout } = gh(
      join(dir, "src"),
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      "add-total",
      "--title",
      "feat: tally total",
      "--body-file",
      "../body.md",
    );
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("https://github.com/bdk-eval/repo/pull/1");
    expect(prFile(dir, 1)).toEqual({
      number: 1,
      url: "https://github.com/bdk-eval/repo/pull/1",
      state: "OPEN",
      baseRefName: "main",
      headRefName: "add-total",
      title: "feat: tally total",
      body: "## Summary\n\nAdds `tally total`.\n",
    });
  });

  it("numbers pull requests and takes --body and = forms", () => {
    const dir = workspace();
    gh(dir, "pr", "create", "--base=main", "--head=a", "--title=A", "--body=first");
    const { status, stdout } = gh(
      dir,
      "pr",
      "create",
      "-B",
      "main",
      "-H",
      "b",
      "-t",
      "B",
      "-b",
      "x",
    );
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("https://github.com/bdk-eval/repo/pull/2");
    expect(prFile(dir, 1)).toMatchObject({ headRefName: "a", body: "first" });
    expect(prFile(dir, 2)).toMatchObject({ headRefName: "b", title: "B", body: "x" });
  });

  it.each([
    [["--head", "a", "--title", "A", "--body", "x"], "--base"],
    [["--base", "main", "--title", "A", "--body", "x"], "--head"],
    [["--base", "main", "--head", "a", "--body", "x"], "--title"],
    [["--base", "main", "--head", "a", "--title", "A", "--body-file", "missing.md"], "missing.md"],
  ])("refuses pr create %j, naming %s", (args, named) => {
    const dir = workspace();
    const { status, stderr } = gh(dir, "pr", "create", ...args);
    expect(status).toBe(1);
    expect(stderr).toContain(named);
    expect(existsSync(join(dir, ".git", "bdk-eval", "prs", "1.json"))).toBe(false);
  });

  it("refuses a second open pull request of the same head", () => {
    const dir = workspace();
    const args = ["pr", "create", "--base", "main", "--head", "a", "--title", "A", "--body", "x"];
    gh(dir, ...args);
    const { status, stderr } = gh(dir, ...args);
    expect(status).toBe(1);
    expect(stderr).toContain('a pull request for branch "a" into branch "main" already exists');
    expect(existsSync(join(dir, ".git", "bdk-eval", "prs", "2.json"))).toBe(false);
  });

  it("views the open pull request of a branch", () => {
    const dir = workspace();
    gh(dir, "pr", "create", "--base", "main", "--head", "add-total", "--title", "T", "--body", "x");
    const json = gh(dir, "pr", "view", "add-total", "--json", "url,state");
    expect(json.status).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({
      state: "OPEN",
      url: "https://github.com/bdk-eval/repo/pull/1",
    });
    const text = gh(dir, "pr", "view", "add-total");
    expect(text.status).toBe(0);
    expect(text.stdout).toContain("title:\tT");
    expect(text.stdout).toContain("url:\thttps://github.com/bdk-eval/repo/pull/1");
  });

  it("fails like gh when the branch has no pull request", () => {
    const { status, stderr } = gh(workspace(), "pr", "view", "add-total");
    expect(status).toBe(1);
    expect(stderr).toContain('no pull requests found for branch "add-total"');
  });

  const PR = {
    number: 7,
    url: "https://github.com/bdk-eval/repo/pull/7",
    state: "MERGED",
    isDraft: false,
    author: { login: "teammate" },
    baseRefName: "main",
    headRefName: "monthly-report",
    headRefOid: "0123456789abcdef0123456789abcdef01234567",
    title: "Monthly report",
    body: "Adds `ledger report`.",
    closingIssuesReferences: [],
  };

  /** A workspace whose scaffold wrote pull request 7, as the pr-review fixture does. */
  function prWorkspace(): string {
    const dir = workspace();
    mkdirSync(join(dir, ".git", "bdk-eval", "prs"), { recursive: true });
    writeFileSync(join(dir, ".git", "bdk-eval", "prs", "7.json"), JSON.stringify(PR));
    return dir;
  }

  it.each([["7"], ["#7"], ["https://github.com/bdk-eval/repo/pull/7"]])(
    "views pull request %s by number, whatever its state",
    (ref) => {
      const { status, stdout } = gh(
        prWorkspace(),
        "pr",
        "view",
        ref,
        "--json",
        "number,headRefOid,author,state",
      );
      expect(status).toBe(0);
      expect(JSON.parse(stdout)).toEqual({
        author: { login: "teammate" },
        headRefOid: PR.headRefOid,
        number: 7,
        state: "MERGED",
      });
    },
  );

  it("fails like gh for a pull request number the scaffold did not write", () => {
    const { status, stderr } = gh(workspace(), "pr", "view", "9");
    expect(status).toBe(1);
    expect(stderr).toContain("GraphQL: Could not resolve to a PullRequest with the number of 9.");
  });

  it("views the repository and the user", () => {
    const dir = workspace();
    const repo = gh(dir, "repo", "view", "--json", "nameWithOwner,url");
    expect(repo.status).toBe(0);
    expect(JSON.parse(repo.stdout)).toEqual({
      nameWithOwner: "bdk-eval/repo",
      url: "https://github.com/bdk-eval/repo",
    });
    const user = gh(dir, "api", "user");
    expect(user.status).toBe(0);
    expect(JSON.parse(user.stdout)).toEqual({ login: "bdk-eval-user" });
  });

  function postReview(dir: string, review: unknown, ...flags: string[]) {
    writeFileSync(join(dir, "review.json"), JSON.stringify(review));
    return gh(
      dir,
      "api",
      "repos/bdk-eval/repo/pulls/7/reviews",
      ...(flags.length > 0 ? flags : ["-X", "POST"]),
      "--input",
      "review.json",
    );
  }

  it("records a posted review and answers with its id and state", () => {
    const dir = prWorkspace();
    const review = { commit_id: PR.headRefOid, event: "REQUEST_CHANGES", body: "x", comments: [] };
    const first = postReview(dir, review);
    expect(first.status).toBe(0);
    expect(JSON.parse(first.stdout)).toEqual({
      id: 1,
      html_url: "https://github.com/bdk-eval/repo/pull/7#pullrequestreview-1",
      state: "CHANGES_REQUESTED",
    });
    const second = postReview(dir, { event: "COMMENT", body: "y" }, "--method", "POST");
    expect(JSON.parse(second.stdout)).toMatchObject({ id: 2, state: "COMMENTED" });
    const recorded = join(dir, ".git", "bdk-eval", "reviews", "7-1.json");
    expect(JSON.parse(readFileSync(recorded, "utf8"))).toEqual(review);
  });

  it.each([
    [{ body: "no event" }, "HTTP 422"],
    [{ event: "APPROVE" }, "HTTP 422"],
  ])("refuses the review %j", (review, message) => {
    const dir = prWorkspace();
    const { status, stderr } = postReview(dir, review);
    expect(status).toBe(1);
    expect(stderr).toContain(message);
    expect(existsSync(join(dir, ".git", "bdk-eval", "reviews"))).toBe(false);
  });

  it("refuses a review of a pull request the scaffold did not write", () => {
    const dir = workspace();
    writeFileSync(join(dir, "review.json"), JSON.stringify({ event: "COMMENT", body: "x" }));
    const { status, stderr } = gh(
      dir,
      "api",
      "repos/bdk-eval/repo/pulls/9/reviews",
      "-X",
      "POST",
      "--input",
      "review.json",
    );
    expect(status).toBe(1);
    expect(stderr).toContain("HTTP 404");
  });

  const THREADS_QUERY =
    "query($owner:String!,$repo:String!,$pr:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$pr){reviews(last:100){nodes{id body state url author{login} commit{oid}}} reviewThreads(first:100){nodes{id isResolved isOutdated path line originalLine comments(first:1){nodes{author{login} body url}}}}}}}";
  const RESOLVE = "mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}";

  function threads(dir: string) {
    const { status, stdout, stderr } = gh(
      dir,
      "api",
      "graphql",
      "-f",
      `query=${THREADS_QUERY}`,
      "-F",
      "owner=bdk-eval",
      "-F",
      "repo=repo",
      "-F",
      "pr=7",
    );
    expect(stderr).toBe("");
    expect(status).toBe(0);
    return (JSON.parse(stdout) as { data: { repository: { pullRequest: PullRequestNode } } }).data
      .repository.pullRequest;
  }

  interface PullRequestNode {
    reviews: { nodes: Record<string, unknown>[] };
    reviewThreads: {
      nodes: {
        id: string;
        isResolved: boolean;
        path: string;
        line: number;
        comments: { nodes: { body: string }[] };
      }[];
    };
  }

  const REVIEWED = {
    commit_id: PR.headRefOid,
    event: "REQUEST_CHANGES",
    body: "## BDK review",
    comments: [
      { path: "src/parse.js", line: 13, side: "RIGHT", body: "**[blocker]** parse" },
      { path: "src/report.js", line: 12, side: "RIGHT", body: "**[blocker]** report" },
    ],
  };

  it("answers the reviews and review threads of recorded reviews", () => {
    const dir = prWorkspace();
    postReview(dir, REVIEWED);
    const pr = threads(dir);
    expect(pr.reviews.nodes).toEqual([
      {
        id: "PRR_7_1",
        body: "## BDK review",
        state: "CHANGES_REQUESTED",
        url: "https://github.com/bdk-eval/repo/pull/7#pullrequestreview-1",
        author: { login: "bdk-eval-user" },
        commit: { oid: PR.headRefOid },
      },
    ]);
    expect(pr.reviewThreads.nodes).toEqual([
      {
        id: "PRRT_7_1_1",
        isResolved: false,
        isOutdated: false,
        path: "src/parse.js",
        line: 13,
        originalLine: 13,
        comments: {
          nodes: [
            {
              author: { login: "bdk-eval-user" },
              body: "**[blocker]** parse",
              url: "https://github.com/bdk-eval/repo/pull/7#discussion_r7_1_1",
            },
          ],
        },
      },
      expect.objectContaining({ id: "PRRT_7_1_2", path: "src/report.js", line: 12 }),
    ]);
  });

  it("resolves a thread and shows it resolved", () => {
    const dir = prWorkspace();
    postReview(dir, REVIEWED);
    const { status, stdout } = gh(
      dir,
      "api",
      "graphql",
      "-f",
      `query=${RESOLVE}`,
      "-F",
      "t=PRRT_7_1_1",
    );
    expect(status).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      data: { resolveReviewThread: { thread: { isResolved: true } } },
    });
    const resolved = join(dir, ".git", "bdk-eval", "resolved.json");
    expect(JSON.parse(readFileSync(resolved, "utf8"))).toEqual(["PRRT_7_1_1"]);
    expect(threads(dir).reviewThreads.nodes.map((thread) => thread.isResolved)).toEqual([
      true,
      false,
    ]);
  });

  it("refuses an unknown thread and any other query", () => {
    const dir = prWorkspace();
    postReview(dir, REVIEWED);
    const unknown = gh(dir, "api", "graphql", "-f", `query=${RESOLVE}`, "-F", "t=PRRT_7_9_1");
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain("PRRT_7_9_1");
    expect(existsSync(join(dir, ".git", "bdk-eval", "resolved.json"))).toBe(false);
    const other = gh(dir, "api", "graphql", "-f", "query={ viewer { login } }");
    expect(other.status).toBe(1);
    expect(other.stderr).toContain("offline gh stand-in");
  });
});
