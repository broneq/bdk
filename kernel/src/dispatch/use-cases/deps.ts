// What the dispatch use cases work on: the graph's dependencies (store, git,
// index, clock, plugin root, settings), since an artifact target's paths come
// from the graph (T23-D37).
import type { GraphDeps } from "../../graph/index.ts";

export type DispatchDeps = GraphDeps;
