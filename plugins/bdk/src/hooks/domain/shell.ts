// The command reader of the subagent-git guard (spec `bdk-cli/hooks`, "Git history changes";
// design D5, ported from draft 1's `kernel/src/hooks/domain/shell.ts`): a Bash command becomes
// simple commands with their words, so the guard looks at command words and never at text
// inside a quoted argument or a heredoc body (unless a shell reads that body). Best effort for
// a careless model: aliases, functions called by name, variables used as the command word and
// text piped into a shell stay opaque.

export interface SimpleCommand {
  readonly words: readonly string[];
}

/** A simple command, the scripts of its `$(...)` and backtick substitutions, its heredoc bodies. */
interface Lexed extends SimpleCommand {
  readonly substitutions: readonly string[];
  readonly heredocs: readonly string[];
}

/** Grouping words and keywords that start a command without being its command word. */
const LEADING = new Set([
  "{",
  "}",
  "!",
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "do",
  "done",
  "while",
  "until",
  "esac",
  "function",
]);

const SHELLS = new Set(["sh", "bash", "zsh", "dash"]);

/** Nested `sh -c`, `eval` and substitution scripts are read this many levels deep. */
const MAX_DEPTH = 3;

interface Heredoc {
  readonly delimiter: string;
  readonly stripTabs: boolean;
  /** The heredoc bodies of the command the heredoc belongs to. */
  readonly bodies: string[];
}

/**
 * Every simple command of `text`; after each command, the commands of the scripts it runs: its
 * `sh -c` / `eval` / `env -S` string, the heredoc bodies a shell reads, and its substitutions.
 */
export function readCommands(text: string, depth = 0): SimpleCommand[] {
  return lex(text).flatMap(({ words, substitutions, heredocs }) => {
    const command = { words };
    if (depth >= MAX_DEPTH) return [command];
    const scripts = [...nestedScripts(command, heredocs), ...substitutions];
    return [command, ...scripts.flatMap((script) => readCommands(script, depth + 1))];
  });
}

/**
 * The words from the command word on: leading assignments and the wrappers `env`, `command`,
 * `exec`, `time`, `timeout`, `nice`, `nohup` and `sudo` dropped; the string of `env -S` split
 * into words. Empty for `command -v` / `-V`, which only look a name up.
 */
export function commandWords(command: SimpleCommand): readonly string[] {
  let words = command.words;
  let at = 0;
  for (;;) {
    while (at < words.length && isAssignment(words[at] ?? "")) at += 1;
    const name = basename(words[at] ?? "");
    if (name === "env") {
      at += 1;
      while (
        at < words.length &&
        (isAssignment(words[at] ?? "") || (words[at] ?? "").startsWith("-"))
      ) {
        if (words[at] === "-S" || words[at] === "--split-string") {
          const split = (words[at + 1] ?? "").split(/\s+/).filter((part) => part !== "");
          words = [...split, ...words.slice(at + 2)];
          at = 0;
          break;
        }
        at += words[at] === "-u" || words[at] === "-C" ? 2 : 1;
      }
    } else if (name === "timeout") {
      at += 1;
      while ((words[at] ?? "").startsWith("-"))
        at += words[at] === "-s" || words[at] === "-k" ? 2 : 1;
      at += 1;
    } else if (name === "command") {
      at += 1;
      if (words[at] === "-v" || words[at] === "-V") return [];
      while ((words[at] ?? "").startsWith("-")) at += 1;
    } else if (name === "exec" || name === "nohup" || name === "time") {
      at += 1;
      while ((words[at] ?? "").startsWith("-")) at += 1;
    } else if (name === "nice") {
      at += 1;
      while ((words[at] ?? "").startsWith("-")) at += words[at] === "-n" ? 2 : 1;
    } else if (name === "sudo") {
      at += 1;
      while ((words[at] ?? "").startsWith("-")) {
        at += ["-u", "-g", "-h", "-p", "-C", "-D", "-U", "-r", "-t"].includes(words[at] ?? "")
          ? 2
          : 1;
      }
    } else {
      return words.slice(at);
    }
  }
}

