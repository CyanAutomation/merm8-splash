# Frontend design guidance

## Product feel

merm8 is a focused Mermaid diagram checker. Keep the workspace calm, compact, and easy to scan. The editor, preview, and results should feel like parts of one tool, with clear hierarchy and little decoration.

## Shared visual system

Use the existing charcoal palette and blue accent from `app/globals.css`:

- Page: `#1c1c1e`; panels: `#2c2c2e`; controls: `#1c1c1e`.
- Primary text: `#e1e1e1`; supporting text: `#a0a0a0`.
- Accent: `#0a84ff`; success: `#04b575`; warning: `#ffc107`; error: `#ff5555`.
- Use `--radius-control` and `--radius-panel` for consistent 6px corners.
- Use a 4px spacing base and the existing border and focus-ring tokens.

Prefer solid surfaces and simple borders. Do not introduce gradients, glass effects, decorative shadows, or new colors when existing tokens fit.

## Components and layout

- Reuse `Button`, `Modal`, and the shared field, panel, and status styles. Add a shared component or token when the same pattern appears in multiple places.
- Use sentence-case headings, 14px or larger body copy where space allows, and the existing sans/monospace pairing.
- Keep buttons, fields, panels, and status messages consistent in height, radius, spacing, hover, disabled, and focus states.
- Keep desktop editor and preview side by side with results available in the workspace. On narrow screens, let people switch between Edit, Preview, and Results without a long stacked page.
- Every interactive control needs a visible keyboard focus state and an accessible name. Inputs need visible labels. Dialogs need a title, modal semantics, keyboard dismissal, and focus management.

## Product language

Use a warm, direct, helpful voice. Prefer short sentences, sentence case, and familiar words. Use contractions where natural, and describe what happened and what the person can do next.

- Call the product **merm8** and describe it as a **Mermaid diagram checker**.
- Use **check** for running the rules and **review** for the separate semantic feedback feature.
- Say **rules** in user-facing copy rather than alternating between rules, lints, and checks.
- Reserve success language such as “No issues found” for a completed successful check. Explain when the API is not connected, rules have not loaded, or only syntax was checked.
- Use consistent labels: “Test API”, “Run check”, “Diagram review”, “API settings”, and “Rules”.
- Avoid emoji, icon glyphs in labels, jargon, all-caps emphasis, and blame-oriented error copy.

## Responsive and accessible behavior

- Keep controls usable at touch sizes on narrow screens and prevent toolbars from overflowing.
- Preserve readable contrast and visible focus. Do not rely on color alone to communicate state.
- Use semantic headings, labels, buttons, status regions, and dialog relationships.
