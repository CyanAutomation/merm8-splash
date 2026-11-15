---
name: kaseki-automation
description: Use when changing Kaseki scheduled tasks, payloads, allowlists, validation commands, or the reusable workflow that submits and monitors Kaseki runs.
---

# Kaseki agent automation

Use this skill for `.github/workflows/kaseki-*.yml`, `.github/workflows/kaseki-*.yaml`, or changes to the Kaseki request contract. Read `github-actions` as well for general workflow security and CI conventions.

## Caller and shared runner boundaries

- Keep each caller focused on its task: its schedule, description, file allowlist, validation command, and task-specific prompt belong in the caller workflow.
- Keep controller preflight, authenticated submission, idempotency, polling, and run summaries in `kaseki-run.yml` so callers share one execution path.
- Keep preparation and secret-bearing execution restricted to `refs/heads/main`. Do not expose the Kaseki token to caller workflows or unrelated steps.
- Preserve the approved HTTPS controller URL check, environment protection, bounded timeouts, run-ID validation, and response-body redaction.
- Use narrow file allowlists and explicit validation commands. A task prompt must respect that scope, avoid unrelated code or generated files, and permit a successful no-change result when no useful change is justified.
- Keep each workflow's concurrency group independent so one task type does not cancel or replace another task type's pending run.

## Payload and validation

- Treat workflow inputs and controller responses as untrusted. Construct JSON with a JSON encoder, validate returned identifiers before using them in URLs, and keep secrets out of command output and summaries.
- Preserve deterministic idempotency for a GitHub run so retries cannot create duplicate work.
- Update `tests/github-workflows.test.ts` for changes to branch restrictions, permissions, payload contents, allowlists, validation commands, secret scope, retries, polling, or concurrency.
- Run the focused workflow tests and `npm run lint`; run any validation command configured for the affected task when safe and available. Report checks that were not run.