export function basename(word: string): string {
  const slash = word.lastIndexOf("/");
  return slash === -1 ? word : word.slice(slash + 1);
}

function isAssignment(word: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(word);
}

/** Shell options that take the next word as their value. */
const SHELL_VALUE_OPTIONS = new Set(["-o", "+o", "-O", "+O", "--rcfile", "--init-file"]);

/**
 * The scripts a command runs itself: the string of `eval` or `sh -c`, or, for a shell with
 * neither `-c` nor a script file, the heredoc bodies it reads on stdin.
 */
function nestedScripts(command: SimpleCommand, heredocs: readonly string[]): readonly string[] {
  const words = commandWords(command);
  const name = basename(words[0] ?? "");
  if (name === "eval") return words.length > 1 ? [words.slice(1).join(" ")] : [];
  if (!SHELLS.has(name)) return [];
  for (let at = 1; at < words.length; at += 1) {
    const word = words[at] ?? "";
    if (SHELL_VALUE_OPTIONS.has(word)) at += 1;
    else if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(word)) return [words[at + 1] ?? ""];
    else if (word === "-" || word === "--") break;
    else if (!/^[-+]/.test(word)) return [];
  }
  return heredocs;
}

/** The lexer proper: one pass over `text`. */
function lex(text: string): Lexed[] {
  const commands: Lexed[] = [];
  let words: string[] = [];
  let substitutions: string[] = [];
  let heredocs: string[] = [];
  let word = "";
  let started = false;
  /** A redirection waits for its target word, which is dropped. */
  let pendingRedirect = false;
  let pendingHeredocs: Heredoc[] = [];
  let heredocOp: { stripTabs: boolean } | undefined;
  let at = 0;

  const substitution = (script: string): void => {
    substitutions.push(script);
  };
  const endWord = (): void => {
    if (!started) return;
    if (heredocOp !== undefined) {
      pendingHeredocs.push({ delimiter: word, stripTabs: heredocOp.stripTabs, bodies: heredocs });
      heredocOp = undefined;
    } else if (pendingRedirect) {
      pendingRedirect = false;
    } else if (words.length === 0 && LEADING.has(word)) {
      // a keyword or grouping word before the command word: not part of the command
    } else if (word === "{" || word === "}") {
      // a group or function body opened or closed after other words (`function f {`)
      flush();
    } else {
      words.push(word);
    }
    word = "";
    started = false;
  };
  const flush = (): void => {
    if (words.length > 0 || substitutions.length > 0 || heredocs.length > 0) {
      commands.push({ words, substitutions, heredocs });
    }
    words = [];
    substitutions = [];
    heredocs = [];
  };
  const endCommand = (): void => {
    endWord();
    pendingRedirect = false;
    heredocOp = undefined;
    flush();
  };
  const skipHeredocs = (): void => {
    for (const heredoc of pendingHeredocs) {
      const body: string[] = [];
      while (at < text.length) {
        const end = text.indexOf("\n", at);
        const line = text.slice(at, end === -1 ? text.length : end);
        at = end === -1 ? text.length : end + 1;
        const compared = heredoc.stripTabs ? line.replace(/^\t+/, "") : line;
        if (compared === heredoc.delimiter) break;
        body.push(compared);
      }
      heredoc.bodies.push(body.join("\n"));
    }
    pendingHeredocs = [];
  };

  while (at < text.length) {
    const char = text[at] ?? "";
    const next = text[at + 1] ?? "";
    if (char === "\n") {
      at += 1;
      endCommand();
      skipHeredocs();
      continue;
    }
    if (char === " " || char === "\t") {
      endWord();
      at += 1;
      continue;
    }
    if (char === "#" && !started) {
      while (at < text.length && text[at] !== "\n") at += 1;
      continue;
    }
    if (char === "\\") {
      if (next === "\n") at += 2;
      else {
        word += next;
        started = true;
        at += 2;
      }
      continue;
    }
    if (char === "'") {
      const end = text.indexOf("'", at + 1);
      const close = end === -1 ? text.length : end;
      word += text.slice(at + 1, close);
      started = true;
      at = close + 1;
      continue;
    }
    if (char === "$" && next === "'") {
      const close = closingAnsiQuote(text, at + 2);
      word += text.slice(at + 2, close).replace(/\\(.)/g, "$1");
      started = true;
      at = close + 1;
      continue;
    }
    if (char === '"') {
      const [value, after] = doubleQuoted(text, at + 1, substitution);
      word += value;
      started = true;
      at = after;
      continue;
    }
    if (char === "$" && next === "(") {
      const close = balanced(text, at + 2);
      substitution(text.slice(at + 2, close));
      word += text.slice(at, close + 1);
      started = true;
      at = close + 1;
      continue;
    }
    if (char === "`") {
      const close = backtick(text, at + 1);
      substitution(text.slice(at + 1, close));
      word += text.slice(at, close + 1);
      started = true;
      at = close + 1;
      continue;
    }
    if (char === ">" || char === "<" || (char === "&" && next === ">")) {
      const fdWord = started && /^\d+$/.test(word);
      if (fdWord) {
        word = "";
        started = false;
      } else endWord();
      const op = operator(text, at);
      at += op.length;
      if (op === "<<" || op === "<<-") heredocOp = { stripTabs: op === "<<-" };
      else pendingRedirect = true;
      continue;
    }
    if (char === ";" || char === "&" || char === "|" || char === "(" || char === ")") {
      endCommand();
      at += 1;
      continue;
    }
    word += char;
    started = true;
    at += 1;
  }
  endCommand();
  return commands;
}

