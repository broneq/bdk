import { describe, expect, it } from "vitest";

import { commandWords, readCommands } from "../domain/shell.ts";

// The command reader of the subagent-git guard (spec `bdk-cli/hooks`, "Git history changes";
// design D5): a Bash command becomes simple commands with their words, as a shell reads them.

const words = (text: string) => readCommands(text).map((command) => command.words);

describe("readCommands", () => {
  it("splits on separators and keeps quoted text in one word", () => {
    expect(words(`git commit -m "revert with git reset" && echo 'git stash'; ls | wc -l`)).toEqual([
      ["git", "commit", "-m", "revert with git reset"],
      ["echo", "git stash"],
      ["ls"],
      ["wc", "-l"],
    ]);
    expect(words("a || b & c\nd")).toEqual([["a"], ["b"], ["c"], ["d"]]);
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
      "cat <<'EOF' > notes.md",
      "git stash",
      "EOF",
      "cat <<-END",
      "\tgit reset --hard",
      "\tEND",
      "git status",
    ].join("\n");
    expect(words(text)).toEqual([["cat"], ["cat"], ["git", "status"]]);
  });

  it("drops redirections and their targets, with fd numbers and duplications", () => {
    expect(words("pnpm test 2>&1 >>log.txt 2>/dev/null &>all <in.txt >|x <<<word")).toEqual([
      ["pnpm", "test"],
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

  it("reads command substitutions again, in words and inside double quotes", () => {
    expect(words("x=$(git stash create)")).toContainEqual(["git", "stash", "create"]);
    expect(words('echo "id: $(git rev-parse "HEAD")" `git stash`')).toEqual([
      ["echo", 'id: $(git rev-parse "HEAD")', "`git stash`"],
      ["git", "rev-parse", "HEAD"],
      ["git", "stash"],
    ]);
    expect(words("echo $(a $(git commit))")).toContainEqual(["git", "commit"]);
  });

  it("does not read substitutions inside single quotes", () => {
    expect(words("echo '$(git commit)'")).toEqual([["echo", "$(git commit)"]]);
  });

  it("tolerates unterminated quotes and substitutions", () => {
    expect(() => readCommands(`echo "a $(b 'c`)).not.toThrow();
    expect(() => readCommands("echo `a")).not.toThrow();
    expect(() => readCommands("cat <<EOF\nno end")).not.toThrow();
    expect(() => readCommands("echo 'open")).not.toThrow();
  });
});

describe("commandWords", () => {
  const first = (text: string) => commandWords(readCommands(text)[0] ?? { words: [] });

  it("drops assignments and wrappers", () => {
    expect(first("A=1 B+=2 git stash")).toEqual(["git", "stash"]);
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

describe("scripts a command runs itself", () => {
  it("skips shell options with a value before -c", () => {
    expect(words("bash -o pipefail -c 'git commit -m x'")).toContainEqual([
      "git",
      "commit",
      "-m",
      "x",
    ]);
    expect(words("bash +O extglob -e -c 'git push'")).toContainEqual(["git", "push"]);
  });

  it("reads the heredoc body a shell reads on stdin, not one another program reads", () => {
    expect(words("bash <<'EOF'\ngit commit -m x\nEOF")).toContainEqual([
      "git",
      "commit",
      "-m",
      "x",
    ]);
    expect(words("sh -s <<-END\n\tgit stash\n\tEND\necho done")).toEqual([
      ["sh", "-s"],
      ["git", "stash"],
      ["echo", "done"],
    ]);
    expect(words("cat <<'EOF' > notes.md\ngit commit\nEOF")).toEqual([["cat"]]);
    expect(words("bash script.sh <<'EOF'\ngit commit\nEOF")).toEqual([["bash", "script.sh"]]);
  });

  it("reads a function body defined with the function keyword or with ()", () => {
    expect(words("function c { git commit -m x; }; c")).toEqual([
      ["c"],
      ["git", "commit", "-m", "x"],
      ["c"],
    ]);
    expect(words("c() { git commit; }; c")).toContainEqual(["git", "commit"]);
  });
});

describe("commandWords wrappers", () => {
  const first = (text: string) => commandWords(readCommands(text)[0] ?? { words: [] });

  it("drops timeout with its options and duration", () => {
    expect(first("timeout 300 git push origin HEAD")).toEqual(["git", "push", "origin", "HEAD"]);
    expect(first("timeout -s KILL -k 5 --preserve-status 1m git push")).toEqual(["git", "push"]);
  });

  it("splits the string of env -S into the command", () => {
    expect(first("env -S 'git commit -m x'")).toEqual(["git", "commit", "-m", "x"]);
    expect(first("env --split-string 'A=1 git push' origin")).toEqual(["git", "push", "origin"]);
  });
});
