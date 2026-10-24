---
name: api-integration
description: Use when changing the merm8 API client, endpoint configuration, request or response handling, rule loading, analysis scheduling, or API error states.
---

# API integration and asynchronous state

Use this skill for frontend work that sends requests to or presents data from the remote merm8 API. This repository has no local backend; do not add server assumptions or duplicate request logic inside UI components.

## API boundaries

- Keep request and response handling centralized in `lib/api.ts`; keep endpoint selection and validation in `lib/api/endpoint.ts` and response normalization in `lib/api/normalizers.ts`.
- Check the current API contract and nearby tests before changing request paths, payloads, normalization, or user-facing errors.
- Existing endpoints include `/v1/healthz`, `/v1/rules`, `/v1/analyze`, `/v1/analyze/sarif`, and `/v1/semantic-review`. Preserve the distinction between syntax/rendering, rule analysis, and semantic review.
- Resolve the endpoint in the established order: valid `?api=` parameter, valid `localStorage` value, valid `NEXT_PUBLIC_MERM8_API_URL`, then the built-in endpoint. Preserve URL validation and its production restrictions.
- `NEXT_PUBLIC_` values are embedded in browser assets. Never put credentials or secrets in them. Do not change semantic-review authorization behavior without a task and API contract that require it.

## Requests and state

- Preserve request timeouts, caller-provided `AbortSignal` handling, and context-specific error messages.
- Keep loading, disconnected, unavailable, malformed-response, failed, and successful states distinct. Do not show success copy when rules or analysis are unavailable.
- Preserve cancellation, request identity guards, deduplication/cache behavior, and scheduling in `lib/useDiagramAnalysis.ts`, `lib/analysis/`, and related hooks. Stale responses must not overwrite newer user input or endpoint state.
- Preserve the existing request schema (`schema-version`, rule configuration, and server-default behavior) and diagram-type rule filtering. Unknown types follow the existing fallback behavior.
- Keep API keys and diagram content out of logs, screenshots, and test fixtures unless the test uses synthetic values.

## Testing and validation

Add or update a focused test before changing observable API behavior where practical. Use the nearest existing coverage:

- Request shape, endpoint validation, response normalization, and API errors: `tests/analyze-request.test.ts` and `tests/api-failure-message.test.ts`.
- Analysis cache, scheduling, cancellation, retries, and stale-response handling: `tests/analysis-cache.test.ts`, `tests/analysis-scheduling.test.ts`, `tests/use-diagram-analysis-cache.test.ts`, and `tests/use-diagram-analysis.test.ts`.
- Rules behavior: `tests/use-rules-configuration.test.ts` and adjacent rules-state tests.

Run the focused Vitest files, then follow `AGENTS.md` for `npm run lint` and any relevant manual checks. Update API documentation when the public behavior or configuration changes.
