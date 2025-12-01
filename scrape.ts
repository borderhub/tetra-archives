import Crawler from "crawler";
import * as cheerio from "cheerio";
import fs from "fs-extra";
import { URL } from "url";

// ================== 型定義 ==================
interface ScrapedItem {
  title: string;
  imageUrl: string;
  pageUrl: string;
}

// ================== 設定 ==================
const SITE_URL = "http://www.as-tetra.info";
const TARGET_PATH = "/archives/";
const OUTPUT_JSON = "./scraped.json";

// 変数に型を適用
let thumbnailMapping: ScrapedItem[] = [];
let processedUrls = new Set<string>();
let visitedPages = 0;

// タイトルの正規化
function normalizeTitle(title: string | null | undefined): string {
  if (!title) return "";
  return title
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
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
  // 例: http://www.as-tetra.info/image.php/1414.jpg?width=168&height=800&image=http://www.as-tetra.info/upload/2025/IMG_2909-thumb.jpeg
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

      // 既に処理済みのURLはスキップ（★ 1. 動作安定のため visitedPages > 0 のチェックを削除 ★）
      // ただし、今回は年別アーカイブページしかクロールしないため、このチェックは主に重複防止に役立ちます
      /*
      if (processedUrls.has(url)) { 
        done();
        return;
      }
      */
      processedUrls.add(url);
      console.log(processedUrls)
      visitedPages++;
      console.log(`[${visitedPages}] Processing: ${url}`);

      try {
        const $ = cheerio.load(res.body);
        
        const articleBlocks = $(".main > .block_box:not(:first-child)");
        
        if (articleBlocks.length > 0) {
          console.log(`  🔍 Found ${articleBlocks.length} items on this page.`);

          articleBlocks.each((i, elem) => {
            const block = $(elem);
            
            // 1. タイトルと記事URLの抽出
            const titleLink = block.find('h1 a');
            const rawTitle = titleLink.text();
            const articleRelativeUrl = titleLink.attr('href');
            const normalizedTitle = normalizeTitle(rawTitle);

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
                  title: normalizedTitle,
                  imageUrl: cleanImageUrl,
                  pageUrl: absoluteArticleUrl
                });

                console.log(`  ✓ Title: ${normalizedTitle.substring(0, 40)}...`);
              }
            }
          });
        }
        
        // 年別アーカイブページからのリンクは、年別アーカイブページか個別記事ページのみ。
        // 個別記事に潜る必要がない（インデックスページで必要な情報を取得しきっている）ため、
        // 今回は再帰的なキューイングの処理は入れません。
        // もし年別ページが他の年別ページ（例：/archives/2023/）へのリンクを含んでいたとしても、
        // それらは generateArchiveUrls() ですでにキューイング/処理済みになっているため、重複クロールは発生しません。

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

    // 重複を削除 (Mapを使用してタイトルを一意にする)
    const uniqueMapping = Array.from(
      new Map(thumbnailMapping.map((item) => [item.title, item])).values()
    );

    await fs.writeJson(OUTPUT_JSON, uniqueMapping, { spaces: 2 });
    console.log(`結果を ${OUTPUT_JSON} に保存しました（${uniqueMapping.length}件）`);
  });
}

main().catch(console.error);
