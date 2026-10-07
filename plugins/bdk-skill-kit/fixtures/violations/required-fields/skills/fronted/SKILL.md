---
name: fronted
description: Runs the tool that lints release notes. Use when release notes change.
allowed-tools: Read
metadata:
  fronts-cli: tool
---

Run the tool before committing release notes, and when CI reports a release-notes finding.

```sh
tool lint <file>
```

`tool --help` is the only usage reference: read it for flags and exit codes.