function operator(text: string, at: number): string {
  for (const op of ["&>>", "<<<", "<<-", ">>", ">|", ">&", "&>", "<<", "<>", "<&"]) {
    if (text.startsWith(op, at)) return op;
  }
  return text[at] ?? ">";
}

/**
 * The value of a double-quoted string starting after its quote, and the index after the closing
 * quote; the script of each substitution inside goes to `substitution`.
 */
function doubleQuoted(
  text: string,
  start: number,
  substitution: (script: string) => void,
): [string, number] {
  let value = "";
  let at = start;
  while (at < text.length) {
    const char = text[at] ?? "";
    if (char === '"') return [value, at + 1];
    if (char === "\\") {
      const next = text[at + 1] ?? "";
      if (next === "\n") {
        at += 2;
        continue;
      }
      value += '$`"\\'.includes(next) ? next : `\\${next}`;
      at += 2;
      continue;
    }
    if (char === "$" && text[at + 1] === "(") {
      const close = balanced(text, at + 2);
      substitution(text.slice(at + 2, close));
      value += text.slice(at, close + 1);
      at = close + 1;
      continue;
    }
    if (char === "`") {
      const close = backtick(text, at + 1);
      substitution(text.slice(at + 1, close));
      value += text.slice(at, close + 1);
      at = close + 1;
      continue;
    }
    value += char;
    at += 1;
  }
  return [value, text.length];
}

/** Index of the `)` closing a `$(` whose content starts at `start`, quotes respected. */
function balanced(text: string, start: number): number {
  let depth = 1;
  let at = start;
  while (at < text.length) {
    const char = text[at] ?? "";
    if (char === "\\") at += 2;
    else if (char === "'") {
      const end = text.indexOf("'", at + 1);
      at = end === -1 ? text.length : end + 1;
    } else if (char === '"') at = doubleQuoted(text, at + 1, () => undefined)[1];
    else {
      if (char === "(") depth += 1;
      if (char === ")") {
        depth -= 1;
        if (depth === 0) return at;
      }
      at += 1;
    }
  }
  return text.length;
}

function backtick(text: string, start: number): number {
  let at = start;
  while (at < text.length) {
    if (text[at] === "\\") at += 2;
    else if (text[at] === "`") return at;
    else at += 1;
  }
  return text.length;
}

function closingAnsiQuote(text: string, start: number): number {
  let at = start;
  while (at < text.length) {
    if (text[at] === "\\") at += 2;
    else if (text[at] === "'") return at;
    else at += 1;
  }
  return text.length;
}
