# Task completion checklist
- Ensure dependencies installed (`bun install`) if new packages added.
- Run linters/formatters: `bun run lint`; auto-fix with `bun run check` or `bun run format`.
- Run type checks: `bun run typecheck`; for package-specific changes use `cd packages/cli && bun run typecheck` or `cd packages/plugin && bun run typecheck`.
- Build targets to catch bundling issues: `bun run build` (root) or package-level builds (`bun run build` in packages/cli or packages/plugin`).
- For CLI/WS flow changes, quick manual test: `bun run packages/cli/dist/index.js build examples/sample.md` then connect plugin in Figma.
- Update docs/examples if behavior changes.
- Note: no automated tests present; rely on lint/typecheck/build/manual check.