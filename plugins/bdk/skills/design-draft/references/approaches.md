# Approaches and self-critique

How `design-draft` weighs a branching decision before it recommends one answer.

## One approach

- **Essence**: one sentence.
- **Components**: the modules involved, what each owns, where the boundaries run. Name the modules the code already has; mark a new one as new.
- **Data flow**: how data moves on the happy path and on the main failure path.
- **Trade-offs**: concrete and in the project's units ("one more file read per export", "every caller changes its import"), across behaviour for the user, failure handling, coupling, operational cost and evolution. Build cost is stated, not weighed: prefer quality, simplicity, robustness and long-term maintainability.
- **Diagram**: a Mermaid diagram when the approaches differ in shape; the same diagram type for each, so they compare side by side.

Then one recommendation with its reason, tied to what the proposal, the code or the user said.

## Self-critique of the recommendation

Answer with specifics ("the export holds the whole range in one string; at about 100 000 entries it passes 10 MB"), never "could be a concern". Cover at least one of each:

- **Bottleneck or limit**: what every call passes through; what saturates at ten times today's load.
- **Failure mode or operational risk**: what happens when a dependency, a write or the input fails; what the user sees and can do.
- **Hidden cost**: duplicated data, a second source of truth, two components that must agree, something new the maintainer must understand.
- **Unconfirmed assumption**: scale, format, consistency or behaviour the user did not confirm.

Each answer lands in `design.md` under "Risks / Trade-offs" as `[risk] -> mitigation`, or as an open decision for the user.

## When only one approach is viable

Say so, and give for each alternative you considered the constraint or code it breaks.
