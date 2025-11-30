# Figma Plugin Setup

## Development Setup

### 1. Build the Plugin

```bash
cd packages/plugin
bun run build
```

### 2. Load the Plugin in Figma

1. Open Figma Desktop app
2. Menu → Plugins → Development → Import plugin from manifest...
3. Select `packages/plugin/manifest.json`

### 3. Launch the Plugin

1. Open a Figma Slides document (or create a new one)
2. Menu → Plugins → Development → figdeck

The Plugin will launch and attempt to connect via WebSocket.

## Verification

### 1. Start the CLI

```bash
bun run packages/cli/dist/index.js serve examples/sample.md
```

The CLI starts a WebSocket server and enters a waiting state:

```
Parsed 4 slides from examples/sample.md
WebSocket server started on ws://127.0.0.1:4141
Waiting for Figma plugin to connect...
```

### 2. Connect from Plugin

When you launch the Plugin in Figma, it automatically connects to the CLI and slides are generated.

The Plugin UI displays connection status and logs:

- Green: Connected - Waiting for slides...
- Yellow: Connecting to WebSocket server... / Authenticating...
- Red: Disconnected - Reconnecting... / Authentication failed

### 3. Remote Connection (Optional)

For network connections, security options are required:

```bash
# Allow remote access (authentication secret is auto-generated)
bun run packages/cli/dist/index.js serve examples/sample.md --host 0.0.0.0 --allow-remote
```

Enter the secret shown in the CLI output into the "Secret" field in the Plugin UI.

## manifest.json Configuration

```json
{
  "name": "figdeck",
  "id": "figdeck-plugin",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma", "figjam"],
  "documentAccess": "dynamic-page",
  "networkAccess": {
    "allowedDomains": ["*"]
  }
}
```

### Important Settings

- `networkAccess.allowedDomains`: Required for WebSocket connections
- `ui`: HTML containing the WebSocket client
- `documentAccess`: Required for slide creation

## Troubleshooting

### Cannot Connect

1. Verify CLI is running
2. Check if port 4141 is in use by another process
3. Check firewall settings

### Slides Not Generated

1. Verify you're running in a Figma Slides document
2. Check Plugin console for errors (Figma → Plugins → Development → Open Console)

### Font Errors

The Plugin uses the Inter font. Errors will occur if the font is not available.
