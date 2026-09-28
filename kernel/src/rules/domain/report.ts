// What `rules show --ticket` reports (`kernel-cli/rules`): the ticket's role
// and target, the rule sections in print order and the `rules-read` stamp.

interface ShownSection {
  readonly key: string;
  readonly file: string;
  readonly layers: readonly ("default" | "global" | "project" | "local")[];
  readonly text: string;
}

export interface TicketRules {
  readonly ticket: string;
  readonly role: string;
  readonly target: string;
  readonly sections: readonly ShownSection[];
  readonly rulesRead: string;
}
