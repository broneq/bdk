# execute A/B results

Series: series-2026-09-29, series-2026-09-29-2. Counted runs: v2 5, v3-long 5, v3-long-prime 5, v3-thin 5. Discarded: 8.

## Per cell: median [min..max]

| metric | v2 | v3-long | v3-long-prime | v3-thin |
| --- | --- | --- | --- | --- |
| acceptance | 1 [1..1] | 1 [1..1] | 1 [1..1] | 1 [0.75..1] |
| completeness | 0.76 [0.76..0.88] | 1 [1..1] | 1 [1..1] | 1 [0.50..1] |
| cost | 3.90 [3.04..4.42] | 1.59 [1.55..1.64] | 1.60 [1.52..1.72] | 1.56 [0.88..1.62] |
| turns | 56 [37..72] | 36 [33..38] | 37 [36..40] | 43 [26..44] |
| wall_s | 661.52 [466.83..939.07] | 470.54 [444.86..702.47] | 496.10 [474.03..582.24] | 480.31 [252.64..522.70] |
| kernel_calls | n/a | 68 [62..73] | 73 [70..76] | 70 [38..72] |
| exit3 | n/a | 1 [0..2] | 3 [2..3] | 3 [1..4] |
| exit2 | n/a | 4 [4..5] | 5 [4..6] | 4 [3..6] |
| envelope_bytes | n/a | 369 [355.25..407.08] | 356.92 [320.50..392] | 307.92 [275..396.50] |
| rubric | 1 [1..1] | 1 [1..1] | 1 [1..1] | 1 [1..1] |

## Comparisons (difference rule: a gap counts when it exceeds the larger within-cell range)

| metric | A/A noise floor: v3-long vs v3-long-prime | T41 gate: v3-thin vs v3-long | kernel effect: v3-long vs v2 | total effect: v3-thin vs v2 |
| --- | --- | --- | --- | --- |
| acceptance | no difference (gap 0, noise 0) | no difference (gap 0, noise 0.25) | no difference (gap 0, noise 0) | no difference (gap 0, noise 0.25) |
| completeness | no difference (gap 0, noise 0) | no difference (gap 0, noise 0.50) | v3-long higher (gap 0.24, noise 0.12) | no difference (gap 0.24, noise 0.50) |
| cost | no difference (gap 0.01, noise 0.19) | no difference (gap 0.03, noise 0.74) | v2 higher (gap 2.32, noise 1.38) | v2 higher (gap 2.35, noise 1.38) |
| turns | no difference (gap 1, noise 5) | no difference (gap 7, noise 18) | no difference (gap 20, noise 35) | no difference (gap 13, noise 35) |
| wall_s | no difference (gap 25.57, noise 257.61) | no difference (gap 9.77, noise 270.06) | no difference (gap 190.99, noise 472.23) | no difference (gap 181.21, noise 472.23) |
| kernel_calls | no difference (gap 5, noise 11) | no difference (gap 2, noise 34) | n/a | n/a |
| exit3 | no difference (gap 2, noise 2) | no difference (gap 2, noise 3) | n/a | n/a |
| exit2 | no difference (gap 1, noise 2) | no difference (gap 0, noise 3) | n/a | n/a |
| envelope_bytes | no difference (gap 12.08, noise 71.50) | no difference (gap 61.08, noise 121.50) | n/a | n/a |
| rubric | no difference (gap 0, noise 0) | no difference (gap 0, noise 0) | no difference (gap 0, noise 0) | no difference (gap 0, noise 0) |

## Criterion

thin is no worse: T41 writes thin stage skills

## Discarded runs

- series-2026-09-29 v2 run 1: series stopped: v3 dispatch packages named the kernel as a literal ${CLAUDE_PLUGIN_ROOT} and sessions ran inside the BDK repository (fixed in 9cb936c and the sandbox)
- series-2026-09-29 v3-long run 1: series stopped: v3 dispatch packages named the kernel as a literal ${CLAUDE_PLUGIN_ROOT} and sessions ran inside the BDK repository (fixed in 9cb936c and the sandbox)
- series-2026-09-29 v3-long-prime run 1: series stopped: v3 dispatch packages named the kernel as a literal ${CLAUDE_PLUGIN_ROOT} and sessions ran inside the BDK repository (fixed in 9cb936c and the sandbox)
- series-2026-09-29 v3-thin run 1: series stopped: v3 dispatch packages named the kernel as a literal ${CLAUDE_PLUGIN_ROOT} and sessions ran inside the BDK repository (fixed in 9cb936c and the sandbox)
- series-2026-09-29 v2 run 2: series stopped: v3 dispatch packages named the kernel as a literal ${CLAUDE_PLUGIN_ROOT} and sessions ran inside the BDK repository (fixed in 9cb936c and the sandbox)
- series-2026-09-29 v3-long run 2: series stopped: v3 dispatch packages named the kernel as a literal ${CLAUDE_PLUGIN_ROOT} and sessions ran inside the BDK repository (fixed in 9cb936c and the sandbox)
- series-2026-09-29 v3-long-prime run 2: series stopped: v3 dispatch packages named the kernel as a literal ${CLAUDE_PLUGIN_ROOT} and sessions ran inside the BDK repository (fixed in 9cb936c and the sandbox)
- series-2026-09-29 v3-thin run 2: series stopped: v3 dispatch packages named the kernel as a literal ${CLAUDE_PLUGIN_ROOT} and sessions ran inside the BDK repository (fixed in 9cb936c and the sandbox)
