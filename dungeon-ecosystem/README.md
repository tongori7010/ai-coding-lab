# dungeon-ecosystem

`dungeon-ecosystem` は、土を掘るだけで地下通路と生態系を作り、侵入してくる勇者を迎え撃つ小規模ブラウザゲームです。特定作品の固有名詞・画像・音楽・文章・マップ・数値設計は使わず、Canvas 図形だけで実装しています。

## 起動方法

```bash
cd dungeon-ecosystem
npm install
npm run dev
```

ブラウザで Vite が表示する URL を開いてください。

本番ビルド確認は以下です。

```bash
npm run build
```

## GitHub Pages での確認方法

このプロジェクトは、リポジトリ直下の `.github/workflows/deploy-dungeon-ecosystem.yml` で GitHub Pages にデプロイできます。

### 公開 URL

`main` ブランチへ push した後、または GitHub Actions の `Deploy dungeon-ecosystem to GitHub Pages` workflow を手動実行した後、以下の形式の URL で確認します。

```text
https://<GitHubユーザー名またはOrganization名>.github.io/ai-coding-lab/
```

このリポジトリが Project Pages として公開される前提のため、Vite の `base` は `/ai-coding-lab/` に設定しています。リポジトリ名を変更した場合は、`vite.config.ts` の `base` も新しいリポジトリ名に合わせて更新してください。

### GitHub 側で必要な Pages 設定

GitHub リポジトリの画面で以下を設定してください。

1. `Settings` → `Pages` を開く
2. `Build and deployment` の `Source` で `GitHub Actions` を選択する
3. `main` ブランチへ push する、または `Actions` タブから `Deploy dungeon-ecosystem to GitHub Pages` を `Run workflow` で実行する
4. workflow の完了後、`deploy` job の `github-pages` environment URL、または上記の公開 URL を開く

## 操作方法

- マウスクリック: 土ブロックを掘って通路にする
- `R` キー、または「最初から」ボタン: リセット
- `D` キー、または「デバッグ表示」ボタン: 栄養値、HP、空腹度の表示切り替え

## ゲームルール

- 20 x 12 の地下グリッドで進行します。
- プレイヤーは「破壊者」です。できることは土をクリックして掘ることだけです。
- 掘られたマスは通路になり、生物と勇者が移動できます。
- 土には栄養値があり、掘ったマスの周囲の土は栄養が少し増えます。
- 栄養の多い場所の近くでは微小生物が増えます。
- 小型魔物は微小生物を食べます。
- 大型魔物は小型魔物を食べ、勇者と戦う主戦力になります。
- 各生物には HP、攻撃力、空腹度があります。餌が見つからないまま空腹が進むと HP が減ります。
- 一定時間後、左上入口から勇者が 1 人侵入します。
- 勇者は掘られた通路だけを使い、右下の魔王の部屋までの最短経路を探します。
- 勇者が魔物と同じマスに入ると自動戦闘します。
- 勇者を倒すと勝利です。
- 勇者が魔王の部屋に到達し、魔王 HP が尽きると敗北です。
- 掘りすぎると勇者の経路が短くなり、魔物が育つ前に到達されやすくなります。

## この実装で決めた単純化ルール

- 生物の発生と進化は、個体数と確率に基づく軽量なルールです。
- 微小生物は周辺土の栄養値を参照して増殖し、増殖時に栄養を少し消費します。
- 小型魔物・大型魔物は最も近い餌へマンハッタン距離優先で向かい、経路がある場合は BFS で移動します。
- 勇者も BFS で魔王の部屋への最短経路を毎回再計算します。
- 勇者は経路が長いほど少し遅く進むため、迷路状に掘ることに意味があります。
- ランダム性はゲームの眺めやすさを優先し、完全なシード固定ではなくブラウザの `Math.random()` を使っています。

## ファイル構成

```text
dungeon-ecosystem/
├── index.html          # Vite エントリ HTML
├── package.json        # npm scripts と依存関係
├── vite.config.ts      # GitHub Pages 用の Vite base 設定
├── tsconfig.json       # TypeScript 設定
├── README.md           # この説明書
└── src/
    ├── main.ts         # ゲーム状態、描画、AI、戦闘、入力処理
    └── style.css       # 画面レイアウトと UI スタイル
```

GitHub Pages 用の workflow は、リポジトリ直下の `.github/workflows/deploy-dungeon-ecosystem.yml` にあります。
