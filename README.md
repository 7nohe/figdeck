# figdeck

Markdown を Figma Slides に変換する CLI + Plugin システム

## 概要

figdeck は Markdown ファイルから Figma Slides を自動生成するツールです。CLI で Markdown をパースし、Figma Plugin と WebSocket で連携してスライドを作成します。

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/your-username/figdeck.git
cd figdeck

# 依存関係をインストール
bun install

# ビルド
bun run build
```

## 使い方

### 1. CLI でスライドデータを送信

```bash
bun run packages/cli/dist/index.js build your-slides.md
```

CLI は WebSocket サーバー（port: 4141）を起動し、Plugin からの接続を待機します。

### 2. Figma Plugin を起動

1. Figma でプラグインを開発モードで読み込み
2. Plugin が自動的に CLI に接続
3. スライドが自動生成される

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

## CLI オプション

```bash
figdeck build <file> [options]

Options:
  --host <host>  WebSocket ホスト (default: "localhost")
  -p, --port <port>  WebSocket ポート (default: "4141")
  -V, --version  バージョン表示
  -h, --help     ヘルプ表示
```

## プロジェクト構成

```
figdeck/
├── packages/
│   ├── cli/          # CLI パッケージ
│   └── plugin/       # Figma Plugin
├── examples/         # サンプル Markdown
├── docs/             # ドキュメント
└── README.md
```

## 開発

```bash
# CLI のウォッチモード
cd packages/cli && bun run dev

# Plugin のウォッチモード
cd packages/plugin && bun run watch
```

## ライセンス

MIT
