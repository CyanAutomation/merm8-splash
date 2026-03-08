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
