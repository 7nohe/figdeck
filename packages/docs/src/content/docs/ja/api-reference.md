---
title: API リファレンス
---

## CLI

### コマンド

#### `init` - テンプレート作成

サポートされている全ての Markdown 記法の例を含む `slides.md` テンプレートを作成します。オプションで各種コーディングアシスタント向けの AI エージェントルールファイルも生成できます。

```bash
figdeck init [options]
```

| オプション | 説明 | デフォルト |
|------------|------|-----------|
| `-o, --out <path>` | 出力ファイルパス | `slides.md` |
| `-f, --force` | 既存ファイルを上書き | - |
| `--ai-rules [targets]` | AI エージェントルールを生成 (agents,claude,cursor,copilot または all) | - |
| `--no-slides` | slides.md の生成をスキップ | - |
| `-h, --help` | ヘルプ表示 | - |

**AI ルールのターゲット:**

| ターゲット | 生成ファイル | 対象ツール |
|------------|--------------|------------|
| `agents` | `AGENTS.md` | Codex CLI, Cursor (AGENTS.md) |
| `claude` | `.claude/rules/figdeck.md` | Claude Code |
| `cursor` | `.cursor/rules/figdeck.mdc` | Cursor |
| `copilot` | `.github/instructions/figdeck.instructions.md` | GitHub Copilot |

**例:**

```bash
# カレントディレクトリに slides.md を作成
figdeck init

# カスタムファイル名で作成
figdeck init -o presentation.md

# 既存ファイルを上書き
figdeck init --force

# 全ての AI エージェントルールを生成
figdeck init --ai-rules all

# 特定のルールのみ生成
figdeck init --ai-rules claude,cursor

# 既存プロジェクトにルールを追加（slides.md はそのまま）
figdeck init --ai-rules all --no-slides
```

#### `build` - JSON 出力

Markdown をパースして JSON を出力します（ワンショット）。

```bash
figdeck build <file> [options]
```

| 引数 | 説明 | 必須 |
|------|------|------|
| `<file>` | Markdown ファイルパス | Yes |

| オプション | 説明 | デフォルト |
|------------|------|-----------|
| `-o, --out <path>` | 出力ファイルパス | stdout |
| `-h, --help` | ヘルプ表示 | - |

**例:**

```bash
# stdout に出力
figdeck build slides.md

# ファイルに出力
figdeck build slides.md -o slides.json

# パイプで他のコマンドに渡す
figdeck build slides.md | jq '.[] | .title'
```

#### `serve` - WebSocket サーバー

WebSocket サーバーを起動して Plugin からの接続を待機します。ファイル監視モードはデフォルトで有効です。

```bash
figdeck serve <file> [options]
```

| 引数 | 説明 | 必須 |
|------|------|------|
| `<file>` | Markdown ファイルパス | Yes |

| オプション | 説明 | デフォルト |
|------------|------|-----------|
| `--host <host>` | WebSocket ホスト | `127.0.0.1` |
| `-p, --port <port>` | WebSocket ポート | `4141` |
| `--no-watch` | ファイル監視を無効化 | - |
| `--allow-remote` | 非ループバックホストへのバインドを許可 | - |
| `--secret <secret>` | このシークレットで認証を要求 | - |
| `--no-auth` | 認証を無効化（リモート接続時は非推奨） | - |
| `-h, --help` | ヘルプ表示 | - |

**例:**

```bash
# 基本的な使用（ファイル監視モードはデフォルトで有効）
figdeck serve slides.md

# ポート指定
figdeck serve slides.md --port 8080

# ファイル監視を無効化
figdeck serve slides.md --no-watch

# 外部からの接続を許可（--allow-remote が必要）
figdeck serve slides.md --host 0.0.0.0 --allow-remote

# リモートアクセス + 認証
figdeck serve slides.md --host 0.0.0.0 --allow-remote --secret my-secret
```

## YAML Frontmatter

Markdown ファイルの先頭、または各スライドの先頭で YAML frontmatter を使用してスタイルを設定できます。

### グローバル設定（ファイル先頭）

```yaml
---
background: "#1a1a2e"
color: "#ffffff"
headings:
  h1: { size: 72, color: "#fff" }
  h2: { size: 56 }
paragraphs: { size: 24 }
slideNumber:
  show: true
  position: bottom-right
---

# 最初のスライド
```

### スライド個別設定

```markdown
---

background: "#0d1117"
color: "#58a6ff"
---
## このスライドだけ別の背景
```

### 設定プロパティ

| プロパティ | 型 | 説明 |
|------------|------|------|
| `cover` | `boolean` | 1枚目を表紙として扱う（デフォルト: `true`） |
| `background` | `string \| object` | 統一された背景設定: string（色/グラデーション/画像/コンポーネント）または object（`color`, `gradient`, `template`, `image`, `component`） |
| `color` | `string` | 基本テキスト色（全要素に適用） |
| `headings` | `object` | 見出しスタイル（h1〜h4） |
| `paragraphs` | `object` | 段落スタイル |
| `bullets` | `object` | 箇条書きスタイル |
| `code` | `object` | コードブロックスタイル |
| `fonts` | `object` | カスタムフォント設定 |
| `slideNumber` | `object \| boolean` | スライド番号設定 |
| `titlePrefix` | `object \| false` | タイトルプレフィックス設定 |
| `align` | `string` | 水平方向配置（`left`, `center`, `right`） |
| `valign` | `string` | 垂直方向配置（`top`, `middle`, `bottom`） |

## WebSocket API

CLI は Figma Plugin と WebSocket 経由で通信します（デフォルトポート: `ws://localhost:4141`）。

`figdeck serve` を実行すると、CLI が自動的に接続されたプラグインにスライドデータを送信します。通常、WebSocket API を直接操作する必要はありません。
