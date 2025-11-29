# art space tetra Archives

Movable TypeからNext.js静的ブログへの移行プロジェクト。

## セットアップ
1. `npm install`
2. `npm run dev` でローカル確認
3. MTのJSONを `src/data/` に追加
4. `npm run deploy` でGitHub Pages公開

## PDFエクスポート
記事ページのボタンでGoogleスライド風PDF生成。

## SQLコンバート
# 1. 初回だけローカルで変換
1. `cp /path/to/mt-dump.sql ./mt-dump.sql`
2. `npm run convert`        # ← src/data/*.json が生成される
3. `rm mt-dump.sql`         # ← 即削除！

# 2. JSONだけをコミット
1. `git add src/data/`
2. `git commit -m "Add 350 posts from MT"`
3. `git push`
