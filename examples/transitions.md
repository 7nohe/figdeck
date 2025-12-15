---
figdeck: true
transition:
  style: dissolve
  duration: 0.5
  curve: ease-out
---

# トランジションサンプル

全スライドにディゾルブを適用

---

## デフォルトトランジション

グローバル設定（dissolve）が適用される

- スライド間の切り替え時に適用
- プレゼンテーションモードで効果を確認

---
transition: slide-from-right
---

## カスタムトランジション

このスライドは右からスライドイン

- `slide-from-right` スタイルを使用
- duration はグローバル設定の 0.5 秒を継承

---
transition:
  style: push-from-bottom
  duration: 0.8
  curve: bouncy
---

## バウンシーな効果

弾むようなイージングで下からプッシュ

- `bouncy` カーブで弾むアニメーション
- duration を 0.8 秒に設定

---
transition:
  style: dissolve
  timing:
    type: after-delay
    delay: 3
---

## 自動再生

3秒後に自動的に次のスライドへ

- `after-delay` タイミングを使用
- プレゼンテーションモードでのみ動作

---
transition: none
---

## トランジションなし

このスライドはアニメーションなしで表示

- `none` でトランジションを無効化
- 即座に次のスライドに切り替わる

---
transition: smart-animate 0.6
---

## スマートアニメート

共通の要素が自動的にアニメーション

- 同じ名前のレイヤーが自動でアニメーション
- デザインの連続性を保つ

---

## 利用可能なスタイル

| カテゴリ | スタイル |
|---------|---------|
| 基本 | `none`, `dissolve`, `smart-animate` |
| スライドイン | `slide-from-left`, `slide-from-right`, `slide-from-top`, `slide-from-bottom` |
| プッシュ | `push-from-left`, `push-from-right`, `push-from-top`, `push-from-bottom` |
| ムーブイン | `move-from-left`, `move-from-right`, `move-from-top`, `move-from-bottom` |

---

## イージングカーブ

- `ease-in` - ゆっくり始まり加速
- `ease-out` - 減速して終わる
- `ease-in-and-out` - ゆっくり始まりゆっくり終わる
- `linear` - 一定速度
- `gentle` - なめらか
- `quick` - 素早く
- `bouncy` - 弾む
- `slow` - ゆっくり
