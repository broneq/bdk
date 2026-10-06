**Decision tier: lavish**

This project has `features.lavish` on and `lavish-axi` on PATH. Pick the surface by the shape of the decision, not by the setting:

- **Simple decision**: every option fits a label and one sentence ("new branch or the current one", "keep these commands"). Ask it with `AskUserQuestion` in the terminal, never through Lavish.
- **Rich decision**: an option needs a diagram, a side-by-side comparison, a schema delta or an annotated draft to be judged (the approaches of a design, the review of a draft). Ask it through a Lavish page.

Either way: bundle every open decision of the moment into one ask, put the recommended option first with the tradeoff of each option, and treat a decision the user did not answer as still open. It never leaks into the output as if it were made.

Procedure for a rich decision:

1. Once per session, read `lavish-axi --help` and the playbooks it lists for comparisons and for collecting input. Use only commands and flags that `--help` prints: the binary is versioned outside this plugin.
2. Write the page under `.lavish/` in the project: each option with its diagram or draft, the recommendation and the tradeoffs, and an input for every open decision. Give each ask a file name no earlier ask used, such as one ending in the output of `date +%Y%m%d-%H%M%S`: Lavish never reopens a path whose session the user ended, even after the file is written again.
3. Open it with `lavish-axi <file>`, then wait with `lavish-axi poll <file>` in the foreground until the reply arrives. Read the whole reply.
4. Continue with the selections. An edit the user asks for on the page is a new draft: write it, then ask again.

**Fall back on any failure.** A non-zero exit, a reply that does not parse, or a session the user ended before answering leaves the decision open: ask the same decision with `AskUserQuestion` in the terminal, printing the comparison first. Never reopen a session the user ended, and never report a decision as made because the tool ran.
