// Loading `node:sqlite` for the databases of `shared/store`: the rebuildable
// index and the agent registry. Imported on first open only, so commands that
// never touch a database never load it.
import type * as sqlite from "node:sqlite";

type EmitWarning = (warning: string | Error, ...rest: unknown[]) => void;

/**
 * Node 22.13 to 22.x print an ExperimentalWarning when `node:sqlite` loads.
 * Inject-mode wrappers merge stderr into the model's content (`2>&1`), so
 * exactly that warning is dropped; every other warning still prints.
 */
export async function loadSqlite(): Promise<typeof sqlite> {
  const original: unknown = Reflect.get(process, "emitWarning");
  process.emitWarning = withoutSqliteWarning(process.emitWarning.bind(process) as EmitWarning);
  try {
    return await import("node:sqlite");
  } finally {
    Reflect.set(process, "emitWarning", original);
  }
}

/** `emit` without the SQLite ExperimentalWarning. */
export function withoutSqliteWarning(emit: EmitWarning): EmitWarning {
  return (warning, ...rest) => {
    const [options] = rest;
    const type =
      typeof options === "string" ? options : (options as { type?: string } | undefined)?.type;
    const message = typeof warning === "string" ? warning : warning.message;
    if (type === "ExperimentalWarning" && message.includes("SQLite")) return;
    emit(warning, ...rest);
  };
}
