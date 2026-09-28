// The recorded PreToolUse payloads the pre-tool tests and the prefilter
// contract test share: builders over the T01 fixtures, and the corpus of
// payloads the kernel denies, which the shell prefilter must hand to it.
import agentFg from "../../../../tests/fixtures/host-payloads/2.1.281/agent-fg.json" with { type: "json" };
import preBash from "../../../../tests/fixtures/host-payloads/2.1.281/pre-bash.json" with { type: "json" };
import preEdit from "../../../../tests/fixtures/host-payloads/2.1.281/pre-edit.json" with { type: "json" };
import preNotebook from "../../../../tests/fixtures/host-payloads/2.1.281/pre-notebookedit.json" with { type: "json" };
import preWrite from "../../../../tests/fixtures/host-payloads/2.1.281/pre-write.json" with { type: "json" };

export const PROJECT = "/work/project";
export const PACKAGE = ".bdk/changes/2026-09-25-login/dispatch/02-3-implementer-A-7f3k9m2q.md";
export const SPEC = `${PROJECT}/.bdk/specs/auth/spec.md`;

export type Payload = Record<string, unknown>;

export { agentFg, preEdit, preNotebook, preWrite };

/** A recorded payload with its placeholders made concrete and `tool_input` overridden. */
export function recorded(fixture: { payloads: unknown[] }, input: Payload = {}): Payload {
  const payload = fixture.payloads[0] as Payload;
  const text = JSON.stringify(payload).replaceAll("<PROJECT>", PROJECT);
  const parsed = JSON.parse(text) as Payload;
  return { ...parsed, tool_input: { ...(parsed.tool_input as Payload), ...input } };
}

export const mainBash = (command: string): Payload => recorded(preBash, { command });

/** The recorded subagent Bash payload (`agent-fg.json`), as `agentType` when given. */
export function subagentBash(command: string, agentType?: string): Payload {
  const payload = { ...(agentFg.payloads[1] as Payload), cwd: PROJECT };
  return {
    ...payload,
    ...(agentType === undefined ? {} : { agent_type: agentType }),
    tool_input: { command },
  };
}

export function agentCall(subagentType: string, prompt: string): Payload {
  return { ...recorded(agentFg), tool_input: { subagent_type: subagentType, prompt } };
}

export const kernel = (argv: string): string =>
  `node "\${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ${argv}`;

/** Subagent git commands and the verb each deny names. */
export const GIT_DENIED: readonly (readonly [string, string])[] = [
  ["git stash", "git stash"],
  ["git reset --hard HEAD", "git reset"],
  ["git clean -fd", "git clean"],
  ["git restore src/a.ts", "git restore"],
  ["git commit -m wip", "git commit"],
  ["git add -A", "git add"],
  ["git merge main", "git merge"],
  ["git rebase main", "git rebase"],
  ["git cherry-pick abc", "git cherry-pick"],
  ["git push origin HEAD", "git push"],
  ["git checkout -- src/a.ts", "git checkout -- <path>"],
  ["git checkout .", "git checkout ."],
  ["git checkout -f main", "git checkout --force"],
  ["git switch --discard-changes main", "git switch --discard-changes"],
  ["git switch --force main", "git switch --force"],
  ["git -C ../repo -c core.pager=cat reset --hard", "git reset"],
  ["git --no-pager --git-dir=.git stash", "git stash"],
  ["bash -c 'cd x && git stash'", "git stash"],
  ["FOO=1 env -u X command git stash", "git stash"],
  ["/usr/bin/git add .", "git add"],
];

/** Bash nested stage commands and the command each deny names. */
export const NESTED_DENIED: readonly (readonly [string, string])[] = [
  ['claude -p "/bdk:plan"', "/bdk:plan"],
  ["claude -p '/bdk:execute --skip-verify'", "/bdk:execute"],
  ['cd x && claude --print "/bdk:run"', "/bdk:run"],
];

/** Bash writes under the spec directory, denied in any thread. */
export const SPEC_WRITES: readonly string[] = [
  "echo x > .bdk/specs/auth/spec.md",
  "cat a.md | tee -a .bdk/specs/a.md",
  "sed -i 's/a/b/' .bdk/specs/a/spec.md",
  "cp draft.md .bdk/specs/auth/spec.md",
  "rm -rf .bdk/specs",
];

/** Bash writes a read-only adapter may not run. */
export const READER_WRITES: readonly string[] = [
  "echo x > notes.md",
  "echo x >> notes.md",
  "echo x &> out.log",
  "cmd 2> err.log",
  "tee notes.md",
  "sed -i 's/a/b/' a.ts",
  "perl -pi -e 's/a/b/' a.ts",
  "cp a.ts b.ts",
  "install a b",
  "mv a b",
  "rm a",
  "rmdir d",
  "touch a",
  "mkdir d",
  "ln -s a b",
  "truncate -s 0 a",
  "chmod +x a",
  "chown me a",
  "dd if=a of=b",
  "git apply fix.patch",
];

/** Dispatch prompts that are more than the package path and one sentence. */
export const BAD_PROMPTS: readonly (readonly [string, string])[] = [
  ["extra sentences", `${PACKAGE} Start here. Then run it. Then commit.`],
  ["a blank line", `${PACKAGE}\n\nStart with the failing test`],
  ["no path", "Implement the login form."],
  ["two paths", `${PACKAGE} and ${PACKAGE.replace("02-3", "02-4")}`],
  ["a long sentence", `${PACKAGE} ${"word ".repeat(50)}`],
];

/** Every payload form `hooks pre-tool` denies, labelled. */
export function deniedPayloads(): (readonly [string, Payload])[] {
  return [
    ...GIT_DENIED.map(([command]) => [`subagent ${command}`, subagentBash(command)] as const),
    [`subagent ${kernel("commit 02-3")}`, subagentBash(kernel("commit 02-3"))],
    ["subagent ./dist/bdk.mjs hooks pre-tool", subagentBash("./dist/bdk.mjs hooks pre-tool")],
    ["main bdk.mjs hooks", mainBash(kernel("hooks prompt-expansion"))],
    ...NESTED_DENIED.map(([command]) => [`main ${command}`, mainBash(command)] as const),
    ["Edit under .bdk/specs", recorded(preEdit, { file_path: SPEC })],
    ["Write under .bdk/specs", recorded(preWrite, { file_path: SPEC })],
    ["NotebookEdit under .bdk/specs", recorded(preNotebook, { notebook_path: SPEC })],
    ["relative Edit under .bdk/specs", recorded(preEdit, { file_path: ".bdk/specs/a.md" })],
    ...SPEC_WRITES.map((command) => [`main ${command}`, mainBash(command)] as const),
    ...READER_WRITES.flatMap((command) =>
      ["bdk:reader", "bdk:reviewer", "bdk:scout"].map(
        (adapter) => [`${adapter} ${command}`, subagentBash(command, adapter)] as const,
      ),
    ),
    ...BAD_PROMPTS.flatMap(([label, prompt]) =>
      ["bdk:worker", "bdk:reader", "bdk:reviewer", "bdk:runner", "bdk:scout"].map(
        (adapter) => [`${adapter} prompt with ${label}`, agentCall(adapter, prompt)] as const,
      ),
    ),
  ];
}
