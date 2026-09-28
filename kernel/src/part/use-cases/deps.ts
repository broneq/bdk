// What the part use cases work on: the graph slice's dependencies (store,
// git, index opener, clock, plugin files, settings registry), since every
// part command reads the Change's graph.
import type { GraphDeps } from "../../graph/index.ts";

export type PartDeps = GraphDeps;
