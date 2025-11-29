# Figma Plugin セットアップ

## 開発用セットアップ

### 1. Plugin をビルド

```bash
cd packages/plugin
bun run build
```

### 2. Figma にプラグインを読み込む

1. Figma Desktop アプリを開く
2. メニュー → Plugins → Development → Import plugin from manifest...
3. `packages/plugin/manifest.json` を選択

### 3. Plugin を起動

1. Figma Slides ドキュメントを開く（または新規作成）
2. メニュー → Plugins → Development → figdeck

Plugin が起動し、WebSocket 接続を試みます。

## 動作確認

### 1. CLI を起動

```bash
bun run packages/cli/dist/index.js build examples/sample.md
```

CLI が WebSocket サーバーを起動し、接続待機状態になります：

```
Parsed 4 slides from examples/sample.md
WebSocket server started on ws://localhost:4141
Waiting for Figma plugin to connect...
```

### 2. Plugin で接続

Figma で Plugin を起動すると、自動的に CLI に接続し、スライドが生成されます。

Plugin UI には接続状態とログが表示されます：

- 緑: Connected - Waiting for slides...
- 黄: Connecting to WebSocket server...
- 赤: Disconnected - Reconnecting...

## manifest.json 設定

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

### 重要な設定

- `networkAccess.allowedDomains`: WebSocket 接続に必要
- `ui`: WebSocket クライアントを含む HTML
- `documentAccess`: スライド作成に必要

## トラブルシューティング

### 接続できない

1. CLI が起動しているか確認
2. ポート 4141 が他のプロセスで使用されていないか確認
3. ファイアウォール設定を確認

### スライドが生成されない

1. Figma Slides ドキュメントで実行しているか確認
2. Plugin コンソールでエラーを確認（Figma → Plugins → Development → Open Console）

### フォントエラー

Plugin は Inter フォントを使用します。フォントが利用できない場合はエラーになります。
