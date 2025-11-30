# Architecture

## Overall Structure

```
                     WebSocket Integration
┌─────────────────────┐         ┌─────────────────────┐
│    CLI (Node.js)    │  WS     │   Figma Plugin      │
│                     │ ◄─────► │                     │
│  - Markdown Parser  │ :4141   │  - WebSocket Client │
│  - WebSocket Server │         │  - JSON Import      │
│  - JSON Output      │         │  - Slide Generator  │
└─────────────────────┘         └─────────────────────┘

                     JSON Import
┌─────────────────────┐         ┌─────────────────────┐
│    CLI (Node.js)    │  JSON   │   Figma Plugin      │
│                     │ ──────► │                     │
│  - Markdown Parser  │  file   │  - JSON Import      │
│  - JSON Output      │         │  - Slide Generator  │
└─────────────────────┘         └─────────────────────┘
```

## Components

### CLI (`packages/cli`)

Reads Markdown files, parses them, and converts them to a SlideContent array. There are two modes:

- **`serve`**: Starts a WebSocket server and waits for Plugin connections (with live reload support)
- **`build`**: Outputs JSON to stdout or a file (one-shot)

**Key Files:**

- `src/index.ts` - CLI entry point (commander)
- `src/markdown.ts` - Markdown → SlideContent conversion (remark)
- `src/ws-server.ts` - WebSocket server
- `src/types.ts` - Shared type definitions

### Plugin (`packages/plugin`)

Runs within Figma, receives slide data, and generates slides using the `figma.createSlide()` API. There are two input methods:

- **WebSocket**: Connects to CLI's `serve` command for real-time reception
- **JSON Import**: Loads JSON by pasting or selecting a file

**Key Files:**

- `src/code.ts` - Plugin main logic
- `ui.html` - WebSocket client + JSON Import UI
- `manifest.json` - Plugin configuration

## Data Flow

### WebSocket Integration (`serve` command)

```
1. CLI: Read Markdown file
   ↓
2. CLI: Parse to AST with remark
   ↓
3. CLI: Convert AST → SlideContent[]
   ↓
4. CLI: Start WebSocket server (port 4141)
   ↓
5. Plugin: UI connects to CLI via WebSocket
   ↓
6. CLI: Send { type: "generate-slides", slides: [...] }
   ↓
7. Plugin: UI forwards to code.ts via postMessage
   ↓
8. Plugin: Generate slides with figma.createSlide()
```

### JSON Import (`build` command + Plugin Import)

```
1. CLI: Read Markdown file
   ↓
2. CLI: Parse to AST with remark
   ↓
3. CLI: Convert AST → SlideContent[]
   ↓
4. CLI: Output JSON to stdout or file
   ↓
5. Plugin: Paste JSON or select file in "Import JSON" tab
   ↓
6. Plugin: Parse JSON and validate schema
   ↓
7. Plugin: UI forwards to code.ts via postMessage
   ↓
8. Plugin: Generate slides with figma.createSlide()
```

## WebSocket Protocol

### Authentication Handshake (for remote connections)

Plugin → CLI (immediately after connection):
```json
{
  "type": "auth",
  "secret": "secret string"
}
```

CLI → Plugin (authentication success):
```json
{
  "type": "auth-ok"
}
```

CLI → Plugin (authentication failure):
```json
{
  "type": "auth-error",
  "message": "Invalid secret"
}
```

### CLI → Plugin

```json
{
  "type": "generate-slides",
  "slides": [
    {
      "type": "title",
      "title": "Slide Title",
      "body": ["Body text 1", "Body text 2"],
      "bullets": ["Bullet 1", "Bullet 2"]
    }
  ]
}
```

### Plugin → CLI

```json
{
  "type": "success",
  "count": 4
}
```

```json
{
  "type": "error",
  "message": "Error message"
}
```

## Design Decisions

### WebSocket Role Reversal

The original plan had the Plugin as the WebSocket server, but due to Figma Plugin sandbox constraints, the architecture was changed to have CLI as the server and Plugin as the client.

### Communication via UI

Since Figma Plugin's `code.ts` cannot directly access the network, `ui.html` acts as the WebSocket client and forwards data to `code.ts` via `postMessage`.

## Security

### Network Exposure Protection

The CLI and Plugin implement security hardening for WebSocket connections:

**CLI Side:**
- Default host is `127.0.0.1` (local only)
- `--allow-remote` flag required for non-loopback hosts
- Authentication secret auto-generated for remote connections
- `maxPayload: 10MB` to prevent memory exhaustion

**Plugin Side:**
- Default host is `127.0.0.1`
- Warning banner displayed for non-loopback connections
- Payload validation: max 100 slides, max 50 blocks per slide
- Log entries limited to 100

### Input Validation

- Figma URLs: Strict hostname check (only `figma.com` or `*.figma.com` allowed)
- Slide data: Type checking and string length limit (100,000 characters)
