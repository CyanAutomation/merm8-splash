# AGENTS.md

## Project summary
- This repository is a **Next.js 15 + React 19 + TypeScript** frontend for the **merm8 API**.

## Key directories and ownership hints
- `app/`: UI, layout, and component work.
- `lib/`: API client code, hooks, and shared utilities.
- `tests/`: Node-based test files.
- `design/frontend-design-guidance.md`: Visual constraints and frontend design guidance.

## Core commands
From `package.json`:
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Architecture constraints
- This codebase is **frontend-only**.
- The API is remote and configurable via endpoint configuration; do not assume a local backend in this repo.

## Change management
- Keep changes **minimal and localized** to the task.
- Avoid broad refactors unless explicitly requested.

## Coding conventions
- Prefer function components and React hooks (`useCallback`, `useEffect`, `useRef`) over class-based patterns, and use explicit TypeScript interfaces/types for component props and API data shapes.
- Keep API integration logic centralized in `lib/api.ts`; avoid duplicating `fetch` request/response handling directly inside UI components.
- Preserve existing cancellation and race-safety patterns (for example, `AbortController` plus request-id guards) in hooks and page state flows.
- Reuse shared constants from `lib/constants.ts` and theme tokens from CSS variables and `lib/theme.ts` instead of introducing one-off values.
- Keep imports consistent with the `@/` alias in areas where that alias is already the established convention.
- Avoid introducing unnecessary dependencies when the current Next.js/React/TypeScript stack already provides the needed functionality.

## UI rules
- Treat `design/frontend-design-guidance.md` as the authoritative visual guidance for UI work.
- Reuse existing project color tokens and typography styles before introducing new visual tokens.
- Keep UI changes consistent with current panel, button, and text patterns defined in `app/globals.css`.
- Avoid introducing generic dashboard motifs or palette shifts that conflict with the design guidance document.
- For UI changes, include before/after validation notes and add screenshots when tooling is available.
