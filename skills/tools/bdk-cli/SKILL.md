---
name: bdk-cli
description: Runs the BDK kernel CLI for Change state, the ledger, rules, evidence and configuration. Use when you need a fact about the active Change, its entries or rules, or to record or check one, outside a stage skill that already names the command.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *)
metadata:
  fronts-cli: bdk
---

# BDK CLI

The kernel holds every fact BDK keeps: the state of the active Change, the ledger of entries, the rules, the evidence and the configuration. Ask it instead of reading or editing `.bdk/` files, which are its storage.

Call it as:

    node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <group> <verb> --json

`bdk` in BDK's skills and messages means this command. Add `--json` whenever you act on the output; a refusal then carries its rule and a `why`.

`bdk --help` lists the groups, and `bdk <group> --help` or `bdk <group> <verb> --help` is the only usage reference: read it for arguments, flags and exit codes.
