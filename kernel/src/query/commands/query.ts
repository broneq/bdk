import { capLines } from "../../shared/output/index.ts";
import { isRefusal } from "../../shared/refusal/index.ts";
import type { Handler } from "../../shared/registry/index.ts";
import { findProjectRoot } from "../../shared/store/index.ts";
import { renderQuery } from "../render/query.ts";
import { queryIndex } from "../use-cases/query.ts";
import type { QueryDeps } from "../use-cases/query.ts";

export function queryCommand(deps: QueryDeps): Handler {
  return async (context) => {
    const all = context.flags["--all"] === true;
    const projectRoot = findProjectRoot(deps.store, context.cwd, context.workTree ?? context.cwd);
    const page = await queryIndex(deps, projectRoot, context.positionals["<sql>"] ?? "", { all });
    return isRefusal(page) ? page : { data: page, text: capLines(renderQuery(page), { all }) };
  };
}
