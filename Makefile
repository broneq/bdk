# BDK developer entrypoint.
#
# CI runs these exact targets - see .github/workflows/tests.yml, whose only
# command is `make check`. Keep it that way: the moment a workflow inlines a
# tool invocation, local and CI can drift and this file stops being the answer
# to "what does CI run".
#
# Requires GNU Make >= 3.81 (macOS system make is fine: no .ONESHELL, no
# .RECIPEPREFIX, no $$(file ...)).

SHELL       := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

UV     ?= uv
RUN    := $(UV) run --group lint
CLAUDE ?= claude

# Directories mypy is run against, one invocation each. A single run across the
# tree dies on a module-name collision: five hooks share the basename check.py
# and there is no __init__.py anywhere. --explicit-package-bases does not fix it.
MYPY_DIRS := scripts hooks/check-bdk-config hooks/check-rules-drift \
             hooks/is-skill-exist hooks/is-command-exists \
             hooks/register-graph-repo skills/refine-rules/scripts

# THE CONTRACT: `make check` is exactly this list, in this order.
FAST_CHECKS := format-check lint typecheck actions plugin skills markdown docs
CHECKS      := $(FAST_CHECKS) test

# Every gate name collides with a real directory (docs/, skills/, scripts/).
# Without .PHONY make considers them up to date and runs nothing.
.PHONY: help check check-fast fix run-gates $(CHECKS)

help:  ## Show this help
	@grep -hE '^[a-z0-9_-]+:.*?##' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n",$$1,$$2}'
	@echo ""
	@echo "  check      = $(CHECKS)"
	@echo "  check-fast = $(FAST_CHECKS)"

check:  ## Run every gate, report ALL failures (this is what CI runs)
	@$(MAKE) --no-print-directory run-gates GATES="$(CHECKS)"

check-fast:  ## Every gate except the test suite - the pre-push loop
	@$(MAKE) --no-print-directory run-gates GATES="$(FAST_CHECKS)"

# Runs every gate even after one fails, then reports the full set. Gates are
# mutually independent, so stopping at the first failure would turn a branch
# with three problems into three CI round-trips.
#
# Exit status is GNU make's own: 2 when any gate failed, 0 when all passed.
# Not 1 - a failing recipe always surfaces as 2, and wrapping it to fake a 1
# buys nothing since every caller, CI included, tests for non-zero.
run-gates:
	@failed=""; \
	for gate in $(GATES); do \
	  printf '\n\033[1;34m==> %s\033[0m\n' "$$gate"; \
	  if $(MAKE) --no-print-directory "$$gate"; then \
	    printf '\033[32m  PASS\033[0m %s\n' "$$gate"; \
	  else \
	    printf '\033[31m  FAIL\033[0m %s\n' "$$gate"; \
	    failed="$$failed $$gate"; \
	  fi; \
	done; \
	echo ""; \
	if [ -n "$$failed" ]; then \
	  printf '\033[1;31mFAILED:\033[0m%s\n' "$$failed"; \
	  printf 'Re-run one gate:      make%s\n' "$$failed"; \
	  printf 'Autofix what can be:  make fix\n'; \
	  exit 1; \
	fi; \
	printf '\033[1;32mAll %s gates passed.\033[0m\n' "$$(echo $(GATES) | wc -w | tr -d ' ')"

format-check:  ## ruff format --check
	@$(RUN) ruff format --check --output-format concise .

lint:  ## ruff check
	@$(RUN) ruff check --output-format concise .

# `|| fail=1` rather than letting `set -e` do it: a bare loop reports the LAST
# iteration's status, so an error in the first directory used to pass silently.
# Collecting instead of aborting also matches the run-all-then-report contract.
typecheck:  ## mypy, one run per source directory
	@fail=0; for d in $(MYPY_DIRS); do $(RUN) mypy "$$d" || fail=1; done; exit $$fail

actions:  ## actionlint on .github/workflows
	@$(RUN) actionlint

# `claude plugin validate .` is deliberately absent: at repo root it resolves to
# marketplace.json and reports "contents": [], never descending into components.
# Worse, a clean 29-skill run and a run that found no files are byte-identical,
# so the tripwire below is what stops a renamed directory from passing forever.
plugin:  ## claude plugin validate (skills + agents)
	@test "$$(find skills -name SKILL.md | wc -l)" -ge 25 \
	  || { echo "tripwire: fewer than 25 SKILL.md found - did skills/ move?"; exit 1; }
	@test "$$(find agents -name '*.md' | wc -l)" -ge 10 \
	  || { echo "tripwire: fewer than 10 agents found - did agents/ move?"; exit 1; }
	@$(CLAUDE) plugin validate skills --strict
	@$(CLAUDE) plugin validate agents --strict

skills:  ## skilllint - skill/agent frontmatter and manifests
	@$(RUN) skilllint check .

# Prose only. skills/ and agents/ are LLM prompts, not documents - reflowing a
# prompt rewrites what the model reads, so they stay out.
markdown:  ## pymarkdown on docs/ + the two root documents
	@$(RUN) pymarkdown --config .pymarkdown.json scan -r docs/
	@$(RUN) pymarkdown --config .pymarkdown.json scan README.md CONTRIBUTING.md

docs:  ## mkdocs build --strict
	@$(UV) run --group docs mkdocs build --strict

test:  ## pytest unit suite
	@$(UV) run pytest tests/unit/ -q

fix:  ## Autofix what is autofixable, then say what is left
	@$(RUN) ruff check --fix .
	@$(RUN) ruff format .
	@$(RUN) pymarkdown --config .pymarkdown.json fix -r docs/ || true
	@$(RUN) pymarkdown --config .pymarkdown.json fix README.md CONTRIBUTING.md || true
	@echo ""
	@echo "Autofix done. Run 'make check' for what remains."
