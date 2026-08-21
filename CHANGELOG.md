# Changelog

## [2.0.0](https://github.com/broneq/bdk/compare/v1.5.1...v2.0.0) (2026-08-21)


### ⚠ BREAKING CHANGES

* /bdk:execute-plan, /bdk:save-progress, /bdk:restore-progress, /bdk:create-tasks, /bdk:refactor, and /bdk:audit-prompt are removed. See the "Removed skills" table in README.md for replacements.

### Features

* rebuild plan pipeline on immutable plans + run manifest ([24d83bb](https://github.com/broneq/bdk/commit/24d83bb041c55350c7f96e8b8a22bbe07271f208))
* scope tests and lint to changed files during plan execution ([48b1304](https://github.com/broneq/bdk/commit/48b13042b9bc2786fe778f8ac814efc1a7b3f408))


### Bug Fixes

* close the four open findings from the pipeline audits ([8278c4d](https://github.com/broneq/bdk/commit/8278c4d4c7d67a9a0071acf5fe1e73563e8fc234))

## [1.5.1](https://github.com/broneq/bdk/compare/v1.5.0...v1.5.1) (2026-08-20)


### Bug Fixes

* **skills:** drop invalid Agent param, forbid agent polling ([f7b9e60](https://github.com/broneq/bdk/commit/f7b9e60ef49a14b89465eed03d43177c116e484d))
* **skills:** drop invalid Agent param, forbid agent polling ([04a7e6c](https://github.com/broneq/bdk/commit/04a7e6c6e558661db66299e49d9129241454b885))

## [1.5.0](https://github.com/broneq/bdk/compare/v1.4.0...v1.5.0) (2026-08-20)


### Features

* **rules:** add durability test, narrow-glob/skill verdicts, admissi… ([f9cfb5b](https://github.com/broneq/bdk/commit/f9cfb5be2443eeef5e29fd1bab77544b8a87ccbd))
* **rules:** add durability test, narrow-glob/skill verdicts, admission lints ([a37943c](https://github.com/broneq/bdk/commit/a37943c0a6e3dd54375ea4cc885f17467b5c8ae0))

## [1.4.0](https://github.com/broneq/bdk/compare/v1.3.1...v1.4.0) (2026-08-17)


### Features

* **rules:** add extract-to-owner trigger to design-patterns rules ([7eb0c7d](https://github.com/broneq/bdk/commit/7eb0c7d1582340be29ecc3834868d494df879239))
* **rules:** add extract-to-owner trigger to design-patterns rules ([1d1ab5a](https://github.com/broneq/bdk/commit/1d1ab5a34ccec6f3f8aaada5cf182c8499b5b196))

## [1.3.1](https://github.com/broneq/bdk/compare/v1.3.0...v1.3.1) (2026-08-13)


### Bug Fixes

* grant allowed-tools for plugin scripts to skills that call them ([a1bac0e](https://github.com/broneq/bdk/commit/a1bac0e9865659ffd122cdbcfca8f0183381914d))
* grant allowed-tools for plugin scripts to skills that call them ([1b08acc](https://github.com/broneq/bdk/commit/1b08acc0ff6f6a01853a3b9bee8689f174d509d3))

## [1.3.0](https://github.com/broneq/bdk/compare/v1.2.0...v1.3.0) (2026-08-13)


### Features

* add /bdk:add-rule skill and rule-admission linting for refine-r… ([a65eda1](https://github.com/broneq/bdk/commit/a65eda1d932e1ebb50ce101d21a372c719d8fa4f))
* add /bdk:add-rule skill and rule-admission linting for refine-rules ([dd79e7b](https://github.com/broneq/bdk/commit/dd79e7b2085c38cac5e945dce77a189820915a3c))

## [1.2.0](https://github.com/broneq/bdk/compare/v1.1.0...v1.2.0) (2026-08-03)


### Features

* add /bdk:refine-rules skill for compacting .claude/rules docs ([#9](https://github.com/broneq/bdk/issues/9)) ([f974907](https://github.com/broneq/bdk/commit/f974907d6c3e82c6515f950996c834b6b5804af2))

## [1.1.0](https://github.com/broneq/bdk/compare/v1.0.0...v1.1.0) (2026-05-08)


### Features

* **bdk:** BDK plugin — skills, agents, hooks, fragment system, quality rules ([#1](https://github.com/broneq/bdk/issues/1)) ([49f402e](https://github.com/broneq/bdk/commit/49f402e8d3b25f18fe632f0e8bc7cd963ed8cbf2))
* Feature/critical fixes ([#6](https://github.com/broneq/bdk/issues/6)) ([f77a3ce](https://github.com/broneq/bdk/commit/f77a3ce28ca87c63a4bc552995fb0361051585af))
* **plugin:** add marketplace.json and fix install docs ([#2](https://github.com/broneq/bdk/issues/2)) ([45efc3c](https://github.com/broneq/bdk/commit/45efc3c9cbe92b32e33658c89b4261c9d489b0a9))


### Bug Fixes

* **plugin:** try github: source type for install compatibility ([#4](https://github.com/broneq/bdk/issues/4)) ([25e9376](https://github.com/broneq/bdk/commit/25e93769e65d96cb9b1014aa90e9de59566d8e0a))
