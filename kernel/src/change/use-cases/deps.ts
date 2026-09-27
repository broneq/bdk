// What the change use cases work on: the graph slice's dependencies (the log
// slice's, the plugin root and the configuration registry), so status, new,
// resume and list read the Change through its graph.
import type { GraphDeps } from "../../graph/index.ts";

export type ChangeDeps = GraphDeps;
