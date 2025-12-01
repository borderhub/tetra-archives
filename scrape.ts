import Crawler from "crawler";
import * as cheerio from "cheerio";
import fs from "fs-extra";
import { URL } from "url";

// ================== 型定義 ==================
interface ScrapedItem {
  title: string;
  imageUrl: string;
  pageUrl: string;
  // 比較用のキーを保持
  normalizedKey: string; 
}

// ================== 設定 ==================
const SITE_URL = "http://www.as-tetra.info";
const TARGET_PATH = "/archives/";
const OUTPUT_JSON = "./scraped.json";

// 変数に型を適用
let thumbnailMapping: ScrapedItem[] = [];
let processedUrls = new Set<string>();
let visitedPages = 0;

/**
 * タイトル文字列を比較のために整形する（先頭のキーワードブロックのみを抽出）
 * @param title 比較対象のタイトル文字列
 * @returns 比較用のキー文字列
 */
function getNormalizedKeyForComparison(title: string): string {
    if (!title) return "";
    
    // 1. 全角/半角の空白、タブ、改行をすべて除去
    let key = title.replace(/[\s\u3000]/g, ''); 
    
    // 2. 特殊記号や括弧、句読点などを除去
    key = key.replace(/[()（）【】\[\]「」『』,。．！？!?':;・、\-/～_#]/g, '');

    // 3. 文字をすべて小文字に変換
    key = key.toLowerCase();
    
    // 4. 最後に英数字と日本語の文字以外を全て除去し、純粋なキーワードにする
    key = key.replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '');

    return key;
}

/**
 * 生のタイトル文字列をクリーンアップし、比較用のキーも生成する
 * @param rawTitle 生のタイトル文字列
 * @returns クリーンアップされたタイトル文字列
 */
function cleanupAndGenerateKey(rawTitle: string | null | undefined): { cleanTitle: string; key: string } {
    if (!rawTitle) return { cleanTitle: "", key: "" };

    let cleanTitle = rawTitle
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\s+/g, " ")
        .trim();
        
    // --- パターン１対策: タイトル重複の検出と除去 ---
    // タイトルが自身の後半部分を繰り返している場合を検出（例: 'ABCABC' -> 'ABC'）
    const len = cleanTitle.length;
    if (len > 4 && len % 2 === 0) {
        const halfLen = len / 2;
        const firstHalf = cleanTitle.substring(0, halfLen);
        const secondHalf = cleanTitle.substring(halfLen);
        if (firstHalf === secondHalf) {
            cleanTitle = firstHalf.trim();
        }
    }
    
    // --- パターン２対策: 日本語/英数字結合の分離 ---
    // 日本語文字と英数字・記号の間に空白を入れる
    cleanTitle = cleanTitle.replace(/([a-zA-Z0-9])([一-龠ぁ-ゔァ-ヴ])/g, '$1 $2');
    cleanTitle = cleanTitle.replace(/([一-龠ぁ-ゔァ-ヴ])([a-zA-Z0-9])/g, '$1 $2');
    cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim(); // 再度空白を整形

    // 最終的な比較キーを生成
    const comparisonKey = getNormalizedKeyForComparison(cleanTitle);

    return { cleanTitle, key: comparisonKey };
}


/**
 * 2004年から現在の年までの年別アーカイブURLを生成し、キューに追加する
 * @param crawler Crawlerインスタンス
 */
function generateArchiveUrls(crawler: Crawler) {
  const currentYear = new Date().getFullYear(); 
  const startYear = 2004;

  console.log(`初期クロール対象年: ${startYear}年から${currentYear}年まで`);

  // 2025年から2004年まで逆順にキューイング
  for (let year = currentYear; year >= startYear; year--) {
    const archivePath = `${TARGET_PATH}${year}/`;
    const archiveUrl = `${SITE_URL}${archivePath}`;
    
    // 年別アーカイブのURLをキューに追加
    crawler.queue(archiveUrl);
    // 初期キューに追加したURLを処理済みとしてマーク
    processedUrls.add(archiveUrl); 
    console.log(`  + Queued: ${archiveUrl}`);
  }
}

