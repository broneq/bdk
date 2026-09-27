// The statement rule of `bdk query` (`kernel-cli/query`): one statement that
// starts with SELECT or WITH. Pure: SQLite still compiles and runs it, in
// query-only mode, so this check only gives the caller a clear refusal.

export type Cell = string | number | null;

export interface QueryPage {
  readonly columns: readonly string[];
  readonly items: readonly (readonly Cell[])[];
  readonly total: number;
  readonly truncated: boolean;
}

/** Why the statement is refused, or undefined for one SELECT or WITH statement. */
export function statementProblem(sql: string): string | undefined {
  const statements = splitStatements(sql);
  const [first, ...rest] = statements;
  if (first === undefined) return "the statement is empty";
  if (rest.length > 0) {
    return `only a single statement is accepted; ${String(statements.length)} were given`;
  }
  const keyword = /^[A-Za-z]+/.exec(first)?.[0].toUpperCase() ?? first.slice(0, 20);
  if (keyword !== "SELECT" && keyword !== "WITH") {
    return `only a single SELECT is accepted; the statement starts with ${keyword}`;
  }
  return undefined;
}

/**
 * The statements of `sql` without comments, trimmed, empty ones dropped.
 * Semicolons inside string literals, quoted identifiers and comments do not
 * end a statement.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  while (i < sql.length) {
    const char = sql.charAt(i);
    const pair = sql.slice(i, i + 2);
    if (pair === "--") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
      current += " ";
    } else if (pair === "/*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      current += " ";
    } else if (char === "'" || char === '"' || char === "`" || char === "[") {
      const close = char === "[" ? "]" : char;
      let end = sql.indexOf(close, i + 1);
      // A doubled quote inside a literal is an escaped quote.
      while (end !== -1 && close !== "]" && sql.charAt(end + 1) === close) {
        end = sql.indexOf(close, end + 2);
      }
      const stop = end === -1 ? sql.length : end + 1;
      current += sql.slice(i, stop);
      i = stop;
    } else if (char === ";") {
      statements.push(current);
      current = "";
      i++;
    } else {
      current += char;
      i++;
    }
  }
  statements.push(current);
  return statements.map((statement) => statement.trim()).filter((statement) => statement !== "");
}
