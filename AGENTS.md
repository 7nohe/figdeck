# Repository Guidelines

## Project Structure & Modules
- Root uses Bun workspaces. Code lives under `packages/` with `cli` (Markdown → Figma Slides CLI, WebSocket server) and `plugin` (Figma plugin bundle with `code.ts` + `ui.html`). Tests sit in `packages/cli/src/*.test.ts`. Reference Markdown samples in `examples/`, extra docs in `docs/`. Build outputs land in each package’s `dist/`.

## Build, Test, and Development Commands
- Install deps: `bun install`.
- Build all packages: `bun run build` (runs tsup for the CLI and esbuild for the plugin).
- Dev/watch: `cd packages/cli && bun run dev` for the CLI; `cd packages/plugin && bun run watch` for plugin reloads.
- Type-check everything: `bun run typecheck`.
- Lint/format via Biome: `bun run lint` (check), `bun run format` (write). Prefer format before committing.
- Tests: `cd packages/cli && bun test` (uses `bun:test`; mirrors the `*.test.ts` files in `src/`).

## Coding Style & Naming Conventions
- TypeScript with ES modules. Follow Biome defaults: 2-space indentation, double quotes, required semicolons. Config lives in `biome.json`.
- Keep CLI utilities pure and reusable under `packages/cli/src/`; add WebSocket-facing code in `ws-server.ts`.
- Use `camelCase` for functions/variables, `PascalCase` for types/interfaces, and `kebab-case` for file names.

## Testing Guidelines
- Add `*.test.ts` alongside the logic in `packages/cli/src/`; prefer unit tests with clear inputs/outputs (e.g., color normalization, gradient parsing).
- When touching parsing or rendering rules, include edge cases (whitespace, shorthand colors, gradient angles). Avoid relying on network/Figma in tests.
- Run `bun test` plus `bun run lint` before opening a PR.

## Commit & Pull Request Guidelines
- Commit messages: short, imperative summaries; prefix with a scope when helpful (e.g., `feat:`, `fix:`, `chore:`). Keep changes cohesive per commit.
- Pull requests: include a concise description, testing notes (commands run), and link related issues. For plugin UI/visual tweaks, attach a screenshot or brief demo steps. Ensure builds succeed (`bun run build`) before requesting review.

## Security & Configuration Tips
- The CLI listens on port 4141 for the plugin; avoid exposing it publicly. Do not commit Figma tokens or personal files from `dist/`. Regenerate `dist/` assets via the build commands rather than checking in manual edits.
