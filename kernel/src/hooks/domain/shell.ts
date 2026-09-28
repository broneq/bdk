// The command reader of `hooks pre-tool` (`kernel-cli/hooks`, Pre-tool command
// reading; T24 design D-2): a Bash command becomes simple commands with their
// words and redirections, so the guards look at command words and never at
// text inside a quoted argument or a heredoc body. Best effort for a careless
// model: `$(...)`, backticks, aliases and functions stay opaque.

interface Redirect {
  /** `>`, `>>`, `>|`, `&>`, `&>>`, `<>`, `>&`, `<`, `<&`, `<<<`; heredocs are not listed. */
  readonly op: string;
  readonly target: string;
}

export interface SimpleCommand {
  readonly words: readonly string[];
  readonly redirects: readonly Redirect[];
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
]);

const SHELLS = new Set(["sh", "bash", "zsh", "dash"]);

/** Nested `sh -c` and `eval` strings are read this many levels deep. */
const MAX_DEPTH = 3;

interface Heredoc {
  readonly delimiter: string;
  readonly stripTabs: boolean;
}

/** Every simple command of `text`, nested `sh -c` / `eval` strings included after their parent. */
export function readCommands(text: string, depth = 0): SimpleCommand[] {
  const commands = lex(text);
  if (depth >= MAX_DEPTH) return commands;
  return commands.flatMap((command) => {
    const nested = nestedScript(command);
    return nested === undefined ? [command] : [command, ...readCommands(nested, depth + 1)];
  });
}

/**
 * The words from the command word on: leading assignments and the wrappers
 * `env`, `command`, `exec`, `time`, `nice`, `nohup` and `sudo` dropped.
 * Empty for `command -v` / `-V`, which only look a name up.
 */
export function commandWords(command: SimpleCommand): readonly string[] {
  const words = command.words;
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
        at += words[at] === "-u" || words[at] === "-C" || words[at] === "-S" ? 2 : 1;
      }
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

function nestedScript(command: SimpleCommand): string | undefined {
  const words = commandWords(command);
  const name = basename(words[0] ?? "");
  if (name === "eval") return words.length > 1 ? words.slice(1).join(" ") : undefined;
  if (!SHELLS.has(name)) return undefined;
  for (let at = 1; at < words.length; at += 1) {
    const word = words[at] ?? "";
    if (!word.startsWith("-")) return undefined;
    if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(word)) return words[at + 1];
  }
  return undefined;
}

/** The lexer proper: one pass over `text`. */
function lex(text: string): SimpleCommand[] {
  const commands: SimpleCommand[] = [];
  let words: string[] = [];
  let redirects: Redirect[] = [];
  let word = "";
  let started = false;
  /** The operator waiting for its target word. */
  let pendingOp: string | undefined;
  let pendingHeredocs: Heredoc[] = [];
  let heredocOp: { stripTabs: boolean } | undefined;
  let at = 0;

  const endWord = (): void => {
    if (!started) return;
    if (heredocOp !== undefined) {
      pendingHeredocs.push({ delimiter: word, stripTabs: heredocOp.stripTabs });
      heredocOp = undefined;
    } else if (pendingOp !== undefined) {
      redirects.push({ op: pendingOp, target: word });
      pendingOp = undefined;
    } else if (!(words.length === 0 && LEADING.has(word))) {
      words.push(word);
    }
    word = "";
    started = false;
  };
  const endCommand = (): void => {
    endWord();
    pendingOp = undefined;
    heredocOp = undefined;
    if (words.length > 0 || redirects.length > 0) commands.push({ words, redirects });
    words = [];
    redirects = [];
  };
  const skipHeredocs = (): void => {
    for (const heredoc of pendingHeredocs) {
      while (at < text.length) {
        const end = text.indexOf("\n", at);
        const line = text.slice(at, end === -1 ? text.length : end);
        at = end === -1 ? text.length : end + 1;
        const compared = heredoc.stripTabs ? line.replace(/^\t+/, "") : line;
        if (compared === heredoc.delimiter) break;
      }
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
      const [value, after] = doubleQuoted(text, at + 1);
      word += value;
      started = true;
      at = after;
      continue;
    }
    if (char === "$" && next === "(") {
      const close = balanced(text, at + 2);
      word += text.slice(at, close + 1);
      started = true;
      at = close + 1;
      continue;
    }
    if (char === "`") {
      const close = backtick(text, at + 1);
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
      else pendingOp = op;
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

/** The value of a double-quoted string starting after its quote, and the index after the closing quote. */
function doubleQuoted(text: string, start: number): [string, number] {
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
      value += text.slice(at, close + 1);
      at = close + 1;
      continue;
    }
    if (char === "`") {
      const close = backtick(text, at + 1);
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
    } else if (char === '"') at = doubleQuoted(text, at + 1)[1];
    else {
      if (char === "(") depth += 1;
      if (char === ")") {
        depth -= 1;
        if (depth === 0) return at;
      }
      at += 1;
    }
  }
  return text.length - 1;
}

function backtick(text: string, start: number): number {
  let at = start;
  while (at < text.length) {
    if (text[at] === "\\") at += 2;
    else if (text[at] === "`") return at;
    else at += 1;
  }
  return text.length - 1;
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
