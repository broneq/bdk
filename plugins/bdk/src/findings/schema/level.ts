import { z } from "zod";

import { LEVELS } from "../domain/events.ts";

/** `bdk findings level --json`: the finding and its new level. */
export const levelResult = z.object({ id: z.string(), level: z.enum(LEVELS) });

export type LevelResult = z.infer<typeof levelResult>;
