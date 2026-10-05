// `bdk dispatch show <ticket|path>` (`kernel-cli/dispatch`): an agent reads
// its package through the kernel, byte for byte, never touching `.bdk/`. A
// ticket resolves to the package of its working agent, else its active
// package (T23-D42, #133), `<ticket>@<group>` to the package of that review
// group (T42-A1).
import { isAbsolute, join, posix, relative, sep } from "node:path";

import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { readDocument, resolveTicketRef } from "../../shared/store/index.ts";
import type { ShowReport } from "../domain/report.ts";
import type { DispatchDeps } from "./deps.ts";

/** A ticket id with an optional `@<group>`; the group's grammar is the resolver's. */
const TICKET = /^A-[0-9a-z]{8}(?:@.*)?$/;

export async function showPackage(
  deps: DispatchDeps,
  change: ActiveChange,
  cwd: string,
  value: string,
): Promise<ShowReport | Refusal> {
  const dir = join(change.dir, "dispatch");
  const resolved = TICKET.test(value)
    ? await resolveTicketRef(deps, change.projectRoot, change.dir, value)
    : undefined;
  if (resolved !== undefined && isRefusal(resolved)) return resolved;
  const path = resolved
    ? resolved.package === undefined
      ? undefined
      : join(change.projectRoot, resolved.package.path)
    : isAbsolute(value)
      ? value
      : join(cwd, value);
  const inside = path === undefined ? "" : relative(dir, path);
  const content =
    path === undefined || inside === "" || inside.startsWith("..") || inside.includes(sep)
      ? undefined
      : deps.store.read(path);
  const document =
    path === undefined || content === undefined ? undefined : readDocument(deps.store, path);
  if (
    path === undefined ||
    content === undefined ||
    document === undefined ||
    !("data" in document)
  ) {
    return refuse(
      "input/not-found",
      resolved !== undefined
        ? `${resolved.group === undefined ? "ticket" : "group"} ${value} has no dispatch package in ${change.id}`
        : `${value} is not a package under ${posix.relative(change.projectRoot, dir)}/`,
      ["bdk dispatch show <ticket>", "bdk attempt list"],
    );
  }
  return {
    path: posix.relative(change.projectRoot, path),
    content,
    frontmatter: document.data,
  };
}
