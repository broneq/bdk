// `design.md`, `architecture.md`, `design/parts/<nn>-<slug>.md` and the
// generated `design/index.md` (`kernel-state`, Design artifacts and design index).
import * as z from "zod";

import type { DocumentKind } from "./common.ts";
import { partId } from "./plan.ts";

const VERSION = 1;

export const designKind = {
  name: "design",
  version: VERSION,
  schema: z
    .strictObject({ schema: z.literal(VERSION), title: z.string().min(1) })
    .meta({ title: "Design artifact", description: "`design.md` and `architecture.md`." }),
  migrations: [],
} as const satisfies DocumentKind;

export const designPartKind = {
  name: "design-part",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      id: partId,
      title: z.string().min(1),
      "depends-on": z.array(partId),
    })
    .meta({ title: "Design part" }),
  migrations: [],
} as const satisfies DocumentKind;

export const designIndexKind = {
  name: "design-index",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      generated: z.literal(true),
      parts: z.array(
        z.strictObject({ id: partId, title: z.string().min(1), "depends-on": z.array(partId) }),
      ),
    })
    .meta({ title: "Design index", description: "Generated from the design parts; never edited." }),
  migrations: [],
} as const satisfies DocumentKind;
