# API リファレンス

## CLI

### コマンド

```bash
figdeck build <file> [options]
```

### 引数

| 引数 | 説明 | 必須 |
|------|------|------|
| `<file>` | Markdown ファイルパス | Yes |

### オプション

| オプション | 説明 | デフォルト |
|------------|------|-----------|
| `--host <host>` | WebSocket ホスト | `localhost` |
| `-p, --port <port>` | WebSocket ポート | `4141` |
| `-w, --watch` | ファイル変更を監視して自動更新 | `false` |
| `-V, --version` | バージョン表示 | - |
| `-h, --help` | ヘルプ表示 | - |

### 例

```bash
# 基本的な使用
figdeck build slides.md

# ポート指定
figdeck build slides.md --port 8080

# ホスト指定
figdeck build slides.md --host 0.0.0.0

# ファイル監視モード（変更時に自動再送信）
figdeck build slides.md -w
```

## 型定義

### SlideContent

スライドのコンテンツを表す型です。

```typescript
interface SlideContent {
  type: "title" | "content";
  title?: string;
  body?: string[];
  bullets?: string[];
  codeBlocks?: CodeBlock[];
  blocks?: SlideBlock[];
  background?: SlideBackground;
  styles?: SlideStyles;
  slideNumber?: SlideNumberConfig;
}
```

| プロパティ | 型 | 説明 |
|------------|------|------|
| `type` | `"title" \| "content"` | スライドタイプ |
| `title` | `string?` | スライドタイトル |
| `body` | `string[]?` | 本文テキスト配列 |
| `bullets` | `string[]?` | 箇条書き配列 |
| `codeBlocks` | `CodeBlock[]?` | コードブロック配列 |
| `blocks` | `SlideBlock[]?` | リッチコンテンツブロック配列 |
| `background` | `SlideBackground?` | 背景設定 |
| `styles` | `SlideStyles?` | フォントサイズ・色設定 |
| `slideNumber` | `SlideNumberConfig?` | スライド番号設定 |

### SlideBlock

スライド内のコンテンツブロックを表す union 型です。

```typescript
type SlideBlock =
  | { kind: "paragraph"; text: string; spans?: TextSpan[] }
  | { kind: "heading"; level: 3 | 4; text: string; spans?: TextSpan[] }
  | { kind: "bullets"; items: string[]; ordered?: boolean; start?: number; itemSpans?: TextSpan[][] }
  | { kind: "code"; language?: string; code: string }
  | { kind: "image"; url: string; alt?: string }
  | { kind: "blockquote"; text: string; spans?: TextSpan[] }
  | { kind: "table"; headers: TextSpan[][]; rows: TextSpan[][][]; align?: TableAlignment[] }
  | { kind: "figma"; link: FigmaSelectionLink }
```

### TextSpan

インラインフォーマット情報を持つテキストスパンです。

```typescript
interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
}
```

### SlideBackground

スライド背景の設定です。

```typescript
interface SlideBackground {
  solid?: string;              // 単色（例: "#1a1a2e"）
  gradient?: {
    stops: GradientStop[];     // グラデーション色停止点
    angle?: number;            // 角度（度）
  };
  templateStyle?: string;      // Figma Paint Style 名
}

interface GradientStop {
  color: string;
  position: number;            // 0-1
}
```

### SlideStyles

フォントサイズと色の設定です。

```typescript
interface SlideStyles {
  headings?: {
    h1?: TextStyle;
    h2?: TextStyle;
    h3?: TextStyle;
    h4?: TextStyle;
  };
  paragraphs?: TextStyle;
  bullets?: TextStyle;
  code?: TextStyle;
}

interface TextStyle {
  size?: number;               // フォントサイズ (1-200)
  color?: string;              // 色（hex または rgb/rgba）
}
```

### SlideNumberConfig

スライド番号の設定です。

```typescript
interface SlideNumberConfig {
  show?: boolean;
  size?: number;
  color?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  paddingX?: number;
  paddingY?: number;
  format?: string;             // 例: "{{current}} / {{total}}"
}
```

### GenerateSlidesMessage

WebSocket で送信されるメッセージ型です。

```typescript
interface GenerateSlidesMessage {
  type: "generate-slides";
  slides: SlideContent[];
}
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
| `background` | `string` | 背景色（hex） |
| `gradient` | `string` | グラデーション（`color:pos%,...@angle` 形式） |
| `template` | `string` | Figma Paint Style 名 |
| `color` | `string` | 基本テキスト色（全要素に適用） |
| `headings` | `object` | 見出しスタイル（h1〜h4） |
| `paragraphs` | `object` | 段落スタイル |
| `bullets` | `object` | 箇条書きスタイル |
| `code` | `object` | コードブロックスタイル |
| `slideNumber` | `object \| boolean` | スライド番号設定 |

## WebSocket API

### エンドポイント

```
ws://localhost:4141
```

### メッセージ形式

#### CLI → Plugin: generate-slides

```json
{
  "type": "generate-slides",
  "slides": [
    {
      "type": "title",
      "title": "スライドタイトル",
      "background": { "solid": "#1a1a2e" },
      "styles": {
        "headings": { "h1": { "size": 72, "color": "#ffffff" } }
      }
    },
    {
      "type": "content",
      "title": "コンテンツタイトル",
      "blocks": [
        { "kind": "paragraph", "text": "本文", "spans": [{ "text": "本文" }] },
        { "kind": "bullets", "items": ["項目1", "項目2"], "ordered": false }
      ]
    }
  ]
}
```

#### Plugin → CLI: success

```json
{
  "type": "success",
  "count": 4
}
```

#### Plugin → CLI: error

```json
{
  "type": "error",
  "message": "Error message"
}
```

## 内部関数

### parseMarkdown

Markdown 文字列を SlideContent 配列に変換します。

```typescript
function parseMarkdown(markdown: string): SlideContent[]
```

**パース規則:**

- `---` (thematicBreak): スライド区切り
- `# H1`: タイトルスライド開始
- `## H2`: コンテンツスライド開始
- `### H3`, `#### H4`: サブ見出しブロック
- 段落: paragraph ブロック
- リスト: bullets ブロック（ordered/unordered）
- コードブロック: code ブロック（シンタックスハイライト対応）
- 引用: blockquote ブロック
- テーブル: table ブロック（GFM）
- 画像: image ブロック
- `:::figma`: figma リンクブロック
- YAML frontmatter: 背景・スタイル設定

### startServer

WebSocket サーバーを起動し、Plugin からの接続を待機します。

```typescript
function startServer(
  slides: SlideContent[],
  options: { host: string; port: number }
): Promise<{
  broadcast: (slides: SlideContent[]) => void;
  close: () => void;
}>
```

**戻り値:**

- `broadcast(slides)`: 接続中の全クライアントにスライドデータを送信
- `close()`: サーバーを停止

### generateSlides (Plugin)

受信したスライドデータから Figma Slides を生成します。

```typescript
async function generateSlides(slides: SlideContent[]): Promise<void>
```

**生成されるノード:**

- `figma.createSlide()` でスライドノード作成
- `figma.createText()` でテキストノード作成
- `figma.createFrame()` でコードブロック・テーブル・引用ブロック作成
- フォント: Inter (Regular/Bold/Italic/Bold Italic)

**シンタックスハイライト対応言語:**

TypeScript, JavaScript, Python, Bash, JSON, CSS, HTML, XML, Go, Rust, SQL
