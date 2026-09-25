# Tasks

## 1. Start and baseline

- [x] 1.1 Set issue #47's card to "In progress" on the project board and verify the board shows it
- [x] 1.2 Create `docs/V3-SKILL-INVENTORY.md` with the eleven section headings from design D-1 and the Criteria section (D-2, D-3) filled in; verify the headings match D-1 in order
- [x] 1.3 Record the Baseline section: commit hash and the exact counting commands (skills by `user-invocable`, agents, `SKILL.md` lines, `references/` size, `!` blocks, frontmatter hooks, `allowed-tools`); verify re-running the commands reproduces 16 user skills, 13 meta-skills, 13 agents
- [x] 1.4 Correct the inventory counts in the T02 Goal of `docs/V3-IMPLEMENTATION-PLAN.md` and in the body of issue #47 to the observed numbers; verify both show 16 / 13 / 13

## 2. User skills

- [x] 2.1 For each of the 16 user skills, read `SKILL.md` and `references/`, classify sections per D-3 and fill the evidence columns (lines, `references/` size, `!` blocks, hooks, `allowed-tools`, process share) with file:line citations; verify all 16 rows have every evidence column filled
- [x] 2.2 Write the disposition, target name, rationale and target task for each user skill per D-2; verify every row has exactly one disposition and one target task (T41, T42 or T32)
- [x] 2.3 Write the Merge and rename candidates section for the five candidates (for / against / recommendation each); verify each recommendation matches the corresponding skill rows

## 3. Meta-skills and roles

- [x] 3.1 Fill the meta-skill table (13 rows): lines, consumers from each agent's `skills:` frontmatter, disposition; verify consumer lists match `grep` over `agents/*.md`
- [x] 3.2 Write the agent -> `bdk-role-<class>` mapping with what each agent loses and gains; verify all 13 agents are mapped to exactly one of the five classes and every current preload is accounted for

## 4. Agents

- [x] 4.1 Fill the agent table (13 rows): model, verbatim `tools:`, preloads, input / output contract changes, disposition, target task; verify `tools:` cells match frontmatter byte for byte
- [x] 4.2 Run the P3 and T3 checks from design D-5 and record each hit with its file:line and judgement; verify every agent row states "none" or cites at least one hit for both columns

## 5. Cross-cutting sections

- [x] 5.1 Write the `cr` / `pr-review` package-input section against the design's "Dispatch package (K3, K4)" section; verify it proposes no change to either skill's review logic
- [x] 5.2 Write the T40 A/B subject recommendation per D-6 with the process-share numbers from section 2; verify the choice is a skill whose v3 counterpart is a T41 stage skill
- [x] 5.3 Review `.claude/skills/skill-lint` and `agent-lint` and classify each check as CI content test (A3) / stays dev-time / dropped; verify every check in both files appears once
- [x] 5.4 Write Side findings (defects outside T02, each tagged with a task ID), including any disagreement between the design's "Existing Codebase Context" and the code; verify each finding has a task ID
- [x] 5.5 Write Open decisions as `OD-n` (question / options / recommendation / affected task), including every `tools:` change proposal and every disposition the review is unsure of; verify each has a recommendation

- [x] 5.6 Record the user's review decisions (sections 11-13) and carry their plan impact into `docs/V3-IMPLEMENTATION-PLAN.md` (T02 Resolution, new T14 and T15 with graph edges, revised downstream tasks per section 13.3); open issues #66 (T14) and #67 (T15); verify every row of section 13.3 has a matching plan edit

## 6. Acceptance

- [x] 6.1 Check the acceptance signal end to end: the skills table has skill / lines today / disposition / rationale / target task for all 16 skills, the same exists for all 13 agents and 13 meta-skills, and the open-decisions list is non-empty with a recommendation per item
- [x] 6.2 Check repository conventions on the new and edited files: English only, no em dash, Mermaid (if any) uses the `/bdk:mermaid-drawer` palette; verify with `grep` for the em dash character returning nothing
- [x] 6.3 Run `openspec validate v3-t02-review-of-the-skill --strict` and verify it passes
