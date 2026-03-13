# merm8-splash

An interactive frontend for the **merm8 API**—bringing real-time Mermaid diagram linting to your terminal-inspired workflow. Write, analyze, and validate your diagrams with a beautiful Bubble Tea-aesthetic UI, whether you're using the cloud-hosted API or self-hosting your own instance.

## Features

- **Interactive Diagram Editor** — Real-time syntax highlighting and code editing for Mermaid diagrams
- **Real-time Linting** — Instant feedback on diagram violations with configurable rule severity levels (error, warning, info)
- **Fast Analysis** — Debounced, optimized API calls for responsive user experience
- **Flexible API Configuration** — Point to any merm8 API endpoint (cloud or self-hosted) without code changes
- **Multiple Diagram Types** — Full support for all Mermaid diagram formats
- **Keyboard Shortcuts** — Navigate efficiently with intuitive shortcuts
- **Export Support** — Export analyzed diagrams in multiple formats
- **Self-Hostable** — Deploy privately with Docker, Netlify, Vercel, or custom infrastructure
- **Responsive Design** — Clean, modern UI built with Tailwind CSS

## Quick Start

### Using Cloud-Hosted Version

The easiest way to try merm8-splash is to use the cloud-hosted version:

1. Navigate to the live application (URL provided by your deployment)
2. Enter your merm8 API endpoint URL in the API Config panel
3. Start writing Mermaid diagram code in the editor
4. View real-time linting results and rule violations
5. Configure which rules to enforce using the Rules panel

## Development

### Prerequisites

- **Node.js** 18 or higher
- **npm** 9+ or **yarn** 4+

### Installation

```bash
# Clone the repository
git clone https://github.com/CyanAutomation/merm8-splash.git
cd merm8-splash

# Install dependencies
npm install
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

# Start production server
npm start
```

### Linting

```bash
# Run ESLint
npm run lint
```

## Configuration

### API Endpoint

The application needs to connect to a merm8 API instance. Configure it via:

1. **Environment Variable** (at build time):
   ```bash
   NEXT_PUBLIC_MERM8_API_URL=https://api.merm8.app npm run build
   ```

2. **UI Configuration** (at runtime):
   - Use the API Config panel
   - Enter any merm8 API endpoint URL
   - The app saves your selection in browser storage

### Local API Setup

For development against a local merm8 API instance:

```bash
NEXT_PUBLIC_MERM8_API_URL=http://localhost:8080 npm run dev
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

The Dockerfile uses a multi-stage build for minimal image size, with nginx serving the static Next.js output.

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
   NEXT_PUBLIC_MERM8_API_URL=https://api.merm8.app
   ```
5. Deploy!

See [netlify.toml](netlify.toml) for configuration details.

### Vercel

Deploy directly to Vercel with minimal setup:

1. Push code to GitHub
2. Import project in Vercel dashboard
3. Add environment variable:
   ```
   NEXT_PUBLIC_MERM8_API_URL=https://api.merm8.app
   ```
4. Deploy!

See [vercel.json](vercel.json) for configuration details.

### Self-Hosted

For custom deployments:

1. Build: `npm run build`
2. Serve the `out` directory with any web server (nginx, Apache, etc.)
3. Ensure `NEXT_PUBLIC_MERM8_API_URL` is set before build
4. Configure CORS if API is on different domain

## Architecture

**merm8-splash** is built with modern web technologies:

- **[Next.js](https://nextjs.org/)** 15 — React framework for production
- **[React](https://react.dev/)** 19 — UI library
- **[TypeScript](https://www.typescriptlang.org/)** — Type-safe development
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first styling
- **[Mermaid](https://mermaid.js.org/)** — Diagram rendering
- **[Axios](https://axios-http.com/)** — HTTP client for API calls

The application is a **pure frontend** that communicates with a remote merm8 API instance via REST API. No backend server required.

## Project Structure

```
.
├── app/
│   ├── components/          # React components
│   │   ├── ApiConfigPanel   # API endpoint configuration
│   │   ├── DiagramEditor    # Code editor
│   │   ├── DiagramPreview   # Mermaid rendering
│   │   ├── RulesPanel       # Rule configuration
│   │   ├── ResultsPanel     # Analysis results
│   │   └── ...
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Main page
│   └── globals.css          # Global styles
├── lib/
│   ├── api.ts               # merm8 API client
│   ├── keyboard.ts          # Keyboard shortcut handling
│   ├── useDiagramAnalysis   # Analysis state hook
│   └── ...
├── Dockerfile               # Docker configuration
├── netlify.toml             # Netlify configuration
├── vercel.json              # Vercel configuration
└── tailwind.config.ts       # Tailwind CSS config
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
4. Test locally: `npm run dev` and `npm run lint`
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

- Check the [Setup](#development) section for common issues
- [Search existing issues](https://github.com/CyanAutomation/merm8-splash/issues) for solutions
- Open a new issue if you need help
