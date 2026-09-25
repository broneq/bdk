# P2 graph operations (design D-6)

code-review-graph 2.3.9 on one worktree of the vibe-kanban snapshot (`wt/p2`, 1193 parsed files), run one at a time by `p2.sh` under `/usr/bin/time -l`. Changed files are uncommitted edits (one exported constant appended) to the first 1 or 20 `packages/web-core/src/*.ts` files; after each changed-file update the edit is reverted and the graph updated back, unmeasured. `update` with no flag is what v2.6.0's `Stop` hook ran after every reply. Host load average 9-19 from other work during the run. Raw output with the full `time -l` block: `results/p2/<op>.txt`; the table is `results/p2/summary.jsonl`.

| operation | wall s | CPU s (user + sys) | peak RSS MB | graph.db MB after | graph output |
|---|---|---|---|---|---|
| `build` | 12.25 | 20.51 | 176.8 | 181.6 | Full build: 1193 files, 9166 nodes, 77644 edges (postprocess=full) |
| `update-nochange` | 1.27 | 0.48 | 54.5 | 181.6 | Incremental: 0 files updated, 0 nodes, 0 edges (postprocess=full) |
| `update-1file` | 1.15 | 0.97 | 71.9 | 181.6 | Incremental: 1 files updated, 8 nodes, 42 edges (postprocess=full) |
| `update-20files` | 1.61 | 1.35 | 72.9 | 181.9 | Incremental: 20 files updated, 91 nodes, 743 edges (postprocess=full) |
| `build-skip-flows` | 9.19 | 17.81 | 96.0 | 177.6 | Full build: 1193 files, 9166 nodes, 77644 edges (postprocess=minimal) |
| `update-nochange-skip-flows` | 1.99 | 0.69 | 54.8 | 177.6 | Incremental: 0 files updated, 0 nodes, 0 edges (postprocess=minimal) |
| `update-1file-skip-flows` | 1.11 | 0.78 | 68.2 | 177.7 | Incremental: 1 files updated, 8 nodes, 42 edges (postprocess=minimal) |
| `update-20files-skip-flows` | 1.47 | 1.16 | 68.0 | 180.1 | Incremental: 20 files updated, 91 nodes, 743 edges (postprocess=minimal) |
| `postprocess` | 1.61 | 1.46 | 170.2 | 180.8 | Post-processing: 984 flows, 27 communities, 9077 FTS entries |

Notes:

- A single incremental update is cheap here: about 1-2 s wall and under 1.5 CPU s, even with 20 changed files; `--skip-flows` (`postprocess=minimal`) saves little on an update; on a full build it halves peak RSS (96 vs 177 MB). A full build is about 12 s wall, 20 CPU s, 177 MB peak RSS, and a 178-182 MB database per worktree.
- So the v2.6.0 field report (30-60% CPU for 3-4 minutes under 8 parallel sessions) is not explained by one update's own cost. Candidate causes, not measured here: an update after every reply in every session, `uvx` resolution and Python start-up per update, endpoint security scanning the files each update reads, and concurrent writers on one database when sessions share a repository. P3 with the `Stop` variant is the measurement for it.
