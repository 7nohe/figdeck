# figdeck

Markdown を Figma Slides に変換する CLI + Plugin システム

## 概要

figdeck は Markdown ファイルから Figma Slides を自動生成するツールです。CLI で Markdown をパースし、Figma Plugin と WebSocket で連携してスライドを作成します。

## インストール

### Figma Plugin

Figma Community から figdeck プラグインをインストール：

**[figdeck - Figma Community](https://www.figma.com/community/plugin/1577342026252824260/figdeck)**

### CLI

```bash
# グローバルインストール
npm install -g figdeck

# または npx で直接実行
npx figdeck your-slides.md
```

## 使い方

### 方法 1: WebSocket 連携（ライブリロード対応）

> [!NOTE]
> WebSocket 接続には **Figma デスクトップアプリ** が必要です。Web ブラウザ版はセキュリティ制約により localhost に接続できません。

```bash
# CLI で WebSocket サーバーを起動（ウォッチモードがデフォルトで有効）
npx figdeck your-slides.md

# serve コマンドを明示的に指定することも可能
npx figdeck serve your-slides.md

# ウォッチモードを無効にする場合
npx figdeck your-slides.md --no-watch
```

1. Figma デスクトップアプリで figdeck プラグインを開く
2. Plugin の「WebSocket」タブで CLI に接続
3. スライドが自動生成される

### 方法 2: JSON インポート（デスクトップ・Web 両対応）

```bash
# Markdown から JSON を出力
npx figdeck build your-slides.md -o slides.json
```

1. Figma で figdeck プラグインを開く
2. Plugin の「Import JSON」タブを選択
3. JSON をペーストするか、ファイルを選択して読み込み
4. 「Generate Slides」でスライドを生成

## Markdown 記法

```markdown
---
# タイトルスライド

サブタイトルやメッセージ

---
## コンテンツスライド

本文テキスト

- 箇条書き1
- 箇条書き2
- 箇条書き3

---
# まとめ

ご清聴ありがとうございました
```

### スライド区切り

- `---`（水平線）でスライドを区切る

### 見出し

- `# H1` → タイトルスライド（大きいフォント）
- `## H2` → コンテンツスライド

### 本文

- 段落 → 本文テキストとして追加
- リスト → 箇条書きとして追加

### スライドのスタイル設定

YAML フロントマターで背景色とテキスト色を設定できます。

#### グローバル設定（ファイル先頭）

```markdown
---
background: "#1a1a2e"
color: "#ffffff"
---

# 全スライドにダーク背景＆白テキスト
```

#### 個別スライドの設定

各スライドの先頭にフロントマターを追加して上書き：

```markdown
---

---
background: "#3b82f6"
color: "#ffffff"
---

# このスライドだけ青背景
```

#### オプション一覧

| オプション | 説明 | 例 |
|-----------|------|-----|
| `background` | 背景色 | `"#1a1a2e"` |
| `gradient` | グラデーション | `"#000:0%,#fff:100%@90"` |
| `template` | Figma ペイントスタイル | `"Background/Dark"` |
| `color` | テキスト色 | `"#ffffff"` |

#### グラデーション構文

```
#color1:position1%,#color2:position2%,...@angle
```

- `color`: 色（hex または rgb/rgba）
- `position`: 位置（0-100%）
- `angle`: 角度（度）、省略時は 0

#### 優先順位

個別スライドのフロントマター > グローバルフロントマター

## CLI コマンド

### `build` - JSON 出力

```bash
figdeck build <file> [options]

Options:
  -o, --out <path>  出力ファイルパス（省略時は stdout）
  -h, --help        ヘルプ表示
```

### `serve` - WebSocket サーバー

```bash
figdeck serve <file> [options]

Options:
  --host <host>      WebSocket ホスト (default: "localhost")
  -p, --port <port>  WebSocket ポート (default: "4141")
  --no-watch         ファイル変更の監視を無効化（デフォルトは有効）
  --allow-remote     非ローカルホストからの接続を許可
  --secret <secret>  リモート接続の認証シークレット
  -h, --help         ヘルプ表示
```

> [!WARNING]
> `--allow-remote` を使用すると、ポート `4141` がネットワークに公開されます。`--secret` を使用して認証を有効にしてください。

## プロジェクト構成

```
figdeck/
├── packages/
│   ├── cli/          # CLI パッケージ
│   ├── plugin/       # Figma Plugin
│   └── docs/         # ドキュメントサイト
├── examples/         # サンプル Markdown
└── README.md
```

## ドキュメント

- [Markdown 仕様](packages/docs/src/content/docs/ja/markdown-spec.md) - 対応する Markdown 記法
- [API リファレンス](packages/docs/src/content/docs/ja/api-reference.md) - CLI コマンドと型定義
- [アーキテクチャ](packages/docs/src/content/docs/ja/architecture.md) - システム構成とデータフロー
- [Plugin セットアップ](packages/docs/src/content/docs/ja/plugin-setup.md) - Figma Plugin のインストール手順

## 開発

```bash
# CLI のウォッチモード
cd packages/cli && bun run dev

# Plugin のウォッチモード
cd packages/plugin && bun run watch
```

## ライセンス

MIT
