---
name: github-actions
description: Use when changing GitHub Actions workflows, workflow automation scripts, action pins, permissions, triggers, or CI validation in this repository.
---

# GitHub Actions and CI automation

Use this skill for `.github/workflows/`, workflow-related scripts, and tests that enforce CI behavior. Read `AGENTS.md` and the affected workflow tests before changing automation. This skill covers general workflow mechanics; use `kaseki-automation` for the Kaseki agent request and execution flow.

## Workflow safety and structure

- Grant the smallest required `permissions` at workflow or job scope. Start from `permissions: {}` when a workflow needs no GitHub token access.
- Pin third-party actions to full commit SHAs and retain a version comment. Keep automated pin updates paired with checksum validation and the repository's workflow analyzers.
- Treat pull-request content, workflow inputs, artifacts, and external responses as untrusted. Avoid interpolating untrusted expressions directly into shell scripts; pass values through environment variables and validate them before use.
- Scope secrets to only the steps that need them. Do not print tokens, request bodies, or sensitive response bodies in logs or summaries.
- Review triggers, branch/ref guards, concurrency groups, cancellation, timeouts, and environment protections together; they determine when automation can run and whether concurrent runs can interfere.
- Keep reusable workflows focused, validate their caller inputs, and preserve the caller revision semantics where local reusable workflows are used.

## Repository checks

- CI runs `actionlint` and `zizmor` against all workflow YAML files. Preserve both checks when changing workflow analyzer setup.
- Workflow behavior is covered by `tests/github-workflows.test.ts`, `tests/node-version.test.ts`, and `tests/update-workflow-tool-pins.test.ts`. Update focused assertions when workflow contracts change.
- Run the relevant Vitest files, then `npm run lint` and `npm run build` when workflow or script changes affect those checks. State explicitly which checks were run.
- Keep Node versions aligned with `.nvmrc`, `package.json`, hosted build configuration, and workflow setup where applicable.
