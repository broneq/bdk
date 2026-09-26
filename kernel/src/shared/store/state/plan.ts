// `plan/parts/<nn>-<slug>.md` and the generated `plan/index.md` (`kernel-state`,
// Plan part and plan index). Tasks live in the part body (T21, T22).
import * as z from "zod";

import { glob } from "./common.ts";
import type { DocumentKind } from "./common.ts";

const VERSION = 1;

export const partId = z
  .string()
  .regex(/^\d{2}$/)
  .meta({ description: "Two digits, equal to `<nn>` of the file name." });

const capability = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/);

export const planPartKind = {
  name: "plan-part",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      id: partId,
      title: z.string().min(1),
      goal: z.string().min(1),
      "success-measure": z.string().min(1).meta({ description: "What a reviewer can observe." }),
      "do-not-touch": z.array(glob),
      "depends-on": z.array(partId),
      "spec-impact": z.union([z.literal("none"), z.array(capability)]),
    })
    .meta({ title: "Plan part" }),
  migrations: [],
} as const satisfies DocumentKind;

export const planIndexKind = {
  name: "plan-index",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      generated: z.literal(true),
      parts: z.array(
        z.strictObject({
          id: partId,
          title: z.string().min(1),
          "depends-on": z.array(partId),
          wave: z.int().min(1),
        }),
      ),
    })
    .meta({ title: "Plan index", description: "Generated from the plan parts; never edited." }),
  migrations: [],
} as const satisfies DocumentKind;
