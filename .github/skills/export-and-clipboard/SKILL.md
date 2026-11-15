---
name: export-and-clipboard
description: Use when changing result exports, SARIF generation, clipboard copying, file downloads, or export-menu behavior.
---

# Result export and clipboard behavior

Use this skill for export actions and format generation in `lib/exportActions.ts`, `lib/exportFormats.ts`, `lib/clipboard.ts`, and the export components. Keep format generation and browser side effects in their existing library/component boundaries.

## Behavior to preserve

- Keep JSON, Markdown, plain-text, and SARIF outputs valid and consistent with the displayed result state. Preserve escaping and line-number behavior in text formats.
- SARIF export may use the API to create a richer result, but must preserve the local fallback when endpoint validation or the request fails. Do not report API-generated output when a fallback was downloaded.
- Clipboard copy should retain the browser clipboard path, the legacy textarea fallback, mounted-component guards, and the existing download fallback when copying cannot complete.
- Keep success, warning, and error feedback truthful to the action that completed. Prevent duplicate in-flight export actions and close the menu according to the existing interaction pattern.
- Treat diagram source and analysis results as user data. Do not add them to logs or telemetry as part of export handling.

## Tests and validation

Use `tests/export-formats.test.ts`, `tests/export-actions.test.ts`, `tests/clipboard.test.ts`, and `tests/export-dropdown-menu.test.ts` as the behavior contract. Add or update focused tests for changed formats, fallback paths, or menu behavior, then run the relevant Vitest files and follow `AGENTS.md` for lint and UI checks.
