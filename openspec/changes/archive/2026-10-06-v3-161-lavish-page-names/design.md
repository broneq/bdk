# Design

## Context

`lavish-axi` keys a session by the page's path. After the user ends a session, opening the same path returns `status: user-ended` for good; T56's third acceptance run showed it (archived change `2026-10-06-v3-t56-setup-schema-coverage`, tasks 6.2). The fragment `fragments/decision/lavish.md` reaches every Lavish-on stage skill through `bdk ctx skill`.

## Decisions

### D1. The rule lives in the shared fragment, not in each skill

One sentence in step 2 of the fragment's procedure: write each page to a file name no earlier ask used, such as one ending in a `date +%Y%m%d-%H%M%S` stamp, because Lavish never reopens a path whose session was ended. Setup keeps its own `.lavish/bdk-setup-<stamp>.html`, since its page is copied from a reference file and its contract test reads that name.

- Alternative: a repository rule in `.claude/rules/skills.md`. Lost: it binds only authors of this repository, while the failure happens in user projects at run time, where only the fragment reaches the model.
- Alternative: a kernel command that hands out page paths. Lost: new machinery for one sentence of guidance; nothing else in the kernel tracks Lavish sessions.

### D2. "Apply" states dependencies, not steps

The writes stay a list of what to write and with which command, unnumbered, and two sentences before it name the orderings that matter: the v2 ignore rule before the first `bdk config set` (git would ignore `.bdk/settings.yaml`), and the lint run after the commands and the exclusions (there is nothing to run before, and the run checks the exclusions). The spec drops the full write order for the same two orderings.

- Alternative: keep the numbered list. Lost: it contradicts `.claude/rules/prompts.md` and implies an order among writes that have none.
- Alternative: prose paragraphs. Lost: each write carries its command; a list keeps them scannable without implying order.
