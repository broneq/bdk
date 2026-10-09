## MODIFIED Requirements

### Requirement: Manual decision surfaces

When `policy.gates.review` is `manual` or absent, the block SHALL ask the user to decide every undecided finding in one ask, each finding shown with its level, place, summary and evidence, and the policy answer of the auto-mode table preselected as the recommendation. The choices SHALL be `fix`, `accept`, `defer`, and `defer` with an issue, which is an issue reference the user gives or an issue the user asks the block to create. The block SHALL ask through, in this order of preference:

1. a page under `.lavish/` that the model writes following the `lavish-axi` playbooks, opened and polled with `npx -y lavish-axi`, each Lavish command a Bash command of its own, with no `;`, `&&`, pipe or `echo` around it;
2. `AskUserQuestion`, when the page cannot open (the open command exits non-zero);
3. the reply, when `AskUserQuestion` is not available either: the findings as numbered questions with the recommendation marked, ending the turn without recording a decision.

A finding the user leaves unanswered SHALL stay undecided; the block SHALL NOT record a decision the user did not make, except that an explicit instruction to take the recommendations decides every finding it covers.

#### Scenario: Choices through a Lavish page

- **WHEN** triage runs in manual mode, `npx -y lavish-axi` opens the page, and the user's reply chooses `fix` for the `nice-to-have` finding and the recommendation for the rest
- **THEN** a page under `.lavish/` was written, and the log records `fix` for the `nice-to-have` finding and the policy answer for the other three

#### Scenario: No browser review

- **WHEN** triage runs in manual mode and `npx -y lavish-axi` exits non-zero on opening the page
- **THEN** the block asks with `AskUserQuestion` or in its reply, offers the choices with the recommendation marked, and records no decision the user has not made

#### Scenario: Lavish commands run alone

- **WHEN** triage runs in manual mode and opens and polls its page
- **THEN** every Bash command that calls `lavish-axi` is that call alone, and none is denied for falling outside the grant `Bash(npx -y lavish-axi *)`
