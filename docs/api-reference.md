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
}
```

| プロパティ | 型 | 説明 |
|------------|------|------|
| `type` | `"title" \| "content"` | スライドタイプ |
| `title` | `string?` | スライドタイトル |
| `body` | `string[]?` | 本文テキスト配列 |
| `bullets` | `string[]?` | 箇条書き配列 |

### GenerateSlidesMessage

WebSocket で送信されるメッセージ型です。

```typescript
interface GenerateSlidesMessage {
  type: "generate-slides";
  slides: SlideContent[];
}
```

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
      "title": "スライドタイトル"
    },
    {
      "type": "content",
      "title": "コンテンツタイトル",
      "body": ["本文1", "本文2"],
      "bullets": ["項目1", "項目2"]
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
- `### H3+`: body に追加
- 段落: body に追加
- リスト: bullets に追加

### startServer

WebSocket サーバーを起動し、Plugin からの接続を待機します。

```typescript
function startServer(
  slides: SlideContent[],
  options: { host: string; port: number }
): Promise<void>
```

### generateSlides (Plugin)

受信したスライドデータから Figma Slides を生成します。

```typescript
async function generateSlides(slides: SlideContent[]): Promise<void>
```

**生成されるノード:**

- `figma.createSlide()` でスライドノード作成
- `figma.createText()` でテキストノード作成
- フォント: Inter (Bold/Regular)
