---
title: Plugin Setup
---

## Install the Plugin

Install the figdeck plugin from Figma Community:

**[figdeck - Figma Community](https://www.figma.com/community/plugin/1577342026252824260/figdeck)**

1. Click the link above to open the plugin page in Figma Community
2. Click the "Install" button
3. The plugin will be added to your Figma account

## Using the Plugin

### 1. Create a Sample Slide

First, generate a sample Markdown file using the `init` command:

```bash
figdeck init
```

This creates a `slides.md` file with example content demonstrating all available features.

### 2. Start the CLI

Start the figdeck CLI server with your Markdown file:

```bash
figdeck serve slides.md
```

The CLI will start a WebSocket server and wait for the plugin to connect:

```
Parsed 4 slides from slides.md
WebSocket server started on ws://127.0.0.1:4141
Waiting for Figma plugin to connect...
```

### 3. Open Figma Slides

1. Open the Figma Desktop app
2. Create a new Figma Slides document (or open an existing one)
3. Go to Menu → Plugins → figdeck

### 4. Connect to CLI

When you launch the plugin, it will automatically attempt to connect to the CLI running on `localhost:4141`.

The plugin UI shows the connection status:

- **Green**: Connected - Waiting for slides...
- **Yellow**: Connecting to WebSocket server... / Authenticating...
- **Red**: Disconnected - Reconnecting... / Authentication failed

Once connected, your slides will be automatically generated in Figma!

## Remote Connection

If you need to connect from a different machine on your network:

### 1. Start CLI with Remote Access

```bash
figdeck serve slides.md --host 0.0.0.0 --allow-remote
```

The CLI will display an authentication secret:

```
Authentication secret: abc123xyz...
```

### 2. Enter Secret in Plugin

1. Launch the plugin in Figma
2. Enter the secret shown in the CLI output into the "Secret" field
3. Click "Connect"

## Troubleshooting

### Cannot Connect

1. **Verify CLI is running**: Make sure the `figdeck serve` command is running
2. **Check port 4141**: Ensure port 4141 is not being used by another process
3. **Check firewall settings**: Make sure your firewall allows connections on port 4141
4. **Try localhost**: For local connections, use `127.0.0.1` (default)

### Slides Not Generated

1. **Verify Figma Slides document**: Make sure you're running the plugin in a Figma Slides document (not a regular Figma file)
2. **Check plugin console**: Open the plugin console to see error messages (Figma → Plugins → Development → Open Console)
3. **Verify Markdown file**: Ensure your Markdown file is valid and contains slide separators (`---`)

### Connection Timeout

- For remote connections, make sure you've started the CLI with `--allow-remote` flag
- Enter the authentication secret correctly in the plugin UI
- Check that both machines are on the same network (for local network connections)
