---
title: VS Code 拡張機能
---

## 概要

figdeck VS Code 拡張機能は、シンタックスハイライト、スニペット、診断機能、CLI 統合により、Markdown 編集体験を向上させます。

**[VS Code Marketplace からインストール](https://marketplace.visualstudio.com/items?itemName=figdeck.figdeck-vscode)**

## インストール

1. VS Code を開く
2. 拡張機能へ移動 (Ctrl+Shift+X / Cmd+Shift+X)
3. "figdeck" を検索
4. インストールをクリック

または Quick Open (Ctrl+P / Cmd+P) を使用:

```
ext install figdeck.figdeck-vscode
```

## 機能

### スニペット

figdeck 固有の構文を素早く挿入できます。プレフィックスを入力して Tab を押してください:

| プレフィックス | 説明 |
|---------------|------|
| `figdeck-global` | グローバル frontmatter（background, color, align, valign） |
| `figdeck-slide` | スライド区切り付きの新しいスライド |
| `figdeck-transition` | トランジションアニメーション付きスライド |
| `:::columns2` | 2カラムレイアウト |
| `:::columns3` | 3カラムレイアウト |
| `:::columns4` | 4カラムレイアウト |
| `:::figma` | Figma リンクブロック |
| `figdeck-gradient` | グラデーション背景 |

### シンタックスハイライト

figdeck 固有の構文が強調表示されます:

- `:::columns` / `:::column` / `:::figma` ディレクティブ
- `key=value` 属性（link, gap, width, x, y, hideLink, text.* など）
- 画像サイズ・位置指定（`w:`, `h:`, `x:`, `y:`）

### スライドアウトライン

エクスプローラーサイドバーに全スライドのツリービューが表示されます:

- クリックでスライドにジャンプ
- スライド番号とタイトルを表示
- ドキュメント変更時に自動更新

コマンドでスライド間を移動:
- `figdeck: Go to Next Slide`
- `figdeck: Go to Previous Slide`

### 診断機能

figdeck Markdown のリアルタイム検証:

- 閉じられていない frontmatter ブロック
- サポートされていない画像形式
- 無効な画像サイズ・位置の値
- `:::figma` ブロックの `link=` の欠落
- 無効な Figma URL
- カラム数の検証
- gap/width パラメータの検証

### クイックフィックス

よくある問題を修正する CodeAction:

- figma ブロックに `link=` プロパティを追加
- gap を最大値に調整

### CLI 統合

VS Code から直接 figdeck コマンドを実行:

| コマンド | 説明 |
|---------|------|
| `figdeck: Init slides.md` | 新しいスライドファイルを作成 |
| `figdeck: Build JSON (current file)` | JSON にビルド |
| `figdeck: Start Serve` | WebSocket サーバーを起動 |
| `figdeck: Stop Serve` | WebSocket サーバーを停止 |
| `figdeck: Restart Serve` | WebSocket サーバーを再起動 |
| `figdeck: Show Output` | 出力チャンネルを表示 |

ステータスバーにサーバーの状態とポートが表示されます。

## 設定

VS Code の設定で拡張機能を設定できます:

| 設定 | デフォルト | 説明 |
|-----|----------|------|
| `figdeck.cli.command` | `null` | カスタム CLI コマンド（例: `["bunx", "figdeck"]`） |
| `figdeck.serve.host` | `"127.0.0.1"` | serve コマンドのホスト |
| `figdeck.serve.port` | `4141` | serve コマンドのポート |
| `figdeck.serve.allowRemote` | `false` | リモート接続を許可 |
| `figdeck.serve.secret` | `""` | 認証用シークレット |
| `figdeck.serve.noAuth` | `false` | 認証を無効化 |
| `figdeck.serve.noWatch` | `false` | ファイル監視を無効化 |
| `figdeck.diagnostics.enabled` | `true` | 診断機能を有効化 |
| `figdeck.diagnostics.debounceMs` | `300` | 診断のデバウンス時間 |
| `figdeck.images.maxSizeMb` | `5` | 最大画像ファイルサイズ（MB） |

## CLI の検出

拡張機能は以下の順序で figdeck CLI を検索します:

1. ワークスペースの `node_modules/.bin/figdeck`
2. PATH 上の `figdeck`
3. `figdeck.cli.command` 設定

見つからない場合は、インストールまたは設定を促すメッセージが表示されます。

## ワークフロー

1. **新しいスライドファイルを作成**: `figdeck: Init slides.md` コマンドを使用
2. **Markdown を編集**: スニペットとシンタックスハイライトを活用
3. **サーバーを起動**: `figdeck: Start Serve` コマンドを使用
4. **Figma プラグインに接続**: Figma Slides で figdeck プラグインを開く
5. **ライブプレビュー**: スライドが自動的に生成されます

拡張機能はファイルの変更を監視し、Figma プラグインをリアルタイムで更新します。
