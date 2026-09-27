// `bdk query <sql>`: refreshes every Change of the project, then runs one
// read-only statement over the index (`kernel-cli/query`).
import { listPage } from "../../shared/output/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { refreshAll, selectReadOnly, withIndex } from "../../shared/store/index.ts";
import type { IndexOpener, Store } from "../../shared/store/index.ts";
import { statementProblem } from "../domain/query.ts";
import type { Cell, QueryPage } from "../domain/query.ts";

export interface QueryDeps {
  readonly store: Store;
  readonly openIndex: IndexOpener;
}

const INSTEAD = ['bdk query "select ..."', "bdk log resolve <id> <status> to change an entry"];

export function queryIndex(
  deps: QueryDeps,
  projectRoot: string,
  sql: string,
  options: { readonly all: boolean },
): Promise<QueryPage | Refusal> {
  const problem = statementProblem(sql);
  if (problem !== undefined)
    return Promise.resolve(refuse("input/invalid-argument", problem, INSTEAD));
  return withIndex(deps.openIndex, deps.store, projectRoot, (index) => {
    refreshAll(index);
    let result;
    try {
      result = selectReadOnly(index, sql);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return refuse("input/invalid-argument", `SQLite rejected the statement: ${reason}`, [
        "bdk query \"select name from sqlite_master where type in ('table', 'view')\"",
        ...INSTEAD,
      ]);
    }
    const page = listPage(
      result.rows.map((row) => row.map(cell)),
      { all: options.all },
    );
    return { columns: result.columns, ...page };
  });
}

/** SQLite values as JSON scalars: integers past 2^53 and blobs as text. */
function cell(value: unknown): Cell {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString("hex");
  throw new Error(`SQLite returned a ${typeof value} value`);
}
