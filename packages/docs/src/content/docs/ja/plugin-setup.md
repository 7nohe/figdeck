---
title: プラグイン設定
---

## プラグインのインストール

Figma Community から figdeck プラグインをインストールします：

**[figdeck - Figma Community](https://www.figma.com/community/plugin/1577342026252824260/figdeck)**

1. 上記のリンクをクリックして Figma Community のプラグインページを開く
2. 「Install」ボタンをクリック
3. プラグインがあなたの Figma アカウントに追加されます

## プラグインの使い方

:::caution
プラグインには **Figma Desktop アプリ** が必要です。ブラウザ版では CLI への WebSocket 接続ができません。
:::

### 1. サンプルスライドを作成

まず、`init` コマンドでサンプルの Markdown ファイルを生成します：

```bash
figdeck init
```

これにより、利用可能なすべての機能を示すサンプルコンテンツを含む `slides.md` ファイルが作成されます。

### 2. CLI を起動

Markdown ファイルを指定して figdeck CLI サーバーを起動します：

```bash
figdeck serve slides.md
```

CLI が WebSocket サーバーを起動し、プラグインの接続を待機します：

```
Parsed 4 slides from slides.md
WebSocket server started on ws://127.0.0.1:4141
Waiting for Figma plugin to connect...
```

### 3. Figma Slides を開く

1. Figma Desktop アプリを開く
2. 新しい Figma Slides ドキュメントを作成（または既存のものを開く）
3. メニュー → Plugins → figdeck を選択

### 4. CLI に接続

プラグインを起動すると、`localhost:4141` で実行中の CLI に自動的に接続を試みます。

プラグイン UI には接続状態が表示されます：

- **緑**: Connected - Waiting for slides...（接続済み - スライドを待機中...）
- **黄**: Connecting to WebSocket server... / Authenticating...（接続中... / 認証中...）
- **赤**: Disconnected - Reconnecting... / Authentication failed（切断 - 再接続中... / 認証失敗）

接続が完了すると、スライドが自動的に Figma に生成されます！

## リモート接続

ネットワーク上の別のマシンから接続する必要がある場合：

### 1. リモートアクセスを有効にして CLI を起動

```bash
figdeck serve slides.md --host 0.0.0.0 --allow-remote
```

CLI が認証シークレットを表示します：

```
Authentication secret: abc123xyz...
```

### 2. プラグインでシークレットを入力

1. Figma でプラグインを起動
2. CLI 出力に表示されたシークレットを「Secret」フィールドに入力
3. 「Connect」をクリック

## トラブルシューティング

### 接続できない

1. **CLI が起動しているか確認**: `figdeck serve` コマンドが実行中であることを確認
2. **ポート 4141 を確認**: ポート 4141 が他のプロセスで使用されていないか確認
3. **ファイアウォール設定を確認**: ファイアウォールがポート 4141 での接続を許可しているか確認
4. **localhost を試す**: ローカル接続の場合は `127.0.0.1`（デフォルト）を使用

### スライドが生成されない

1. **Figma Slides ドキュメントを確認**: 通常の Figma ファイルではなく、Figma Slides ドキュメントで実行しているか確認
2. **プラグインコンソールを確認**: エラーメッセージを確認するためプラグインコンソールを開く（Figma → Plugins → Development → Open Console）
3. **Markdown ファイルを確認**: Markdown ファイルが有効で、スライド区切り（`---`）が含まれているか確認

:::tip
プラグイン更新後は、プラグインウィンドウを閉じて再度開くことで最新版が適用されます。
:::

### 接続タイムアウト

- リモート接続の場合は、`--allow-remote` フラグを付けて CLI を起動したことを確認
- プラグイン UI に認証シークレットを正しく入力
- ローカルネットワーク接続の場合は、両方のマシンが同じネットワーク上にあることを確認
