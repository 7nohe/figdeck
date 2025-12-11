---
title: Architecture
---

## How figdeck Works

figdeck consists of two main components that work together to convert Markdown into Figma Slides:

```
┌─────────────────────┐         ┌─────────────────────┐
│   CLI Tool          │         │   Figma Plugin      │
│                     │         │                     │
│  - Reads Markdown   │         │  - Runs in Figma    │
│  - Parses content   │         │  - Receives data    │
│  - Converts to data │         │  - Creates slides  │
└─────────────────────┘         └─────────────────────┘
```

## Two Ways to Use figdeck

### 1. WebSocket Mode (Recommended)

The most common way to use figdeck is with live preview:

1. **Start CLI**: Run `figdeck serve slides.md` in your terminal
2. **Open Plugin**: Launch the figdeck plugin in Figma
3. **Automatic Connection**: The plugin connects to the CLI automatically
4. **Live Updates**: When you edit your Markdown file, changes are instantly reflected in Figma

**Benefits:**
- Real-time preview as you edit
- Automatic updates when files change
- No need to manually export/import files

### 2. JSON Import Mode

For one-time generation or when you can't use WebSocket:

1. **Generate JSON**: Run `figdeck build slides.md -o slides.json`
2. **Open Plugin**: Launch the figdeck plugin in Figma
3. **Import JSON**: Use the "Import JSON" tab to paste or select the JSON file
4. **Generate**: Click to create slides

**Benefits:**
- Works without CLI running
- Can share JSON files with others
- Useful for CI/CD pipelines

## Data Flow

### WebSocket Mode

```
Markdown File
    ↓
CLI parses and converts
    ↓
WebSocket connection (localhost:4141)
    ↓
Figma Plugin receives data
    ↓
Slides created in Figma
```

### JSON Import Mode

```
Markdown File
    ↓
CLI parses and converts
    ↓
JSON file generated
    ↓
Figma Plugin imports JSON
    ↓
Slides created in Figma
```

## Components

### CLI Tool

The CLI is a command-line tool that:
- Reads your Markdown files
- Parses the content and converts it to structured data
- Provides two modes: `serve` (WebSocket) and `build` (JSON export)

### Figma Plugin

The plugin runs inside Figma and:
- Connects to the CLI via WebSocket (in serve mode)
- Accepts JSON imports (in build mode)
- Creates slides using Figma's native slide creation API
- Handles styling, fonts, images, and all slide content

## Security

figdeck includes security features to protect your system:

- **Local by Default**: WebSocket connections default to localhost only
- **Remote Access**: Requires explicit `--allow-remote` flag for network connections
- **Authentication**: Auto-generated secrets for remote connections
- **Input Validation**: All data is validated before processing
