// The runtime floor (HOST-FACTS `node-sqlite-min`): `node:sqlite` without a
// flag arrived in 22.13.0 and 23.4.0; every line from 24 on has it.
import { refuse } from "../refusal/index.ts";
import type { Refusal } from "../refusal/index.ts";

const NODE_MINIMUM = "22.13.0";

/** The install line every Node refusal and `doctor` finding carries. */
const NODE_INSTALL = [
  "nvm install 24 && nvm use 24",
  "install Node 24 or newer from https://nodejs.org/",
] as const;

export function meetsNodeMinimum(version: string): boolean {
  const [major = 0, minor = 0] = version.replace(/^v/, "").split(".").map(Number);
  if (major >= 24) return true;
  if (major === 23) return minor >= 4;
  if (major === 22) return minor >= 13;
  return false;
}

export function nodeVersionRefusal(version: string): Refusal {
  return refuse(
    "runtime/node-version",
    `Node ${version} is below the minimum ${NODE_MINIMUM} (node:sqlite)`,
    NODE_INSTALL,
  );
}
