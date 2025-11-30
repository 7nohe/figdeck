# Suggested commands
- Install deps: `bun install`
- Lint: `bun run lint` (Biome); Format fix: `bun run format`; Combined check/fix: `bun run check`
- Type check: `bun run typecheck`
- Build all workspaces: `bun run build`; Dev CLI watch: `bun run dev` (filters @figdeck/cli)
- CLI package: `cd packages/cli && bun run dev` (tsup watch) or `bun run build`; run CLI after build: `bun run packages/cli/dist/index.js build <file.md>` or `bun run figdeck -- build <file.md>` if linked.
- Plugin package: `cd packages/plugin && bun run build` or `bun run watch`; load `packages/plugin/manifest.json` in Figma (Plugins → Development → Import) then run via Plugins → Development → figdeck.
- Example end-to-end: `bun run packages/cli/dist/index.js build examples/sample.md` then start plugin in Figma to receive slides over WS 4141.
- Common shell tools (Darwin): `ls`, `pwd`, `cd`, `cat`, `rg` for searches, `find`, `git status`/`git diff` for version control.