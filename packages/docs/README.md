# figdeck Documentation

This is the documentation site for [figdeck](https://github.com/7nohe/figdeck), built with [Astro Starlight](https://starlight.astro.build/).

## Overview

figdeck is a tool that converts Markdown files into Figma Slides via a CLI + Figma Plugin architecture. This documentation site provides comprehensive guides, API references, and examples for using figdeck.

## 🚀 Project Structure

```
packages/docs/
├── src/
│   ├── assets/          # Images and static assets
│   ├── content/
│   │   └── docs/        # Documentation content
│   │       ├── en/      # English documentation
│   │       └── ja/      # Japanese documentation
│   └── content.config.ts # Content configuration
├── astro.config.mjs     # Astro configuration
├── package.json
└── tsconfig.json
```

Documentation files are written in Markdown (`.md`) or MDX (`.mdx`) format and placed in `src/content/docs/`. Each file is exposed as a route based on its file name.

## 🧞 Commands

All commands are run from the `packages/docs/` directory:

| Command                | Action                                           |
| :--------------------- | :----------------------------------------------- |
| `bun install`          | Installs dependencies                            |
| `bun run dev`         | Starts local dev server at `localhost:4321`     |
| `bun run build`       | Build your production site to `./dist/`          |
| `bun run preview`     | Preview your build locally, before deploying    |
| `bun run typecheck`   | Type-check TypeScript files                      |
| `bun run astro ...`   | Run CLI commands like `astro add`, `astro check` |

## Development

### Local Development

```bash
cd packages/docs
bun install
bun run dev
```

The documentation site will be available at `http://localhost:4321`.

### Building for Production

```bash
cd packages/docs
bun run build
```

The production build will be output to `./dist/`.

### Preview Production Build

```bash
cd packages/docs
bun run preview
```

## Documentation Structure

The documentation is organized into the following sections:

- **Overview** - Introduction to figdeck
- **Getting Started** - Installation and plugin setup guides
- **Reference** - Markdown syntax, architecture, and API reference
- **Release Notes** - Version history and changelog

Both English and Japanese versions are available.

## Deployment

The documentation site is deployed at [https://figdeck.7nohe.dev](https://figdeck.7nohe.dev).

## Learn More

- [Starlight Documentation](https://starlight.astro.build/)
- [Astro Documentation](https://docs.astro.build)
- [figdeck GitHub Repository](https://github.com/7nohe/figdeck)
