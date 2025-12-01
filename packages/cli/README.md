# figdeck

CLI for converting Markdown to Figma Slides.

## Installation

```bash
# Global install
npm install -g figdeck

# Or use directly with npx
npx figdeck your-slides.md
```

## Usage

### serve (WebSocket mode, default)

Start a WebSocket server that connects to the Figma Plugin:

```bash
# Default command - serve can be omitted
figdeck your-slides.md

# Or explicitly
figdeck serve your-slides.md
```

Options:
- `--host <host>` - Host to bind (default: 127.0.0.1)
- `--port <port>` - Port to bind (default: 4141)
- `--no-watch` - Disable file watching
- `--allow-remote` - Allow non-loopback hosts
- `--secret <secret>` - Authentication secret

### build (JSON output)

Parse Markdown and output JSON:

```bash
# Output to stdout
figdeck build slides.md

# Output to file
figdeck build slides.md -o output.json
```

## Figma Plugin

This CLI works with the figdeck Figma Plugin. Install the plugin in Figma, then connect to your running CLI server.

For more details, see the [GitHub repository](https://github.com/7nohe/figdeck).

## Markdown Format

```markdown
---
background: "#1a1a2e"
---

# Title Slide

Creates a title slide with H1.

---

## Content Slide

Creates a content slide with H2.

- Bullet points
- **Bold** and *italic*
- `inline code`
```

## License

MIT
