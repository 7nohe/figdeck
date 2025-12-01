# Markdown 仕様

figdeck が対応する Markdown 記法の仕様です。

## スライド区切り

`---`（thematicBreak、水平線）でスライドを区切ります。

```markdown
# スライド1

内容

---

# スライド2

内容
```

## 見出し

### H1 (`#`) - タイトルスライド

`#` で始まる見出しはタイトルスライド（`type: "title"`）として扱われます。
フォントサイズは 64px で大きく表示されます。

```markdown
# プレゼンテーションタイトル
```

### H2 (`##`) - コンテンツスライド

`##` で始まる見出しはコンテンツスライド（`type: "content"`）として扱われます。
フォントサイズは 48px です。

```markdown
## アジェンダ
```

### H3 以下 (`###`, `####`, ...)

H3 以下の見出しは本文（`body`）として扱われます。

## 本文

段落テキストは本文（`body` 配列）に追加されます。
複数の段落は改行で区切られて表示されます。

```markdown
## スライドタイトル

これは本文です。

これも本文に追加されます。
```

## 箇条書き

リスト（`-`, `*`, `+` または数字）は箇条書き（`bullets` 配列）として扱われます。

### 順序なしリスト

表示時に `•` が先頭に付きます。

```markdown
## 特徴

- 高速
- シンプル
- 拡張性
```

### 順序付きリスト

数字で始まるリストは番号付きリストとして表示されます。
`start` 属性で開始番号を指定できます。

```markdown
1. 最初のステップ
2. 次のステップ
3. 最後のステップ
```

## インラインフォーマット

テキスト内で以下の書式を使用できます：

