---
name: nextjs-static-export
description: Use when changing Next.js routing, component boundaries, build configuration, or deployment behavior in this Next.js 16 static-export app.
---

# Next.js 16 and static export

Use this skill for framework, routing, build, and deployment changes. This repo uses Next.js 16, React 19, TypeScript, and `output: 'export'`; do not assume a running Next.js server or a backend inside this repository.

## Read the installed documentation first

Before writing Next.js code, follow `AGENTS.md` and read the relevant guide from the installed package under `node_modules/next/dist/docs/`. Start with the App Router static-export guide and the Server and Client Components guide when those areas are involved. The installed version is authoritative; verify exact APIs and unsupported features there instead of relying on memory or older examples.

## Preserve the static deployment model

- `next.config.ts` sets `output: 'export'`. A production build writes static files to `out/`, served by a static host or the repo's Nginx container.
- Live merm8 data comes from the browser through the configured remote API. Do not add local API routes, server actions, request-time rendering, or server-only runtime assumptions without an explicit migration of the deployment model.
- Before adding a route or framework feature, check that it is supported by static export and determine how its paths and assets are emitted.
- Keep browser-only behavior behind Client Components. Use `'use client'` only where state, event handlers, effects, or browser APIs require it; a client boundary includes its imported module graph.
- The project config uses build-time `NEXT_PUBLIC_BASE_PATH` and `NEXT_PUBLIC_ASSET_PREFIX`, and `images.unoptimized`. Preserve compatibility with subpath hosting and static image serving.
- `NEXT_PUBLIC_` values are public build-time configuration. Never place secrets in them.

## Deployment and regression coverage

Inspect affected configuration and hosting files before changing deployment behavior, including `next.config.ts`, `vercel.json`, `netlify.toml`, `Dockerfile`, and `nginx.conf`. Update README deployment instructions when user-visible setup changes.

Use focused tests for affected behavior, such as `tests/vercel-config.test.ts`, `tests/nginx-cache-policy.test.ts`, or `tests/github-workflows.test.ts`. For routing or configuration changes, run the relevant tests and `npm run build`; follow `AGENTS.md` for lint and manual checks. Confirm the generated output remains suitable for static hosting.
