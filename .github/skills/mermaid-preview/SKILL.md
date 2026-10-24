---
name: mermaid-preview
description: Use when changing Mermaid diagram editing, type detection, preview rendering, parse or render errors, and navigation between findings and source lines.
---

# Mermaid editor and preview

Use this skill for changes to the Mermaid authoring and preview workflow. The app uses Mermaid for standard rendering and can optionally use `beautiful-mermaid`; inspect the current implementation before relying on either renderer's behavior.

## Follow the existing boundaries

- Keep diagram preview work in `app/components/` and shared diagram type logic in `lib/diagramTypes.ts`.
- Read `app/components/DiagramPreview.tsx`, `diagramRenderer.ts`, and the preview hooks before changing render lifecycle or DOM behavior.
- Preserve the current renderer fallback, strict Mermaid security configuration, and unique selector-safe render IDs. Do not insert Mermaid source as HTML.
- Keep parse errors, renderer failures, API analysis results, and semantic review findings distinct in state and copy. A stale error must not hide a corrected diagram or a fresh result.
- Preserve asynchronous render isolation and cancellation/version guards. A late render must not replace a newer preview.
- Keep the editor, preview, and results consistent with `design/frontend-design-guidance.md` and its responsive workspace behavior.

## Diagram types and rules

- `parseDiagramType` reads the first meaningful declaration and handles Mermaid directive blocks. Use it instead of adding a second type detector.
- Rule applicability is mapped in `lib/diagramTypes.ts`. Unknown types intentionally retain the existing fail-open rule behavior; don't silently change that policy.
- Keep syntax validity, lint support, rule availability, and semantic review as separate concepts in the UI.
- If changing a type mapping, renderer support, or API request behavior, update focused tests alongside the code.

## Error and navigation behavior

- Keep concise inline feedback separate from detailed parser or renderer diagnostics.
- Preserve the existing jump-to-line behavior when an error or finding identifies a source line, including clearing stale highlights when the error is resolved.
- Do not treat a successful preview render as proof that API analysis succeeded, or vice versa.
- Keep empty, loading, parse-error, render-error, and successful-preview states usable and accessible.

## Validation

Use the nearest tests as the behavior contract. Relevant coverage includes `tests/diagram-types.test.ts`, `tests/diagram-preview-utils.test.ts`, `tests/diagram-preview-error-flow.test.ts`, `tests/preview-parse-error-regression.test.ts`, `tests/preview-render-id-isolation.test.ts`, and `tests/use-diagram-preview-dom.test.ts`.

For behavior changes, add or update a focused regression test first where practical, then run it with Vitest. Follow `AGENTS.md` for lint and manual UI checks. Do not add a dependency or change the rendering engine without a task requirement.
