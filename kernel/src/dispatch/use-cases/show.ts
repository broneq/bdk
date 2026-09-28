// `bdk dispatch show <ticket|path>` (`kernel-cli/dispatch`): an agent reads
// its package through the kernel, byte for byte, never touching `.bdk/`.
import { isAbsolute, join, posix, relative, sep } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { activePackage, readDocument } from "../../shared/store/index.ts";
import type { ShowReport } from "../domain/report.ts";
import type { DispatchDeps } from "./deps.ts";

const TICKET = /^A-[0-9a-z]{8}$/;

export function showPackage(
  deps: DispatchDeps,
  change: ActiveChange,
  cwd: string,
  value: string,
): ShowReport | Refusal {
  const dir = join(change.dir, "dispatch");
  const path = TICKET.test(value)
    ? ticketPackage(deps, change, value)
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
      TICKET.test(value)
        ? `ticket ${value} has no dispatch package in ${change.id}`
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

/** The ticket's active package (T23-D42): the one its last `dispatch build` stamped. */
function ticketPackage(
  deps: DispatchDeps,
  change: ActiveChange,
  ticket: string,
): string | undefined {
  const active = activePackage(deps.store, change.projectRoot, change.dir, ticket);
  return active === undefined ? undefined : join(change.projectRoot, active.path);
}
