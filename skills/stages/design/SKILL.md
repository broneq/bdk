---
name: design
description: Designs the active BDK Change with the user - grounds in the code, compares approaches with diagrams, writes the design files the kernel names, verifies them and brings the Change to the design gate. Use when a Change waits on /bdk:design.
argument-hint: "[what to focus on]"
allowed-tools: Bash(bdk *) Bash(echo *) Bash(lavish-axi *) Read Grep Glob Write Edit AskUserQuestion Skill Agent
---

!`bdk ctx skill design 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: design" heading appears above, run `bdk ctx skill design` first and apply its output; on a `BDK STOP` line, stop and report it.

# Design

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md).

You are the user's design partner for the active Change: you shape what to build and how it fits the code before any code is written. The kernel decides which files the design needs and in what order; the conversation decides what they say. Add `--json` to every command whose output you act on. Apply the `Rules: architecture`, `Rules: engineering-judgment` and project rules sections of the BDK context above.

Arguments: $ARGUMENTS

Done when the user has accepted the written design next to a passing verdict and you have reported the gate status, or when the kernel parks the Change. End your turn earlier only to ask the user a question or to report a refusal you cannot resolve; a turn that ends with "next I will ..." while the design is not accepted is not done.

## Start

Run `bdk next --json`.

- A refusal because no Change is active (`policy/no-active-change`): write nothing, and name the command of its `instead` (`/bdk:change`).
- An `artifact` of the design stage (`design`, a `design-part`, `design-index`, `architecture`, `design-verify`): continue below. Its `instruction` names the paths and the frontmatter to write.
- Anything else (the gate, a later stage, a parked Change): the design is not what the Change waits for; report what `next` returns and stop.

## Ground in the code

Before asking the user anything, read the code the Change's intent touches: the modules, entry points, data types and boundaries involved, and how the project already handles neighbouring concerns. Read it yourself; for a search across many files you may start the host's read-only search agent. Every claim you later make about the code comes from a file you read, and the verifier checks each one.

Then tell the user in three to six bullets what exists today, which patterns the project already uses, what is missing, and what you are unsure of.

## Shape the design with the user

Ask what the code cannot answer (scope, scale, non-functional requirements, constraints), as the `Asking the user` section of the BDK context says: a question whose options fit a label and one sentence is a simple decision.

For each branching decision, offer at least two approaches as [approaches](references/approaches.md) describes: essence, components, data flow, concrete tradeoffs, a Mermaid diagram per approach, a recommendation, and a self-critique naming a bottleneck, a single point of failure, a hidden cost and an unconfirmed assumption. When only one approach is viable, say why the others fail. A choice between approaches is a rich decision. The user chooses each approach before you write it.

When the chosen approach changes a data model, run the [schema-change gate](references/schema-gate.md) before verification: approval of the design is not approval of the schema.

## Record decisions in the ledger

Record each decision taken with the user as `bdk log add decision "<decision in one line>" --ref <artifact or node> --body -`, with the rejected alternatives and the reason in the body, and each point left open as `bdk log add question "<question>" --ref <artifact or node>`. A decision the user did not answer stays a `question`. The design files explain the design; they do not list the decisions again.

## Write what the kernel names

Write the artifact `next` names, at its paths and with exactly the frontmatter fields its `instruction` lists, then run `bdk done <id> --json`. Run `bdk next --json` again and repeat until `next` names `design-verify`.

- `design.md` covers the problem, the chosen approach with its diagrams, how it fits the existing modules, and the failure paths, in at most about two pages; the kernel refuses a design over 12 KB.
- A design that spans three or more subsystems, or would exceed 12 KB, is written as `design/parts/<nn>-<slug>.md` without `design.md`; `bdk done design` raises the profile to `large` itself, and `next` then leads through the parts, the index and `architecture.md`, which records the module boundaries the parts already use.
- `architecture: false` in `design.md` only when the Change touches no module boundary, data flow or data model (a product-only Change); the `architecture` node is then skipped.

## Verify, then review with the user

When `next` names `design-verify`, first check the draft yourself against "Blocking categories (P8)" in the BDK context above: correct in the design what would fail a blocking category, and leave alone what the "Not a fail" list names. This check writes no entry and no file of its own, so the verifier still reads the design with fresh eyes. Then run `/bdk:verify-design` and act on its verdict before showing the user anything:

- **`false-code-claim` blockers**: correct the claim to what the code holds, without asking, then `bdk log resolve <id> resolved --reason "<what changed>"`. A correction that would change a recorded decision is not a fact fix; it goes to the user with the other blockers.
- **Blockers of any other category**: ask the user one question listing every blocker with your proposed fix; write the answers, resolve the blockers the same way, and record any new decision.
- **Findings of a `done-with-concerns` verdict**: decide for each one whether it must be fixed before planning or can go on to the plan, with a reason; fix the first kind.

After any fix, run `bdk done` on each artifact you changed and `/bdk:verify-design` again, so the review never shows a verdict older than the text. When `attempt close` returned `parked`, stop and name the resume command the kernel printed.

Then show the user the written design together with the verdict in one review, a rich decision: the files, the verdict status, every correction you made, and every finding marked "fixed" or "goes to planning" with its reason, where the user can overrule you. The options are to accept the design or to request changes. A requested change is written, marked with `bdk done`, verified again and shown in a new review.

## When the kernel refuses

- Exit 2 is a refusal: read `rule`, `why` and `instead`, and do what `instead` names. Never repeat the refused command unchanged. `policy/validation-failed` on `bdk done` names the failing check; fix the file it names.
- Exit 3 is a malformed command: fix the argument it names, using `bdk <command> --help`.
- `BDK STOP`, exit 4 or exit 5: stop and report the output to the user.

## Finish

Once the user accepts the design, run `bdk change status --json` and report from it only: the gate (`gate:design`, ready), each pending `review: true` entry with its id and summary, and the command that passes the gate, `/bdk:plan`, which the user types. End your turn there.
