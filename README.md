[![Frontend CI](https://github.com/CyanAutomation/merm8-splash/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/CyanAutomation/merm8-splash/actions/workflows/ci.yml) [![README Link Check](https://github.com/CyanAutomation/merm8-splash/actions/workflows/readme-links.yml/badge.svg?branch=main)](https://github.com/CyanAutomation/merm8-splash/actions/workflows/readme-links.yml)

# merm8-splash

An interactive frontend for the **merm8 API**—bringing real-time Mermaid diagram linting to your browser-based workflow. Write, analyze, and validate your diagrams with a dark desktop-oriented UI, whether you're using the cloud-hosted API or self-hosting your own instance.

## Features

- **Interactive Diagram Editor** — plain-text editor with clickable line-number gutter and jump-to-line support
- **Real-time Linting** — Instant feedback on diagram violations with configurable rule severity levels (error, warning, info)
- **Fast Analysis** — Debounced, optimized API calls for responsive user experience
- **Flexible API Configuration** — Point to any merm8 API endpoint (cloud or self-hosted) without code changes
- **Multiple Diagram Types** — Renders Mermaid diagrams and adapts lint controls to the connected API's advertised capabilities
- **Export Support** — Export analysis results as SARIF JSON, JSON, Markdown, or plain text
- **Semantic Review** — Optional AI review through the configured API. Semantic review requests do not include a client API key. See [API Endpoint](#api-endpoint) for data-handling details.
- **Self-Hostable** — Deploy privately with Docker, Netlify, Vercel, or custom infrastructure
- **Desktop-Optimized Design** — Clean UI styled with project CSS (optimized for desktop with responsive mobile stacking)

## Quick Start

### Using Cloud-Hosted Version

Try the [hosted merm8-splash app](https://merm8-splash.vercel.app/). The built-in default API is the official merm8 API; a saved endpoint or valid `api` URL parameter can override it.

1. Open **API Configuration** and select **Test** to check the current API connection. To use another instance, enter its URL, test it, then select **Save**.
2. Paste this Mermaid diagram into the editor:

   ```mermaid
   flowchart TD
       Start([Start]) --> Check{Valid?}
       Check -- Yes --> Done[Continue]
       Check -- No --> Fix[Show error]
   ```

3. The preview renders the diagram. After the API responds, the Results panel lists findings by rule, severity, message, and line; available rules depend on the API and diagram type.
4. Select a finding with a line number to jump to that line in the editor. Use **Rules** to choose which available checks to apply.
5. Open **Export** to download SARIF JSON or JSON, or copy the results as Markdown or plain text.

## Troubleshooting

### API connection or analysis fails

- Open **API Configuration** and select **Test** to check the selected endpoint. Confirm the endpoint is reachable from your browser and is a compatible merm8 API.
- A valid `?api=` URL parameter or endpoint saved in browser storage can override the built-in or build-time endpoint. Review the [API Endpoint configuration](#api-endpoint) if the app is using an unexpected instance.
- If the browser reports a CORS error, the API operator must allow the frontend's exact origin. CORS is configured by the API, not by this frontend; see the [Worker API reference](https://github.com/CyanAutomation/merm8/blob/main/docs/worker-api.md) for the hosted API's policy.
- If the connection test passes but analysis fails, check that the API supports the requested diagram type and review its current contract at `/v1/spec`.

## Development

### Prerequisites

- **Node.js** 24.x
- **npm** 9+ (the repository uses `package-lock.json`; npm is the verified package manager)

### Installation

```bash
# Clone the repository
git clone https://github.com/CyanAutomation/merm8-splash.git
cd merm8-splash

# Install the locked dependencies
npm ci
```

### Running Locally

```bash
# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app auto-reloads as you edit.

### Building for Production

```bash
# Create optimized production build
npm run build
```

The build writes a static site to `out`. Serve that directory with your preferred static host; the Docker image uses Nginx.

### Linting

```bash
# Run ESLint
npm run lint
```

### Testing

```bash
# Run unit tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests and generate a coverage report
npm run test:coverage
```

The project uses [Vitest](https://vitest.dev/) as the test runner. Test files are located in the `tests/` directory and follow the pattern `*.test.ts`. Coverage reports are written to `coverage/`.

### Documentation check

```bash
npm run check:readme
```

This checks local Markdown link targets and heading anchors, and verifies that documented `npm run` commands and `npm test` exist in `package.json`. It does not request external URLs.

To check external HTTP(S) links as well, run:

```bash
npm run check:readme:links
```

The external link check follows redirects, retries transient failures, and skips localhost examples. Confirmed HTTP errors fail the check; network-level failures are reported as unverified warnings. It runs weekly in the **README Link Check** workflow and can also be started manually from GitHub Actions.

**Test Coverage:**

- API request building and validation
- Rules state management
- Hook behavior (e.g., `useDiagramAnalysis` with debouncing and error handling)
- Component lifecycle patterns (e.g., timeout management in `Snackbar`)

## Configuration

### API Endpoint

The application needs to connect to a merm8 API instance. On page load, it chooses the initial endpoint in this order:

1. A valid **`?api=<url>` URL parameter**.
2. A valid endpoint saved from the API Configuration panel in `localStorage.merm8_api_endpoint`.
3. **`NEXT_PUBLIC_MERM8_API_URL`**, embedded at build time for static deployments:

   ```bash
   NEXT_PUBLIC_MERM8_API_URL=https://merm8.scheimann.workers.dev npm run build
   ```

4. The built-in official API endpoint.

Invalid configured values are ignored and resolution continues to the next option. A saved browser endpoint takes precedence over the build-time value. To remove it, run this in the browser console and reload the page:

```js
localStorage.removeItem('merm8_api_endpoint')
```

`NEXT_PUBLIC_MERM8_API_URL` is public configuration included in the built frontend; do not put secrets in it. Because Docker serves a static build, passing this variable to `docker run` does not change the API endpoint. For a Docker deployment, set and save the endpoint in the app’s API Configuration panel.

Diagram source is sent to the selected API endpoint for regular analysis and optional semantic review. Semantic review requests do not include a client API key. The hosted semantic review endpoint applies a per-IP request limit. The endpoint operator controls how requests are processed and retained, so choose an endpoint you trust with your diagrams.

### Local API Setup

For development against a local merm8 API instance:

```bash
NEXT_PUBLIC_MERM8_API_URL=http://localhost:8080 npm run dev
```

The local API must be running and reachable from the browser. Local or private API addresses are allowed in development; production builds reject them.

### Static hosting path settings

For a site served below a URL path, set `NEXT_PUBLIC_BASE_PATH` before building. Set `NEXT_PUBLIC_ASSET_PREFIX` only when Next.js assets are served from a separate prefix or CDN. Both are build-time settings; see [.env.example](.env.example).

```bash
NEXT_PUBLIC_BASE_PATH=/tools/merm8 npm run build
```

## Deployment

### Docker

Build and run the application in a lightweight, secure Docker container:

```bash
# Build image
docker build -t merm8-splash .

# Run container
docker run -p 80:80 merm8-splash
```

The Dockerfile uses a multi-stage build for minimal image size, with nginx serving the static Next.js output. Nginx caches fingerprinted files under `/_next/static/` for one year with `immutable`; HTML entry points are served with `no-cache` so clients revalidate SPA updates, while other root assets use a short, revalidating cache policy.

**Production deployment:**

```bash
docker build -t myregistry/merm8-splash:1.0.0 .
docker push myregistry/merm8-splash:1.0.0
```

### Netlify

Netlify provides free hosting with automatic deployments from git:

1. Connect your GitHub repository to Netlify
2. Build command: `npm run build`
3. Publish directory: `out`
4. Add environment variable:

   ```
   NEXT_PUBLIC_MERM8_API_URL=https://merm8.scheimann.workers.dev
   ```

5. Deploy!

See [netlify.toml](netlify.toml) for configuration details.

### Vercel

Deploy directly to Vercel with Git integration:

1. Push code to GitHub
2. Import project in Vercel dashboard
3. In Project Settings → Environment Variables, set `NEXT_PUBLIC_MERM8_API_URL` for Production to `https://merm8.scheimann.workers.dev`. This frontend is a static export, so Next.js embeds this public value in the files during each build; redeploy after changing it. Configure Preview only if you start using Preview deployments.

4. Make sure the API's CORS allowlist includes the production origin `https://merm8-splash.vercel.app`. If you start using Preview deployments, add their exact origins to the allowlist as needed. Avoid allowing every `*.vercel.app` origin.

5. Deploy. Vercel runs lint, tests, and the production build through `npm run build:vercel` before publishing.

See [vercel.json](vercel.json) for configuration details.

### Self-Hosted

For custom deployments:

1. Build: `npm run build`
2. Serve the `out` directory with any web server (nginx, Apache, etc.)
3. Ensure `NEXT_PUBLIC_MERM8_API_URL` is set before build
4. Configure CORS if API is on different domain

## Architecture

**merm8-splash** is built with modern web technologies:

- **[Next.js](https://nextjs.org/)** 16 — React framework for production
- **[React](https://react.dev/)** 19 — UI library
- **[TypeScript](https://www.typescriptlang.org/)** — Type-safe development
- **[Mermaid](https://mermaid.js.org/)** — Diagram rendering
- **beautiful-mermaid** ^1.1.3 — Beautiful Mermaid rendering enhancements

The application is a **pure frontend** that communicates with a remote merm8 API instance via REST API. No backend server required. For the hosted Worker’s endpoints, request limits, CORS behavior, and live contract, see the [Worker API reference](https://github.com/CyanAutomation/merm8/blob/main/docs/worker-api.md); a deployed API also exposes its current specification at `/v1/spec`.

## Project Structure

```
.
├── app/                  # Next.js routes, UI components, and styles
├── lib/                  # API client, hooks, and shared utilities
├── tests/                # Vitest tests
├── design/               # Design guidance and assets
├── .github/workflows/    # CI and documentation workflows
├── Dockerfile            # Nginx static-site image
├── netlify.toml          # Netlify build and publish settings
├── next.config.ts        # Static export and asset-path settings
└── vercel.json           # Vercel build and response headers
```

## Contributing

We welcome contributions! Here's how to get involved:

### Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/CyanAutomation/merm8-splash/issues) with:

- Clear description of the problem
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Screenshots if applicable
- Environment info (browser, OS)

### Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Validate locally: `npm test`, `npm run lint`, `npm run build`, and `npm run check:readme`
5. Commit with clear messages: `git commit -m "Add feature description"`
6. Push to your fork
7. Open a Pull Request with description of changes

### Development Guidelines

- Write TypeScript with proper type annotations
- Follow existing code style (enforced by ESLint)
- Test changes locally before submitting PR
- Keep components focused and reusable
- Document complex logic with comments

## License

MIT © 2026 [CyanAutomation](https://github.com/CyanAutomation)

## Related Projects

- **[merm8](https://github.com/CyanAutomation/merm8)** — The core linting API that powers merm8-splash

## Support

- Check the [Troubleshooting](#troubleshooting) section for API connection and analysis issues
- [Search existing issues](https://github.com/CyanAutomation/merm8-splash/issues) for solutions
- Open a new issue if you need help
