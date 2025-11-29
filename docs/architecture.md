# アーキテクチャ

## 全体構成

```
┌─────────────────────┐         ┌─────────────────────┐
│    CLI (Node.js)    │  WS     │   Figma Plugin      │
│                     │ ◄─────► │                     │
│  - Markdown Parser  │ :4141   │  - WebSocket Client │
│  - WebSocket Server │         │  - Slide Generator  │
└─────────────────────┘         └─────────────────────┘
```

## コンポーネント

### CLI (`packages/cli`)

Markdown ファイルを読み込み、パースして SlideContent 配列に変換し、WebSocket サーバーを起動して Plugin からの接続を待機します。

**主要ファイル:**

- `src/index.ts` - CLI エントリポイント（commander）
- `src/markdown.ts` - Markdown → SlideContent 変換（remark）
- `src/ws-server.ts` - WebSocket サーバー
- `src/types.ts` - 共通型定義

### Plugin (`packages/plugin`)

Figma 内で動作し、CLI からスライドデータを受信して `figma.createSlide()` API でスライドを生成します。

**主要ファイル:**

- `src/code.ts` - Plugin メインロジック
- `ui.html` - WebSocket クライアント UI
- `manifest.json` - Plugin 設定

## データフロー

```
1. CLI: Markdown ファイル読み込み
   ↓
2. CLI: remark で AST にパース
   ↓
3. CLI: AST → SlideContent[] に変換
   ↓
4. CLI: WebSocket サーバー起動 (port 4141)
   ↓
5. Plugin: UI が WebSocket で CLI に接続
   ↓
6. CLI: { type: "generate-slides", slides: [...] } を送信
   ↓
7. Plugin: UI が postMessage で code.ts に転送
   ↓
8. Plugin: figma.createSlide() でスライド生成
```

## WebSocket プロトコル

### CLI → Plugin

```json
{
  "type": "generate-slides",
  "slides": [
    {
      "type": "title",
      "title": "スライドタイトル",
      "body": ["本文1", "本文2"],
      "bullets": ["箇条書き1", "箇条書き2"]
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
  "message": "エラーメッセージ"
}
```

## 設計判断

### WebSocket の役割反転

当初の計画では Plugin 側が WebSocket サーバーでしたが、Figma Plugin のサンドボックス制約により、CLI をサーバー、Plugin をクライアントとする構成に変更しました。

### UI 経由の通信

Figma Plugin の `code.ts` は直接ネットワークアクセスできないため、`ui.html` が WebSocket クライアントとして動作し、`postMessage` で `code.ts` にデータを転送します。
