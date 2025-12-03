import Crawler from 'crawler';
import * as cheerio from 'cheerio';
import fs from 'fs-extra';
import { URL } from 'url';

// ================== 型定義 ==================
interface ScrapedItem {
  title: string;
  imageUrl: string;
  pageUrl: string;
  normalizedKey: string;
}

// ================== 設定 ==================
const SITE_URL = 'http://www.as-tetra.info';
const TARGET_PATH = '/archives/';
const OUTPUT_JSON = './scraped.json';

// 変数に型を適用
const thumbnailMapping: ScrapedItem[] = [];
const processedUrls = new Set<string>();
let visitedPages = 0;

/**
 * タイトル文字列を比較のために整形する（比較用のキーのみ生成）
 * @param title 比較対象のタイトル文字列
 * @returns 正規化・小文字化したキー文字列（比較用）
 */
function getNormalizedKey(title: string): string {
  if (!title) return '';

  let key = title.trim();

  // 0. HTMLタグを完全に除去
  key = key.replace(/<[^>]*>/g, '');

  // 1. 日本語と英数字が結合している箇所に空白を挿入
  key = key.replace(/([a-zA-Z0-9])([一-龠ぁ-んァ-ヴ])/g, '$1 $2');
  key = key.replace(/([一-龠ぁ-んァ-ヴ])([a-zA-Z0-9])/g, '$1 $2');
  key = key.replace(/\s+/g, ' ').trim();

  // 2. 一般的な区切り文字で分割
  const segments = key.split(/[\s\u3000#\-—(（\[「『:\uff1a・\r\n"]+/);

  // 空でない有意義なセグメントを最大5個まで取得
  const meaningfulSegments = segments
    .filter((seg) => seg.trim().length > 0)
    .slice(0, 5);

  key = meaningfulSegments.join(' ');

  // 3. 全角/半角の空白をスペース1つに統一
  key = key.replace(/[\s\u3000]+/g, ' ');

  // 4. 特殊記号や括弧、句読点などを除去
  key = key.replace(/[()（）【】'\[\]「」『』,。．！？!?':;、\/～_"]/g, '');

  // 5. 文字をすべて小文字に変換
  key = key.toLowerCase();

  // 6. 連続する重複部分文字列を除去（DOUKADOUKA → DOUKA）
  // 空白で分割して各単語を処理
  const words = key.split(/\s+/);
  const deduplicatedWords = words.map((word) => {
    if (word.length >= 4) {
      // 単語の長さが4文字以上の場合のみチェック
      for (let len = Math.floor(word.length / 2); len >= 2; len--) {
        const pattern = word.substring(0, len);
        // パターンが連続して繰り返されているかチェック
        let repeated = pattern;
        while (repeated.length < word.length) {
          repeated += pattern;
        }
        if (word === repeated.substring(0, word.length)) {
          // 完全に繰り返しパターンの場合、最初のパターンのみ保持
          return pattern;
        }
      }
    }
    return word;
  });
  key = deduplicatedWords.join(' ');

  // 7. 連続するハイフンやドットを1つに
  key = key.replace(/[-]+/g, '-').replace(/\.+/g, '.');

  // 8. 先頭・末尾の記号を除去
  key = key.replace(/^[-.\s]+|[-.\s]+$/g, '');

  // 9. 最終的なクリーンアップ
  key = key.replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s]/g, '');

  // 10. 連続する空白を1つに
  key = key.replace(/\s+/g, ' ').trim();

  return key;
}

/**
 * 2004年から現在の年までの年別アーカイブURLを生成し、キューに追加する
 * @param crawler Crawlerインスタンス
 */
function generateArchiveUrls(crawler: Crawler) {
  const currentYear = new Date().getFullYear();
  const startYear = 2004;

  console.log(`初期クロール対象年: ${startYear}年から${currentYear}年まで`);

  for (let year = currentYear; year >= startYear; year--) {
    const archivePath = `${TARGET_PATH}${year}/`;
    const archiveUrl = `${SITE_URL}${archivePath}`;

    crawler.queue(archiveUrl);
    processedUrls.add(archiveUrl);
    console.log(`  + Queued: ${archiveUrl}`);
  }
}

// 画像URLから必要な部分のみを抽出するヘルパー関数
function extractCleanImageUrl(fullUrl: string): string | null {
  const match = fullUrl.match(
    /&image=(http:\/\/.*?\/upload\/.*?\/.*?\.(?:jpe?g|png|gif))/i
  );

  if (match && match[1]) {
    return match[1];
  }
  return null;
}

async function main() {
  console.log('スクレイピング開始...');

  const c = new Crawler({
    maxConnections: 5,
    rateLimit: 1000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: async (error: any, res: any, done: any) => {
      const url = res.options?.url;
      if (error) {
        console.error(`Error processing ${url}: ${error.message}`);
        done();
        return;
      }

      if (!url || !url.includes('/archives/')) {
        done();
        return;
      }

      processedUrls.add(url);
      visitedPages++;
      console.log(`[${visitedPages}] Processing: ${url}`);

      try {
        const $ = cheerio.load(res.body);

        const articleBlocks = $('.main > .block_box:not(:first-child)');

        if (articleBlocks.length > 0) {
          console.log(`  🔍 Found ${articleBlocks.length} items on this page.`);

          articleBlocks.each((i, elem) => {
            const block = $(elem);

            // 1. タイトルと記事URLの抽出（span.jp内のh1 aを優先）
            let originalTitle = '';
            let articleRelativeUrl = '';

            // パターン1: span.jp内のh1 aを直接取得（アーカイブページ用）
            const jpTitleLink = block.find('span.jp h1 a');
            if (jpTitleLink.length > 0) {
              originalTitle = jpTitleLink.text().trim();
              articleRelativeUrl = jpTitleLink.attr('href') || '';
            }

            // パターン2: h1 a内のspan.jpを取得（個別ページ用のフォールバック）
            if (!originalTitle) {
              const titleLink = block.find('h1 a');
              const jpH1 = titleLink.find('span.jp h1');
              if (jpH1.length > 0) {
                originalTitle = jpH1.text().trim();
                articleRelativeUrl = titleLink.attr('href') || '';
              } else {
                // span.jp全体を取得してenを除外
                const jpSpan = titleLink.find('span.jp');
                if (jpSpan.length > 0) {
                  const jpClone = jpSpan.clone();
                  jpClone.find('span.en, .en').remove();
                  originalTitle = jpClone.text().trim();
                  articleRelativeUrl = titleLink.attr('href') || '';
                }
              }
            }

            // パターン3: フォールバック - h1 aから全体を取得して英語部分を除外
            if (!originalTitle) {
              const titleLink = block.find('h1 a');
              const enText = titleLink.find('span.en, .en').text().trim();
              const fullText = titleLink.text().trim();
              if (enText && fullText.includes(enText)) {
                originalTitle = fullText.replace(enText, '').trim();
              } else {
                originalTitle = fullText;
              }
              articleRelativeUrl = titleLink.attr('href') || '';
            }

            // 2. 画像URLの抽出
            const imageElement = block.find('a img');
            const imageSrc = imageElement.attr('src');

            if (originalTitle && articleRelativeUrl && imageSrc) {
              const cleanImageUrl = extractCleanImageUrl(imageSrc);
              const absoluteArticleUrl = new URL(articleRelativeUrl, url).href;

              // 比較用のキーを生成（保存はしない、比較のみに使用）
              const comparisonKey = getNormalizedKey(originalTitle);

              if (cleanImageUrl) {
                thumbnailMapping.push({
                  title: originalTitle, // 元のタイトルをそのまま保存
                  imageUrl: cleanImageUrl,
                  pageUrl: absoluteArticleUrl,
                  normalizedKey: comparisonKey, // 比較用キー
                });

                console.log(`  ✓ Title: ${originalTitle.substring(0, 50)}...`);
                console.log(`    Key: ${comparisonKey.substring(0, 30)}...`);
              }
            }
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (parseError: any) {
        console.error(`Parse error for ${url}:`, parseError.message);
      }

      done();
    },
  });

  // 初期URLを年別アーカイブで生成
  generateArchiveUrls(c);

  // クロール完了を待つ
  c.on('drain', async () => {
    console.log('\n========================================');
    console.log('スクレイピング完了！');
    console.log(`訪問ページ数: ${visitedPages}`);
    console.log(`取得サムネイル数: ${thumbnailMapping.length}`);
    console.log('========================================\n');

    // 重複を削除（normalizedKeyで判定）
    const uniqueMapping = Array.from(
      new Map(
        thumbnailMapping.map((item) => [item.normalizedKey, item])
      ).values()
    ).map((item) => ({
      // 出力JSONにはnormalizedKeyを含めない
      title: item.title, // 元のタイトルをそのまま出力
      imageUrl: item.imageUrl,
      pageUrl: item.pageUrl,
    }));

    await fs.writeJson(OUTPUT_JSON, uniqueMapping, { spaces: 2 });
    console.log(
      `結果を ${OUTPUT_JSON} に保存しました（${uniqueMapping.length}件）`
    );
  });
}

main().catch(console.error);
