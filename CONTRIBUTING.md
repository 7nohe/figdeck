# Contributing

Thank you for your interest in contributing to figdeck!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/yourname/figdeck.git
cd figdeck

# Install dependencies
bun install

# Build all packages
bun run build
```

## Development

```bash
# CLI development (watch mode)
cd packages/cli && bun run dev

# Build plugin
cd packages/plugin && bun run build

# Run tests
bun test
```

## Debugging CLI

```bash
# Build CLI first
cd packages/cli && bun run build

# Run serve command (starts WebSocket server on port 4141)
bun run packages/cli/dist/index.js serve examples/sample.md

# Run build command (outputs JSON to stdout)
bun run packages/cli/dist/index.js build examples/sample.md

# Output JSON to file
bun run packages/cli/dist/index.js build examples/sample.md -o out.json
```

## Pull Requests

1. Create a feature branch
2. Implement your changes
3. Ensure tests pass (`bun test`)
4. Ensure build passes (`bun run build`)
5. Open a PR

---

# Releasing

Release procedure for maintainers.

## Prerequisites

- `NPM_TOKEN` secret configured in GitHub repository
- Permission to publish the plugin in Figma Desktop app

## Release Flow

```
1. Run Release workflow
         ↓
2. Publish Figma plugin manually
         ↓
3. Run Publish to npm workflow
```

## Steps

### 1. Run Release Workflow

GitHub Actions → Release → Run workflow

- `version`: Version to release (e.g., `1.2.3`)

This workflow will:
- Update version in `packages/cli/package.json` and `packages/plugin/package.json`
- Run tests and build
- Commit version bump to main
- Create GitHub Release (tag: `v1.2.3`)

### 2. Publish Figma Plugin

1. Open Figma Desktop app
2. Go to Plugins → Development → figdeck
3. Click "Publish new version"
4. Enter release notes and publish

### 3. Run Publish to npm Workflow

GitHub Actions → Publish to npm → Run workflow

- `confirm`: Check the box (confirms Figma plugin is published)

This workflow will:
- Run tests and build
- Publish `packages/cli` to npm

## Verification

- [ ] New release is created in GitHub Releases
- [ ] New plugin version is published on Figma Community
- [ ] New version is published on npm (`npm view figdeck versions`)