- **太字**: `**テキスト**` または `__テキスト__`
- *イタリック*: `*テキスト*` または `_テキスト_`
- ~~取り消し線~~: `~~テキスト~~` (GFM)
- `インラインコード`: `` `コード` ``
- [リンク](https://example.com): `[テキスト](URL)`

これらは組み合わせることも可能です：

```markdown
これは **太字** と *イタリック* と ~~取り消し線~~ のテスト。

`const x = 1` はインラインコードです。

[Figmaへ](https://figma.com) のリンク。
```

## 引用 (Blockquote)

`>` で始まる行は引用ブロックとして表示されます。
左側にグレーのボーダーが付き、やや淡い色で表示されます。

```markdown
> これは引用文です。
> 複数行にまたがることもできます。
```

## 画像

`![alt](url)` 形式で画像を挿入できます。

### リモート画像

```markdown
![サンプル画像](https://example.com/image.png)
```

リモート URL（`http://` または `https://` で始まる）はプラグイン側でフェッチし、`createImage` に渡して表示します（PNG/JPEG/GIF のみ）。

### ローカル画像

```markdown
![ローカル画像](./images/photo.jpg)
![絶対パス](../assets/logo.png)
```

ローカルファイルパス（URL スキームなし）は CLI が自動的に検出し、ファイルを読み込んで base64 エンコードしてプラグインに送信します。
パスは Markdown ファイルからの相対パスとして解決されます。

**対応フォーマット**: `.jpg`, `.jpeg`, `.png`, `.gif`（WebP/SVG は Figma Slides 非対応のためスキップ）

**サイズ制限**: デフォルトで 5MB まで。これを超えるファイルはスキップされ、警告が表示されます。

### フォールバック

画像の読み込みに失敗した場合（ファイルが見つからない、ネットワークエラーなど）は、プレースホルダーとして表示されます。
alt テキストまたは URL がラベルとして表示されます。

## Figma Selection Link

`:::figma` ブロックを使用すると、Figma ノードへのリンクカードをスライドに埋め込めます。
同一ファイル内のノードの場合、クリックするとそのノードに直接ジャンプします。

### 基本構文

```markdown
:::figma
link=https://www.figma.com/file/xxx/name?node-id=1234-5678
:::
```

### プロパティ

| プロパティ | 必須 | 説明 |
|-----------|------|------|
| `link` | ✅ | Figma の URL（node-id パラメータ付き） |
| `x` | - | カードの X 座標（省略時は自動配置） |
| `y` | - | カードの Y 座標（省略時は自動配置） |

### 位置指定の例

```markdown
:::figma
link=https://www.figma.com/file/xxx?node-id=1234-5678
x=160
y=300
:::
```

### 動作

- **同一ファイル**: `node-id` が現在のファイル内に存在する場合、クリックでそのノードに直接ジャンプします（`type: "NODE"` ハイパーリンク）
- **他ファイル**: 異なるファイルの場合は URL リンクとして開きます（`type: "URL"` ハイパーリンク）
- **ノード未検出**: 指定された `node-id` が見つからない場合は警告を表示し、URL フォールバックを使用します

### サポートされる URL 形式

- `https://www.figma.com/file/<fileKey>/<name>?node-id=<nodeId>`
- `https://www.figma.com/design/<fileKey>/<name>?node-id=<nodeId>`
- `https://figma.com/file/<fileKey>?node-id=<nodeId>`

`node-id` パラメータは `1234-5678` または `1234:5678`、URL エンコード形式 `1%3A2` いずれも対応しています。

## テーブル (GFM)

GitHub Flavored Markdown のテーブル記法をサポートしています。

```markdown
| 機能 | 説明 |
|------|------|
| パース | Markdown を解析 |
| 変換 | Figma Slides に変換 |
```

アラインメントも指定可能です：

```markdown
| 左寄せ | 中央 | 右寄せ |
|:-------|:----:|-------:|
| テキスト | テキスト | 数値 |
```

## 脚注 (Footnotes)

GFM の脚注記法をサポートしています。
脚注はスライドの下部に小さいフォントで表示されます。

### 基本構文

```markdown
## 研究結果

最新の研究によると[^1]、これは重要な発見です[^2]。

[^1]: Smith et al. (2024) Journal of Science
[^2]: 詳細は付録Aを参照
```

### 名前付き脚注

数字の代わりに名前を使用することもできます：

```markdown
この機能は便利です[^note]。

[^note]: ユーザビリティ調査により検証済み
```

### 表示形式

- 本文中の脚注参照は `[1]` や `[note]` のように角括弧で表示されます（Figma Slides は上付き文字をサポートしていないため）
- 脚注定義はスライド下部に水平線で区切られて表示されます
- 脚注内でも **太字** や *イタリック* などのインラインフォーマットが使用できます

## スライドトランジション

スライド間のトランジションアニメーションを設定できます。

### 基本設定（ショートハンド）

```yaml
---
transition: dissolve
---
```

duration を指定することもできます：

```yaml
---
transition: slide-from-right 0.5
---
```

### 詳細設定

```yaml
---
transition:
  style: slide-from-right   # アニメーションスタイル
  duration: 0.5             # 再生時間（秒）0.01〜10
  curve: ease-out           # イージングカーブ
  timing:
    type: after-delay       # on-click または after-delay
    delay: 2                # 自動再生までの待機時間（秒）0〜30
---
```

### グローバル設定

ファイル先頭の frontmatter でグローバルトランジションを設定できます：

```yaml
---
transition:
  style: dissolve
  duration: 0.5
  curve: ease-out
---

# タイトルスライド

---

## コンテンツスライド
```

この場合、すべてのスライドに dissolve トランジションが適用されます。

### スライド個別の上書き

グローバル設定を個別のスライドで上書きできます：

```yaml
---
transition: dissolve
---

# タイトル

---
transition: slide-from-right
---
## このスライドだけ右からスライドイン
```

`transition: none` でトランジションを無効化できます。

### 利用可能なスタイル

| カテゴリ | スタイル |
|---------|---------|
| 基本 | `none`, `dissolve`, `smart-animate` |
| スライドイン | `slide-from-left`, `slide-from-right`, `slide-from-top`, `slide-from-bottom` |
| プッシュ | `push-from-left`, `push-from-right`, `push-from-top`, `push-from-bottom` |
| ムーブイン | `move-from-left`, `move-from-right`, `move-from-top`, `move-from-bottom` |
| スライドアウト | `slide-out-to-left`, `slide-out-to-right`, `slide-out-to-top`, `slide-out-to-bottom` |
| ムーブアウト | `move-out-to-left`, `move-out-to-right`, `move-out-to-top`, `move-out-to-bottom` |

### 利用可能なイージングカーブ

| カーブ | 説明 |
|--------|------|
| `ease-in` | ゆっくり始まり加速 |
| `ease-out` | 減速して終わる |
| `ease-in-and-out` | ゆっくり始まりゆっくり終わる |
| `linear` | 一定速度 |
| `gentle` | なめらか |
| `quick` | 素早く |
| `bouncy` | 弾む |
| `slow` | ゆっくり |

### タイミング

| タイプ | 説明 |
|--------|------|
| `on-click` | クリックで次のスライドへ（デフォルト） |
| `after-delay` | 指定秒数後に自動で次のスライドへ |

**注意**: `after-delay` はプレゼンテーションモードでのみ動作します。

## コードブロック

` ``` ` で囲まれたブロックはコードブロックとして表示されます。
言語を指定するとシンタックスハイライトが適用されます。

```markdown
` ```typescript
const message: string = "Hello, World!";
console.log(message);
` ```
```

対応言語: TypeScript, JavaScript, Python, Bash, JSON, CSS, HTML, XML, Go, Rust, SQL

## SlideContent 型

パースされた結果は以下の型に変換されます：

```typescript
interface SlideContent {
  type: "title" | "content";
  title?: string;      // 見出しテキスト
  body?: string[];     // 本文テキスト配列
  bullets?: string[];  // 箇条書き配列
  align?: HorizontalAlign;   // 水平方向配置: "left" | "center" | "right"
  valign?: VerticalAlign;    // 垂直方向配置: "top" | "middle" | "bottom"
}
```

## 完全な例

```markdown
---
# figdeck プレゼンテーション

Markdown から Figma Slides へ

---
## 目次

- 概要
- 機能紹介
- デモ
- まとめ

---
## 概要

figdeck は Markdown ファイルを
Figma Slides に変換するツールです。

CLI と Figma Plugin が連携して動作します。

---
## 機能

- Markdown パース
- WebSocket 通信
- 自動スライド生成

---
# ありがとうございました

質問はありますか？
```

この例は以下の 5 つのスライドを生成します：

1. タイトルスライド「figdeck プレゼンテーション」
2. コンテンツスライド「目次」（箇条書き4項目）
3. コンテンツスライド「概要」（本文2段落）
4. コンテンツスライド「機能」（箇条書き3項目）
5. タイトルスライド「ありがとうございました」

## 対応状況

| 記法 | 対応状況 | 備考 |
|------|----------|------|
| 見出し (H1-H4) | ✅ | H1/H2はスライドタイトル |
| 段落 | ✅ | |
| 箇条書き | ✅ | 順序付き/なし両対応 |
| **太字** | ✅ | |
| *イタリック* | ✅ | |
| ~~取り消し線~~ | ✅ | GFM |
| `インラインコード` | ✅ | 背景色付き |
| リンク | ✅ | クリック可能 |
| 引用 | ✅ | 左ボーダー付き |
| コードブロック | ✅ | シンタックスハイライト |
| テーブル | ✅ | GFM、アラインメント対応 |
| 画像 | ✅ | ローカル・リモート対応 |
| Figma リンク | ✅ | `:::figma` ブロック |
| align/valign | ✅ | スライド配置設定 |
| 脚注 | ✅ | GFM、スライド下部に表示 |
| トランジション | ✅ | スライド切り替えアニメーション |
