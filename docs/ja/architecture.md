# アーキテクチャ

## 全体構成

```
                     WebSocket 連携
┌─────────────────────┐         ┌─────────────────────┐
│    CLI (Node.js)    │  WS     │   Figma Plugin      │
│                     │ ◄─────► │                     │
│  - Markdown Parser  │ :4141   │  - WebSocket Client │
│  - WebSocket Server │         │  - JSON Import      │
│  - JSON Output      │         │  - Slide Generator  │
└─────────────────────┘         └─────────────────────┘

                     JSON インポート
┌─────────────────────┐         ┌─────────────────────┐
│    CLI (Node.js)    │  JSON   │   Figma Plugin      │
│                     │ ──────► │                     │
│  - Markdown Parser  │  file   │  - JSON Import      │
│  - JSON Output      │         │  - Slide Generator  │
└─────────────────────┘         └─────────────────────┘
```

## コンポーネント

### CLI (`packages/cli`)

Markdown ファイルを読み込み、パースして SlideContent 配列に変換します。2つのモードがあります：

- **`serve`**: WebSocket サーバーを起動して Plugin からの接続を待機（ライブリロード対応）
- **`build`**: JSON を stdout またはファイルに出力（ワンショット）

**主要ファイル:**

- `src/index.ts` - CLI エントリポイント（commander）
- `src/markdown.ts` - Markdown → SlideContent 変換（remark）
- `src/ws-server.ts` - WebSocket サーバー
- `src/types.ts` - 共通型定義

### Plugin (`packages/plugin`)

Figma 内で動作し、スライドデータを受信して `figma.createSlide()` API でスライドを生成します。2つの入力方法があります：

- **WebSocket**: CLI の `serve` コマンドに接続してリアルタイム受信
- **JSON Import**: JSON ファイルをペーストまたはファイル選択で読み込み

**主要ファイル:**

- `src/code.ts` - Plugin メインロジック
- `ui.html` - WebSocket クライアント + JSON Import UI
- `manifest.json` - Plugin 設定

## データフロー

### WebSocket 連携（`serve` コマンド）

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

### JSON Import（`build` コマンド + Plugin Import）

```
1. CLI: Markdown ファイル読み込み
   ↓
2. CLI: remark で AST にパース
   ↓
3. CLI: AST → SlideContent[] に変換
   ↓
4. CLI: JSON を stdout またはファイルに出力
   ↓
5. Plugin: UI の "Import JSON" タブで JSON をペースト/ファイル選択
   ↓
6. Plugin: JSON をパースしてスキーマ検証
   ↓
7. Plugin: UI が postMessage で code.ts に転送
   ↓
8. Plugin: figma.createSlide() でスライド生成
```

## WebSocket プロトコル

### 認証ハンドシェイク（リモート接続時）

Plugin → CLI（接続直後）:
```json
{
  "type": "auth",
  "secret": "シークレット文字列"
}
```

CLI → Plugin（認証成功）:
```json
{
  "type": "auth-ok"
}
```

CLI → Plugin（認証失敗）:
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

## セキュリティ

### ネットワーク露出の保護

CLI と Plugin は、WebSocket 接続のセキュリティを強化しています：

**CLI 側:**
- デフォルトホストは `127.0.0.1`（ローカルのみ）
- 非ループバックホストには `--allow-remote` フラグが必須
- リモート接続時は認証シークレットを自動生成
- `maxPayload: 10MB` でメモリ枯渇を防止

**Plugin 側:**
- デフォルトホストは `127.0.0.1`
- 非ループバック接続時に警告バナーを表示
- ペイロード検証: 最大100スライド、1スライドあたり最大50ブロック
- ログエントリを100件に制限

### 入力検証

- Figma URL: 厳格なホスト名チェック（`figma.com` または `*.figma.com` のみ許可）
- スライドデータ: 型チェックと文字列長制限（100,000文字）
