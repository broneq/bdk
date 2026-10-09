## MODIFIED Requirements

### Requirement: Questions follow the policy and the session

`design-draft` SHALL ask the user only what the proposal, the code and the project configuration leave open, each question with the recommended answer first, in rounds: the first round asks every open decision; a later round asks only the decisions the previous answers opened (a free note that asks for something new, changes the scope, or contradicts a rule as "Scope changes and deviations in the design" says), and SHALL NOT ask an answered decision again. There SHALL be at most three rounds; a decision still open after the third SHALL take the recommended answer and be marked `Decided without the user:`. With `policy.questions: decide-and-record` it SHALL ask nothing, take the recommended answers, and mark each such decision in `design.md` with the line `Decided without the user:` followed by the reason.

Otherwise the designer SHALL write a Lavish page for the round (`.lavish/design-<change>.html` for the first, `.lavish/design-<change>-<round>.html` for a later one) and open it with `npx -y lavish-axi <page>`. When the page opens, the designer SHALL end its turn with the page path and the open decisions, and the thread that started it SHALL wait for the feedback with `npx -y lavish-axi poll <page>` in the foreground and continue the same designer with it (`SendMessage`). When the poll is interrupted or the user asks to stop waiting, that thread SHALL NOT poll again in that turn: it SHALL answer the user, name the page and the open decisions, and end its turn; a later run of the design stage for the Change SHALL poll the same page, whose queued feedback then arrives. When the open command fails, the designer SHALL end its turn with the open questions listed, the recommended answer first, and write nothing; the thread that started it SHALL ask them through `AskUserQuestion` and continue the same designer with the answers (`SendMessage`), or start a new designer whose arguments carry the answers. When `AskUserQuestion` is not available either, that thread SHALL list the questions in its reply and end it with one line saying how to answer. No spec delta and no `design.md` SHALL be written before the open questions are answered. The designer and the thread that started it SHALL run each Lavish command (`playbook`, open, `poll`) as a Bash command of its own, with no `;`, `&&`, pipe or `echo` around it: the tool result carries the exit code, and a compound command falls outside the grant `Bash(npx -y lavish-axi *)`.

#### Scenario: Lavish opens

- **WHEN** `policy.questions` is `stop`, a decision is open, and `npx -y lavish-axi <page>` opens the page and its poll returns "use a semicolon as the delimiter"
- **THEN** the poll runs in the thread that started the designer, and the design and the spec delta use a semicolon as the delimiter

#### Scenario: Follow-up round

- **WHEN** the first round's feedback answers every question and adds the note "also let me pick the delimiter per export in the settings"
- **THEN** a second page `.lavish/design-<change>-2.html` asks only about that setting, no first-round question appears on it again, and the design uses both rounds' answers

#### Scenario: Lavish cannot open

- **WHEN** `policy.questions` is `stop`, a decision is open, `npx -y lavish-axi <page>` exits non-zero, and `AskUserQuestion` is not available
- **THEN** the reply lists the open questions with the recommended answer first, and no `design.md` is written

#### Scenario: Answers through the main thread

- **WHEN** `policy.questions` is `stop`, a decision is open, `npx -y lavish-axi <page>` exits non-zero, and the main thread has `AskUserQuestion`
- **THEN** the main thread asks the designer's questions with `AskUserQuestion`, and the designer writes `design.md` with the answers the user chose

#### Scenario: Decide and record

- **WHEN** `policy.questions` is `decide-and-record` and a decision is open
- **THEN** no question is asked, `design.md` is written, and the decision carries a `Decided without the user:` line

#### Scenario: Lavish commands run alone

- **WHEN** the designer opens a round's page and the thread that started it polls it
- **THEN** every Bash command that calls `lavish-axi` is that call alone, and none is denied for falling outside the grant `Bash(npx -y lavish-axi *)`
