import { describe, expect, it } from "vitest";

import { commandWords, readCommands } from "../domain/shell.ts";

const words = (text: string) => readCommands(text).map((command) => command.words);

describe("readCommands", () => {
  it("splits on separators and keeps quoted text in one word", () => {
    expect(words(`git commit -m "revert with git reset" && echo 'git stash'; ls | wc -l`)).toEqual([
      ["git", "commit", "-m", "revert with git reset"],
      ["echo", "git stash"],
      ["ls"],
      ["wc", "-l"],
    ]);
  });

  it("handles escapes, line continuations and double-quote escapes", () => {
    expect(words('echo a\\ b "c\\"d" "e\\n" \\\n f')).toEqual([
      ["echo", "a b", 'c"d', "e\\n", "f"],
    ]);
  });

  it("skips comments at a word start only", () => {
    expect(words("echo a#b # git stash\ngit status")).toEqual([
      ["echo", "a#b"],
      ["git", "status"],
    ]);
  });

  it("skips heredoc bodies, quoted, unquoted and tab-stripped", () => {
    const text = [
      "node bdk.mjs log ingest --ticket A-1 <<'EOF'",
      "a > b",
      "git stash",
      "EOF",
      "cat <<-END > out.txt",
      "\tgit reset --hard",
      "\tEND",
      "git status",
    ].join("\n");
    const commands = readCommands(text);
    expect(commands.map((command) => command.words)).toEqual([
      ["node", "bdk.mjs", "log", "ingest", "--ticket", "A-1"],
      ["cat"],
      ["git", "status"],
    ]);
    expect(commands[1]?.redirects).toEqual([{ op: ">", target: "out.txt" }]);
    expect(commands[0]?.redirects).toEqual([]);
  });

  it("reads redirections with fd numbers and duplications", () => {
    const [command] = readCommands("pnpm test 2>&1 >>log.txt 2>/dev/null &>all <in.txt >|x");
    expect(command?.words).toEqual(["pnpm", "test"]);
    expect(command?.redirects).toEqual([
      { op: ">&", target: "1" },
      { op: ">>", target: "log.txt" },
      { op: ">", target: "/dev/null" },
      { op: "&>", target: "all" },
      { op: "<", target: "in.txt" },
      { op: ">|", target: "x" },
    ]);
  });

  it("keeps command substitutions inside their word", () => {
    expect(words('echo "$(git rev-parse "HEAD")" `git stash` $(a; b)')).toEqual([
      ["echo", '$(git rev-parse "HEAD")', "`git stash`", "$(a; b)"],
    ]);
  });

  it("treats grouping and leading keywords as separators", () => {
    expect(words("(cd x && git stash); { git reset; }; if git clean -f; then echo y; fi")).toEqual([
      ["cd", "x"],
      ["git", "stash"],
      ["git", "reset"],
      ["git", "clean", "-f"],
      ["echo", "y"],
    ]);
  });

  it("reads ANSI-C quotes", () => {
    expect(words("echo $'a\\'b'")).toEqual([["echo", "a'b"]]);
  });

  it("reads sh -c, bash -lc and eval strings again, up to three levels", () => {
    expect(words(`bash -lc 'cd x && git stash'`)).toEqual([
      ["bash", "-lc", "cd x && git stash"],
      ["cd", "x"],
      ["git", "stash"],
    ]);
    expect(words("eval git reset --hard")).toEqual([
      ["eval", "git", "reset", "--hard"],
      ["git", "reset", "--hard"],
    ]);
    const deep = words(`sh -c "sh -c 'sh -c \\"sh -c git\\"'"`);
    expect(deep.at(-1)).toEqual(["sh", "-c", "git"]);
    expect(deep).not.toContainEqual(["git"]);
  });

  it("tolerates unterminated quotes and substitutions", () => {
    expect(() => readCommands(`echo "a $(b 'c`)).not.toThrow();
    expect(() => readCommands("echo `a")).not.toThrow();
    expect(() => readCommands("cat <<EOF\nno end")).not.toThrow();
  });
});

describe("commandWords", () => {
  const first = (text: string) =>
    commandWords(readCommands(text)[0] ?? { words: [], redirects: [] });

  it("drops assignments and wrappers", () => {
    expect(first("A=1 B=2 git stash")).toEqual(["git", "stash"]);
    expect(first("env -u X Y=1 git stash")).toEqual(["git", "stash"]);
    expect(first("sudo -u me nice -n 5 nohup time -p exec command git stash")).toEqual([
      "git",
      "stash",
    ]);
  });

  it("returns nothing for a name lookup", () => {
    expect(first("command -v git")).toEqual([]);
  });
});
