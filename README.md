# art space tetra Archives

Movable TypeからNext.js静的ブログへの移行プロジェクト。

## 1. セットアップ
1. `npm install`

## 2. SQLコンバート
# 1. 初回だけローカルで変換
1. `cp /path/to/mt-dump.sql ./mt-dump.sql`
2. `npm run convert`        # ← src/data/*.json が生成される
3. `rm mt-dump.sql`         # ← 即削除！

## 3. 開発
1. `npm run dev`            # ローカル確認
2. `npm run build`          # ./outにビルド
3. `npm run deploy`         # GitHub Pages公開 (少し時間かかります)

## PDFエクスポート
記事ページのボタンでGoogleスライド風PDF生成。

# JSONだけをコミット ※必要であれば
1. `git add src/data/`
2. `git commit -m "Add 350 posts from MT"`
3. `git push`

# サイト
[https://borderhub.github.io/tetra-archives/archive/all/year/2025/page/1](https://borderhub.github.io/tetra-archives/archive/all/year/2025/page/1)