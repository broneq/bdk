---
name: plugin-bin
description: Host probe. Tests whether a skill's ! block finds the plugin's bin/ on PATH and whether a bare-name rule plus an echo rule pre-approves the content-wrapper form.
allowed-tools: Bash(probe-bin *) Bash(echo *)
---

Probe skill `plugin-bin` loaded.

Block output: !`probe-bin skill 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

Report the block output above exactly as you see it, prefixed `PLUGIN-BIN=`, then stop.