// 画像URLから必要な部分のみを抽出するヘルパー関数
function extractCleanImageUrl(fullUrl: string): string | null {
  // URLパラメータ 'image=' の後にある、アップロードディレクトリのURLを抽出
  const match = fullUrl.match(/&image=(http:\/\/.*?\/upload\/.*?\/.*?\.(?:jpe?g|png|gif))/i);
  
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

async function main() {
  console.log("スクレイピング開始...");

  const c = new Crawler({
    maxConnections: 5,
    rateLimit: 1000,
    callback: async (error: any, res: any, done: any) => {
      const url = res.options?.url ; 
      if (error) {
        // 404などエラーをログに出力しつつ続行
        console.error(`Error processing ${url}: ${error.message}`);
        done();
        return;
      }

      if (!url || !url.includes("/archives/")) {
        done();
        return;
      }

      processedUrls.add(url);
      visitedPages++;
      console.log(`[${visitedPages}] Processing: ${url}`);

      try {
        const $ = cheerio.load(res.body);
        
        // 1つ目の記事ブロックはしばしば特殊なコンテンツ（年別アーカイブの概要など）なので除外
        const articleBlocks = $(".main > .block_box:not(:first-child)");
        
        if (articleBlocks.length > 0) {
          console.log(`  🔍 Found ${articleBlocks.length} items on this page.`);

          articleBlocks.each((i, elem) => {
            const block = $(elem);
            
            // 1. タイトルと記事URLの抽出
            const titleLink = block.find('h1 a');
            const rawTitle = titleLink.text();
            const articleRelativeUrl = titleLink.attr('href');
            
            // --- 修正されたタイトル処理 ---
            const { cleanTitle: normalizedTitle, key: comparisonKey } = cleanupAndGenerateKey(rawTitle);

            // 2. 画像URLの抽出
            const imageElement = block.find('a img');
            const imageSrc = imageElement.attr('src');
            
            if (normalizedTitle && articleRelativeUrl && imageSrc) {
              
              // ----------------------------------------------------
              // ★ 3. imageUrl の整形ロジックを適用 ★
              // ----------------------------------------------------
              const cleanImageUrl = extractCleanImageUrl(imageSrc);

              // 記事の個別URLを取得
              const absoluteArticleUrl = new URL(articleRelativeUrl, url).href;

              if (cleanImageUrl) {
                thumbnailMapping.push({
                  title: normalizedTitle, // 元のタイトルに近い、クリーンアップ済みのタイトルを保持
                  imageUrl: cleanImageUrl,
                  pageUrl: absoluteArticleUrl,
                  normalizedKey: comparisonKey // 重複除去とconvert.tsとの比較に使うキーを保持
                });

                console.log(`  ✓ Title: ${normalizedTitle.substring(0, 40)}... (Key: ${comparisonKey.substring(0, 20)}...)`);
              }
            }
          });
        }
        
      } catch (parseError: any) {
        console.error(`Parse error for ${url}:`, parseError.message);
      }

      done();
    }
  });

  // 初期URLを年別アーカイブで生成
  generateArchiveUrls(c);

  // クロール完了を待つ
  c.on("drain", async () => {
    console.log("\n========================================");
    console.log("スクレイピング完了！");
    console.log(`訪問ページ数: ${visitedPages}`);
    console.log(`取得サムネイル数: ${thumbnailMapping.length}`);
    console.log("========================================\n");

    // 【修正点】重複を削除: normalizedKey (比較キー) が同じアイテムを重複と見なす
    const uniqueMapping = Array.from(
      new Map(thumbnailMapping.map((item) => [item.normalizedKey, item])).values()
    ).map(item => ({
        // 最終的な出力JSONから normalizedKey は除外
        title: item.title,
        imageUrl: item.imageUrl,
        pageUrl: item.pageUrl
    }));
    
    await fs.writeJson(OUTPUT_JSON, uniqueMapping, { spaces: 2 });
    console.log(`結果を ${OUTPUT_JSON} に保存しました（${uniqueMapping.length}件）`);
  });
}

main().catch(console.error);
