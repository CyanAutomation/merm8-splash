---
name: front-end-design
description: Use for new or substantial visual direction on landing pages and product UI. Follow the user's brief and the repository's design guidance; use the landing-page defaults only for brand-led marketing work.
---

# Front-end design

Use this skill when a task needs visual direction, layout hierarchy, imagery, or motion. For routine fixes or copy-only changes, follow the existing UI patterns without adding a redesign.

## Sources of truth

Before changing the interface, inspect the relevant screens, components, assets, and styles. Follow this order:

1. The user's brief and supplied references.
2. Repository instructions, especially `AGENTS.md` and `design/frontend-design-guidance.md`.
3. The guidance in this skill where it does not conflict with the first two.

Keep the established product identity, tokens, language, and interaction patterns unless the task asks to change them. Do not apply landing-page conventions to an operational product surface.

## Choose the interface mode

For brand-led landing pages, set a clear visual thesis, content hierarchy, and primary action. Use the brand, promise, supporting proof, and conversion path to shape the page. A full-bleed hero or strong image can help when it serves that story; it is not a requirement for every page.

For product UI, start with the user's task and working surface. Make status, controls, content, and next actions easy to scan. Use utility copy and existing components. Add a hero, promotional copy, or decorative imagery only when the brief calls for it.

For prototypes, demos, and games, follow the requested experience and preserve usability. Do not force the landing-page sequence onto them.

## Visual decisions

- Start with composition and information hierarchy before adding components or decoration.
- Reuse established colors, typography, spacing, radii, and shared components.
- Use cards only when grouping or interaction benefits from a card; do not remove useful grouping just to satisfy a cardless default.
- Keep each section focused on one user need or message. Remove repetition while preserving useful context and accurate product information.
- Use imagery when it adds meaning. Prefer suitable existing assets; check image weight, crop, contrast, licensing, and alternative text. Decorative images should have empty alt text.
- Treat full-bleed layouts, limited typefaces, and a small accent palette as options that support the brief, not fixed quotas.

## Interaction, accessibility, and responsive behavior

- Use semantic elements and accessible names. Support keyboard operation, visible focus, readable contrast, and states that do not rely on color alone.
- Keep labels, errors, loading, empty, disabled, and success states understandable.
- Check the layout at narrow and wide viewports and at increased zoom. Preserve usable controls and avoid horizontal overflow.
- Add motion only when it clarifies hierarchy, state, or affordance. It is optional; do not add motion to meet a count.
- Honor `prefers-reduced-motion`. Keep transitions brief and avoid motion that blocks input, causes layout instability, or makes content harder to follow.
- Prefer CSS and existing dependencies for simple effects. Add a motion library only when the task requires it and the project does not already provide a suitable option.

## Validation

For UI changes, follow the validation instructions in `AGENTS.md`. Check the changed interactions with a keyboard and at a narrow viewport; verify reduced-motion behavior when motion is introduced. When browser tooling is available, capture before/after screenshots for substantial visual changes.
