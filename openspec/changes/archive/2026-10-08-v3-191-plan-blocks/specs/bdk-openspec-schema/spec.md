## MODIFIED Requirements

### Requirement: Plan parts are files with frontmatter

The `plan` artifact SHALL generate one file per part, `plan/parts/NN.md`, where `NN` is a two-digit number starting at `01`. Each part SHALL begin with YAML frontmatter holding:

- `id`: the part's file stem `NN`, as a quoted string;
- `depends-on`: a list of the ids of other parts of the same Change that must be done before this one, empty when none;
- `isolation`: `worktree` when the part runs in its own git worktree, or `shared` when it runs in the Change checkout;
- `files`: a list of the repository-relative paths of the files the part creates, changes or deletes, each an exact file path, never a glob or a directory.

After the frontmatter, a part SHALL hold its goal, its acceptance scenarios taken from the Change's spec deltas, and its tasks as contracts. The part template and the plan instruction SHALL state this format.

Under `## Tasks`, each task SHALL be one numbered item whose first line says what changes, followed by three labelled lines: `File:` naming one or more paths from the part's `files`, `Interface:` naming the function, command, endpoint or type that changes as a signature without code (`Interface: none` when no interface changes), and `Verified by:` naming the spec scenario, the test, or both. The part template and the plan instruction SHALL show these three lines.

#### Scenario: Template carries the frontmatter

- **WHEN** the part template of the shipped schema is read
- **THEN** it begins with YAML frontmatter that has the keys `id`, `depends-on`, `isolation` and `files`, with `id` a quoted two-digit string and `isolation` one of `worktree` and `shared`

#### Scenario: Template carries the task contract

- **WHEN** the part template of the shipped schema is read
- **THEN** its `## Tasks` section shows a numbered task followed by the lines `File:`, `Interface:` and `Verified by:`

#### Scenario: Plan artifact done with one part

- **WHEN** `plan/parts/01.md` exists in a Change whose other artifacts exist
- **THEN** `openspec status` reports `plan` complete
