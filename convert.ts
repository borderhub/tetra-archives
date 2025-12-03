import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// ================== 設定 ==================
const INPUT_SQL_FILE = './mt-dump.sql';
const OUTPUT_DIR = './src/data';
const PUBLIC_UPLOAD_DIR = './public/upload';
const PUBLIC_UPLOAD_THUMBNAIL_DIR = './public/thumbnail';
const PUBLIC_UPLOAD_TITLE_DIR = './public/title';
const CRAWLER_RESULTS_FILE = './scraped.json';

// --- 型定義 ---

type CategoryMap = Map<
    number,
    { basename: string; label: string; parentId: number }
>;
type CategoryInfo = {
    id: number;
    label: string;
    basename: string;
    parentId: number;
    path: string[];
};

interface CrawlerItem {
    title: string;
    imageUrl: string;
    pageUrl: string;
}

// --- ヘルパー関数(タイトル比較用) ---

/**
 * タイトル文字列を比較のために整形する（比較用のキーのみ生成）
 *
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
 * 複数の方法でタイトルの類似性をチェック
 */
function findBestCrawlerMatch(
    mtTitle: string,
    crawlerItems: CrawlerItem[]
): CrawlerItem | undefined {
    if (!mtTitle) return undefined;

    const mtKey = getNormalizedKey(mtTitle);

    // 方法1: 完全一致
    for (const item of crawlerItems) {
        const crawlerKey = getNormalizedKey(item.title);
        if (mtKey === crawlerKey) {
            return item;
        }
    }

    // 方法2: 部分一致（より長いキーを優先）
    const candidates = crawlerItems
        .map((item) => ({
            item,
            key: getNormalizedKey(item.title),
        }))
        .filter(({ key }) => {
            return (mtKey.includes(key) || key.includes(mtKey)) && key.length > 10;
        })
        .sort((a, b) => b.key.length - a.key.length);

    if (candidates.length > 0) {
        const best = candidates[0];
        const commonLength = Math.min(mtKey.length, best.key.length);
        if (commonLength > 15) {
            return best.item;
        }
    }

    return undefined;
}

// --- タイトル内画像処理 ---

/**
 * タイトル文字列からimgタグのみを検出し、画像情報を抽出
 * 他のHTMLタグや文字列はそのまま保持
 */
function extractImageFromTitle(title: string): {
    cleanTitle: string;
    imageUrl: string | null;
} {
    if (!title) return { cleanTitle: '', imageUrl: null };

    const imgMatch = title.match(/<img\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/i);

    if (imgMatch) {
        const imageUrl = imgMatch[1];
        // imgタグのみを除去、他のHTMLタグや文字列はそのまま保持
        const cleanTitle = title.replace(/<img[^>]*>/gi, '').trim();
        return { cleanTitle, imageUrl };
    }

    // imgタグがない場合は元のタイトルをそのまま返す
    return { cleanTitle: title, imageUrl: null };
}

// --- ヘルパー関数(通信・画像処理) ---

function extractUrl(text: string): string | null {
    if (!text || text === 'NULL' || text.trim() === '') return null;

    let cleanedText = text.trim();
    if (
        (cleanedText.startsWith("'") && cleanedText.endsWith("'")) ||
        (cleanedText.startsWith('"') && cleanedText.endsWith('"'))
    ) {
        cleanedText = cleanedText.slice(1, -1);
    }

    const urlMatch = cleanedText.match(/https?:\/\/[^\s'"]+/i);
    return urlMatch ? urlMatch[0] : null;
}

function extractImageFromHtml(html: string): string | null {
    const mainImageMatch =
        html.match(
            /<img\s+[^>]*class=["']main_image["'][^>]*src\s*=\s*["']([^"']+)["'][^>]*>/i
        ) ||
        html.match(
            /<img\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*class=["']main_image["'][^>]*>/i
        );
    if (mainImageMatch) {
        return mainImageMatch[1].trim();
    }

    const blockBoxMatch = html.match(
        /<div\s+class=["']block_box["'][^>]*>([\s\S]*?)<\/div>/i
    );
    if (blockBoxMatch) {
        const blockBoxContent = blockBoxMatch[1];
        const imgMatch = blockBoxContent.match(
            /<img\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/i
        );
        if (imgMatch) {
            return imgMatch[1].trim();
        }
    }

    const block1Match = html.match(
        /<div\s+class=["']block1["'][^>]*>([\s\S]*?)<\/div>/i
    );
    if (block1Match) {
        const block1Content = block1Match[1];
        const imgMatch = block1Content.match(
            /<img\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/i
        );
        if (imgMatch) {
            return imgMatch[1].trim();
        }
    }

    const generalImgMatch = html.match(
        /<img\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/i
    );
    return generalImgMatch ? generalImgMatch[1].trim() : null;
}

function fetchHtml(urlStr: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const protocol = urlStr.startsWith('https') ? https : http;

        const req = protocol.get(urlStr, (res) => {
            if (
                res.statusCode &&
                res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location
            ) {
                fetchHtml(res.headers.location).then(resolve).catch(reject);
                return;
            }

            if (res.statusCode !== 200) {
                res.resume();
                reject(
                    new Error(
                        `Request Failed. Status Code: ${res.statusCode} URL: ${urlStr}`
                    )
                );
                return;
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data);
            });
        });

        req.on('error', (e) => {
            reject(e);
        });
        req.end();
    });
}

function downloadImage(url: string, savePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(savePath);

        const request = protocol.get(url, (response) => {
            if (
                response.statusCode &&
                response.statusCode >= 300 &&
                response.statusCode < 400 &&
                response.headers.location
            ) {
                fs.unlink(savePath, () => { });
                downloadImage(response.headers.location, savePath)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                fs.unlink(savePath, () => { });
                reject(new Error(`Status Code: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
        });

        file.on('finish', () => {
            file.close();
            resolve();
        });

        request.on('error', (err) => {
            fs.unlink(savePath, () => { });
            reject(err);
        });

        file.on('error', (err) => {
            fs.unlink(savePath, () => { });
            reject(err);
        });
    });
}

async function processImages(content: string, slug: string): Promise<string> {
    const imgRegex = /<img\s+[^>]*src\s*=\s*["'](http[^"']+)["'][^>]*>/gi;
    const matches = [...content.matchAll(imgRegex)];
    if (matches.length === 0) return content;

    const targetDir = path.join(PUBLIC_UPLOAD_DIR, slug);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    let newContent = content;
    const downloadPromises: Promise<void>[] = [];
    const processedUrls = new Set<string>();

    for (const match of matches) {
        const imgUrl = match[1];
        if (processedUrls.has(imgUrl)) continue;
        processedUrls.add(imgUrl);

        try {
            const urlObj = new URL(imgUrl);
            let fileName = decodeURIComponent(path.basename(urlObj.pathname));
            if (!fileName || !fileName.includes('.')) {
                fileName = `image-${Date.now()}.jpg`;
            }

            const savePath = path.join(targetDir, fileName);
            const publicPath = `/upload/${slug}/${fileName}`;

            if (fs.existsSync(savePath)) {
                newContent = newContent.split(imgUrl).join(publicPath);
                continue;
            }

            const task = downloadImage(imgUrl, savePath)
                .then(() => {
                    newContent = newContent.split(imgUrl).join(publicPath);
                    console.log(`   [本文画像DL] ${fileName}`);
                })
                .catch((err) => {
                    console.warn(`   [本文画像DL失敗] ${imgUrl} : ${err.message}`);
                });

            downloadPromises.push(task);
        } catch {
            console.warn(`   [URL解析エラー] ${imgUrl}`);
        }
    }

    await Promise.all(downloadPromises);
    return newContent;
}

// --- SQL パーサー ---

function parseSqlRow(rowString: string): string[] {
    const columns: string[] = [];
    let currentVal = '';
    let inQuote = false;
    let isEscaped = false;

    for (let i = 0; i < rowString.length; i++) {
        const char = rowString[i];
        if (isEscaped) {
            currentVal += char;
            isEscaped = false;
            continue;
        }
        if (char === '\\') {
            currentVal += char;
            isEscaped = true;
            continue;
        }
        if (char === "'") {
            inQuote = !inQuote;
            currentVal += char;
            continue;
        }
        if (char === ',' && !inQuote) {
            columns.push(currentVal.trim());
            currentVal = '';
            continue;
        }
        currentVal += char;
    }
    columns.push(currentVal.trim());
    return columns;
}

function* iterateSqlValues(sqlContent: string) {
    const valuesStartIndex = sqlContent.toUpperCase().indexOf('VALUES');
    if (valuesStartIndex === -1) return;

    let index = valuesStartIndex;
    let inParenthesis = false;
    let inQuote = false;
    let isEscaped = false;
    let currentBlock = '';

    while (index < sqlContent.length) {
        const char = sqlContent[index];
        if (isEscaped) {
            if (inParenthesis) currentBlock += char;
            isEscaped = false;
            index++;
            continue;
        }
        if (char === '\\') {
            if (inParenthesis) currentBlock += char;
            isEscaped = true;
            index++;
            continue;
        }
        if (char === "'") inQuote = !inQuote;
        if (char === '(' && !inQuote && !inParenthesis) {
            inParenthesis = true;
            currentBlock = '';
            index++;
            continue;
        }
        if (char === ')' && !inQuote && inParenthesis) {
            inParenthesis = false;
            yield currentBlock;
            currentBlock = '';
            index++;
            continue;
        }
        if (inParenthesis) currentBlock += char;
        index++;
    }
}

function cleanSqlValue(val: string): string {
    if (val === 'NULL' || val === undefined) return '';
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    return val
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\\\/g, '\\');
}

// 変更: 1つのテーブルに対する全てのINSERTブロックを結合して返すように修正
function extractSqlBlock(sqlContent: string, tableName: string): string | null {
    // グローバル検索(gフラグ)で全ての VALUES (...) 部分を探す
    const regex = new RegExp(
        `INSERT INTO \`${tableName}\`[\\s\\S]*?VALUES\\s*([^;]+);`,
        'gi'
    );
    let combinedValues = '';
    let match;

    while ((match = regex.exec(sqlContent)) !== null) {
        if (combinedValues) {
            combinedValues += ','; // 複数のブロックをカンマで結合
        }
        combinedValues += match[1];
    }

    return combinedValues.length > 0 ? combinedValues : null;
}

// --- カテゴリ解析 ---

function parseCategories(sqlContent: string): CategoryMap {
    const categoryMap: CategoryMap = new Map();
    const valuesBlock = extractSqlBlock(sqlContent, 'mt_category');
    if (!valuesBlock) return categoryMap;

    for (const rawRow of iterateSqlValues(`VALUES ${valuesBlock}`)) {
        const rawCols = parseSqlRow(rawRow);
        const id = parseInt(cleanSqlValue(rawCols[0]), 10);
        const basename = cleanSqlValue(rawCols[3]);
        const label = cleanSqlValue(rawCols[6]);
        const parentId = parseInt(cleanSqlValue(rawCols[7]), 10) || 0;
        if (id) categoryMap.set(id, { basename, label, parentId });
    }
    return categoryMap;
}

function parsePlacements(sqlContent: string): Map<number, number[]> {
    const placementMap: Map<number, number[]> = new Map();
    const valuesBlock = extractSqlBlock(sqlContent, 'mt_placement');
    if (!valuesBlock) return placementMap;

    for (const rawRow of iterateSqlValues(`VALUES ${valuesBlock}`)) {
        const rawCols = parseSqlRow(rawRow);
        const categoryId = parseInt(cleanSqlValue(rawCols[2]), 10);
        const entryId = parseInt(cleanSqlValue(rawCols[3]), 10);

        if (entryId && categoryId) {
            if (!placementMap.has(entryId)) placementMap.set(entryId, []);
            placementMap.get(entryId)!.push(categoryId);
        }
    }
    return placementMap;
}

function buildCategoryPath(
    categoryId: number,
    map: CategoryMap,
    path: string[] = []
): string[] {
    const category = map.get(categoryId);
    if (!category) return path;
    path.unshift(category.basename);
    if (category.parentId === 0) return path;
    return buildCategoryPath(category.parentId, map, path);
}

function getCategoryInfo(
    categoryId: number,
    map: CategoryMap
): CategoryInfo | null {
    const category = map.get(categoryId);
    if (!category) return null;
    return {
        id: categoryId,
        label: category.label,
        basename: category.basename,
        parentId: category.parentId,
        path: buildCategoryPath(categoryId, map),
    };
}

function parseBlogs(
    sqlContent: string
): Map<number, { site_url: string; archive_url: string }> {
    const map = new Map<number, { site_url: string; archive_url: string }>();
    const valuesBlock = extractSqlBlock(sqlContent, 'mt_blog');
    if (!valuesBlock) return map;

    for (const rawRow of iterateSqlValues(`VALUES ${valuesBlock}`)) {
        const cols = parseSqlRow(rawRow);
        const blog_id = parseInt(cleanSqlValue(cols[0]), 10);
        const site_url = cleanSqlValue(cols[4]).replace(/\/+$/, '');
        const archive_url = cleanSqlValue(cols[5]).replace(/\/+$/, '') || site_url;

        if (blog_id) {
            map.set(blog_id, { site_url, archive_url });
        }
    }
    return map;
}

// --- サムネイル解析 (mt_plugindata) ---

function extractThumbnailFromPluginData(blob: string): string | null {
    if (!blob || blob === 'NULL') return null;

    let decoded: string;

    if (blob.startsWith("X'") || blob.startsWith("x'")) {
        const hexString = blob.slice(2, -1);
        try {
            const buffer = Buffer.from(hexString, 'hex');
            decoded = buffer.toString('utf8');
        } catch (_) {
            return null;
        }
    } else if (blob.startsWith("'") && blob.endsWith("'")) {
        const content = blob.slice(1, -1);
        if (/^[0-9A-Fa-f]+$/.test(content) && content.length > 100) {
            try {
                const buffer = Buffer.from(content, 'hex');
                decoded = buffer.toString('utf8');
            } catch (_) {
                decoded = cleanSqlValue(blob);
            }
        } else {
            decoded = cleanSqlValue(blob);
        }
    } else {
        decoded = cleanSqlValue(blob);
    }

    const imgTagMatch = decoded.match(
        /<img\s+[^>]*src\s*=\s*["']([^"']+\.(?:jpe?g|gif|png|webp)[^"']*)["'][^>]*>/i
    );
    if (imgTagMatch) {
        return imgTagMatch[1];
    }

    const hyphenUrlMatch = decoded.match(
        /-\s*(https?:\/\/[^\s"'<>]+\.(?:jpe?g|gif|png|webp))/i
    );
    if (hyphenUrlMatch) {
        return hyphenUrlMatch[1];
    }

    const standardUrlMatch = decoded.match(
        /\b(https?:\/\/[^\s"'<>]+\.(?:jpe?g|gif|png|webp)(?:\?\w+=\w+)*)\b/i
    );
    if (standardUrlMatch) {
        return standardUrlMatch[1];
    }

    const looseUrlMatch = decoded.match(
        /(https?:\/\/[^\s"'<>]+\.(?:jpe?g|gif|png|webp))/i
    );
    if (looseUrlMatch) {
        return looseUrlMatch[1];
    }

    return null;
}

function parsePluginDataThumbnails(sqlContent: string): Map<number, string> {
    const map = new Map<number, string>();
    const block = extractSqlBlock(sqlContent, 'mt_plugindata');
    if (!block) return map;

    for (const row of iterateSqlValues(`VALUES ${block}`)) {
        const cols = parseSqlRow(row);
        const key = cleanSqlValue(cols[2]);
        const blob = cols[1];

        const entryMatch = key.match(/^entry_(\d+)$/);
        if (entryMatch) {
            const entryId = Number(entryMatch[1]);
            const url = extractThumbnailFromPluginData(blob);
            if (url) map.set(entryId, url);
        }
    }
    return map;
}

// --- カスタムフィールド解析 (mt_plugindata) ---

// 変更: SERG除去の強化と、文字数制限の撤廃
// 変更: SERG除去の強化と、文字数制限の撤廃
function extractCustomFieldFromPluginData(blob: string): string | null {
    if (!blob || blob === 'NULL') return null;

    let decoded: string;

    // HEX / String デコード処理
    if (blob.startsWith("X'") || blob.startsWith("x'")) {
        try {
            decoded = Buffer.from(blob.slice(2, -1), 'hex').toString('utf8');
        } catch {
            return null;
        }
    } else if (blob.startsWith("'") && blob.endsWith("'")) {
        const content = blob.slice(1, -1);
        if (/^[0-9A-Fa-f]+$/.test(content) && content.length > 100) {
            try {
                decoded = Buffer.from(content, 'hex').toString('utf8');
            } catch {
                decoded = cleanSqlValue(blob);
            }
        } else {
            decoded = cleanSqlValue(blob);
        }
    } else {
        decoded = cleanSqlValue(blob);
    }

    // クリーニング処理
    // 1. 制御文字とバイナリゴミの除去
    let cleaned = decoded.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
    cleaned = cleaned.replace(/SERG[\s\S]*?(\d+_)/, '$1'); // SERGヘッダからキー名付近までを除去試行
    cleaned = cleaned.replace(/SERG/g, ''); // 残ったSERGを除去

    // ★ ゴミ文字の除去
    cleaned = cleaned.replace(/\b\d[\w-]*?-\uFFFD\b/g, '');

    // ★ 対象の文字列の前
    cleaned = cleaned.replace(
        /^[\s\S]*?[0-9A-Za-z]+_height-[0-9A-Za-z]+_height-[0-9A-Za-z]+-\S/,
        ''
    );

    // ★ 対象の文字列の後
    cleaned = cleaned.replace(/7-5_height[\s\S]*/, '');

    // ★ 改行整理
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

    // 2. HTML/URL除去
    cleaned = cleaned.replace(/<img[^>]*>/gi, '');
    cleaned = cleaned.replace(
        /https?:\/\/[^\s"'<>]+\.(?:jpe?g|gif|png|webp)[^\s"'<>]*/gi,
        ''
    );
    cleaned = cleaned.replace(/<a[^>]*href=["'][^"']*["'][^>]*>/gi, '');
    cleaned = cleaned.replace(/<[^>]+>/g, '');

    // 3. 整形
    cleaned = cleaned
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/[\r\n]{3,}/g, '\n\n')
        .trim();

    return cleaned.length > 0 ? cleaned : null;
}

// 変更: extractSqlBlockの修正により自動的に全件取得されるようになりますが、
// 念のためカウント処理とキーのマッチングを確実にします。
function parsePluginDataCustomFields(sqlContent: string): Map<number, string> {
    const map = new Map<number, string>();
    // 修正版の extractSqlBlock を使用することで全ブロックが結合されて返ってきます
    const valuesBlock = extractSqlBlock(sqlContent, 'mt_plugindata');

    if (!valuesBlock) {
        console.log('  [警告] mt_plugindataテーブルが見つかりません');
        return map;
    }

    // 結合された巨大な文字列をパースする
    for (const row of iterateSqlValues(`VALUES ${valuesBlock}`)) {
        const cols = parseSqlRow(row);
        // mt_plugindataのカラム構成: [0]id, [1]data, [2]key ...
        const blob = cols[1];
        const key = cleanSqlValue(cols[2]);

        const entryMatch = key.match(/^entry_(\d+)$/);
        if (entryMatch) {
            const entryId = Number(entryMatch[1]);
            const customFieldText = extractCustomFieldFromPluginData(blob);

            // テキストが存在すればMapにセット
            if (customFieldText) {
                map.set(entryId, customFieldText);
            }
        }
    }

    return map;
}

// --- 本文先頭画像をフォールバックで取得 ---
function extractThumbnailFromContent(
    text: string,
    textMore: string
): string | null {
    const html = textMore + '\n' + text;
    const match = html.match(/<img\s+[^>]*src\s*=\s*["']([^"'>]+)["'][^>]*>/i);
    return match ? match[1].trim() : null;
}

// --- メイン処理 ---

async function main() {
    // --- 準備 ---
    if (!fs.existsSync(PUBLIC_UPLOAD_THUMBNAIL_DIR)) {
        fs.mkdirSync(PUBLIC_UPLOAD_THUMBNAIL_DIR, { recursive: true });
    }

    if (!fs.existsSync(PUBLIC_UPLOAD_TITLE_DIR)) {
        fs.mkdirSync(PUBLIC_UPLOAD_TITLE_DIR, { recursive: true });
    }

    if (!fs.existsSync(INPUT_SQL_FILE)) {
        console.error(`エラー: ${INPUT_SQL_FILE} が見つかりません`);
        process.exit(1);
    }

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    if (!fs.existsSync(PUBLIC_UPLOAD_DIR))
        fs.mkdirSync(PUBLIC_UPLOAD_DIR, { recursive: true });

    const sql = fs.readFileSync(INPUT_SQL_FILE, 'utf8');

    // --- MTデータ解析 ---
    console.log('MTデータ解析開始...');
    const blogMap = parseBlogs(sql);
    const categoryDataMap = parseCategories(sql);
    const entryCategoriesMap = parsePlacements(sql);
    const pluginThumbnailMap = parsePluginDataThumbnails(sql);
    const pluginCustomFieldMap = parsePluginDataCustomFields(sql);

    console.log(`カスタムフィールド解析完了: ${pluginCustomFieldMap.size}件`);

    // --- クローラー結果の読み込み ---
    const crawlerMapByTitle: Map<string, CrawlerItem> = new Map();
    const crawlerMapByUrl: Map<string, CrawlerItem> = new Map();
    const allCrawlerItems: CrawlerItem[] = [];

    if (fs.existsSync(CRAWLER_RESULTS_FILE)) {
        console.log(`クローラー結果 (${CRAWLER_RESULTS_FILE}) を読み込み中...`);
        const crawlerData: CrawlerItem[] = JSON.parse(
            fs.readFileSync(CRAWLER_RESULTS_FILE, 'utf8')
        );
        crawlerData.forEach((item) => {
            // 元のタイトルで保存
            allCrawlerItems.push(item);

            // 比較用のキーでマップを作成
            const titleKey = getNormalizedKey(item.title);
            if (titleKey) {
                if (!crawlerMapByTitle.has(titleKey)) {
                    crawlerMapByTitle.set(titleKey, item);
                }
            }

            // URLでもマップを作成
            const cleanUrl = item.pageUrl
                .replace(/\/index\.html$/i, '')
                .replace(/\/$/, '');
            crawlerMapByUrl.set(cleanUrl, item);
        });
        console.log(
            `クローラー結果 ${crawlerData.length} 件を読み込みました。比較可能なタイトルキー: ${crawlerMapByTitle.size}件`
        );
    }

    // --- MTエントリの処理 ---
    const seenSlugs = new Set<string>();
    let count = 0;

    for (const rawRow of iterateSqlValues(sql)) {
        const rawCols = parseSqlRow(rawRow);

        const entryId = parseInt(cleanSqlValue(rawCols[0]), 10);
        const basename = cleanSqlValue(rawCols[5]);
        const rawOriginalUrl = rawCols[9];
        const status = rawCols[12];
        const text = cleanSqlValue(rawCols[14]);
        const text_more = cleanSqlValue(rawCols[15]);
        const rawTitle = cleanSqlValue(rawCols[16]); // 元のタイトル（HTMLタグ含む）
        const created_on = cleanSqlValue(rawCols[19]);

        if (status != '2' && status != "'2'") continue; // 公開記事のみ

        // タイトル内の画像を検出（imgタグのみ除去、他はそのまま）
        const { cleanTitle: titleForComparison, imageUrl: titleImageUrl } =
            extractImageFromTitle(rawTitle);

        const fullText = (text + '\n\n' + text_more).trim();
        let cleanText = fullText;

        // スラッグ生成と重複チェック
        let slug = basename || `post-${entryId}`;
        slug = slug
            .toLowerCase()
            .replace(/[^a-z0-9\-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        let finalSlug = slug;
        let i = 1;
        while (seenSlugs.has(finalSlug)) finalSlug = `${slug}-${i++}`;
        seenSlugs.add(finalSlug);

        // 本文内の画像処理
        cleanText = await processImages(cleanText, finalSlug);

        // カテゴリ情報取得
        const associatedCategoryIds = entryCategoriesMap.get(entryId) || [];
        const categories = associatedCategoryIds
            .map((id) => getCategoryInfo(id, categoryDataMap))
            .filter((v): v is CategoryInfo => v !== null);

        const customField = pluginCustomFieldMap.get(entryId) || '';
        // ==================== タイトル画像処理 ====================
        let titlePath = '';
        if (titleImageUrl) {
            try {
                let absoluteUrl = titleImageUrl;

                // 相対パスの場合のURL補完
                if (!absoluteUrl.startsWith('http')) {
                    const blogId = parseInt(cleanSqlValue(rawCols[2]), 10);
                    const blog = blogMap.get(blogId);
                    const base = blog ? blog.site_url.replace(/\/+$/, '') : '';

                    if (absoluteUrl.startsWith('/')) {
                        absoluteUrl = base + absoluteUrl;
                    } else {
                        absoluteUrl = base + '/' + absoluteUrl.replace(/^\/+/, '');
                    }
                }

                const urlObj = new URL(absoluteUrl);
                const ext = path.extname(urlObj.pathname) || '.jpg';

                const titleDir = path.join(PUBLIC_UPLOAD_TITLE_DIR, String(entryId));
                if (!fs.existsSync(titleDir))
                    fs.mkdirSync(titleDir, { recursive: true });

                const savePath = path.join(titleDir, `title${ext}`);
                const publicPath = `/title/${entryId}/title${ext}`;

                if (!fs.existsSync(savePath)) {
                    await downloadImage(absoluteUrl, savePath);
                    console.log(`   [タイトル画像DL完了] ID:${entryId}`);
                }

                titlePath = publicPath;
            } catch (err: unknown) {
                console.warn(
                    `   [タイトル画像処理失敗] ID:${entryId} URL:${titleImageUrl} Error:`,
                    err instanceof Error ? err.message : err
                );
            }
        }

        // ==================== サムネイル取得ロジック ====================
        let thumbnailPath = '';
        let thumbUrl: string | null = null;

        let crawlerItem: CrawlerItem | undefined;

        // 1. 【最優先】正規化タイトルでクローラー結果とマッチング
        const mtTitleKey = getNormalizedKey(titleForComparison);
        crawlerItem = crawlerMapByTitle.get(mtTitleKey);

        if (!crawlerItem) {
            // より柔軟なマッチングを試行
            crawlerItem = findBestCrawlerMatch(titleForComparison, allCrawlerItems);

            if (crawlerItem) {
                console.log(
                    `   [部分一致] ID:${entryId} Title:"${titleForComparison.substring(0, 30)}..." -> Matched:"${crawlerItem.title.substring(0, 30)}..."`
                );
            }
        }

        if (crawlerItem) {
            thumbUrl = crawlerItem.imageUrl;
            console.log(
                `   [タイトル一致] ID:${entryId} Title:"${titleForComparison.substring(0, 30)}..." -> ${thumbUrl}`
            );
        } else {
            // 2. 【次点】URLでクローラー結果とマッチング
            const mtArticleUrl = extractUrl(rawOriginalUrl);
            if (mtArticleUrl) {
                const cleanUrl = mtArticleUrl
                    .replace(/\/index\.html$/i, '')
                    .replace(/\/$/, '');
                crawlerItem = crawlerMapByUrl.get(cleanUrl);
                if (crawlerItem) {
                    thumbUrl = crawlerItem.imageUrl;
                    console.log(
                        `   [URL一致] ID:${entryId} URL:"${cleanUrl}" -> ${thumbUrl}`
                    );
                }
            }
        }

        // 3. 【フォールバック】従来のMT個別ページ解析
        if (!thumbUrl) {
            const extractedUrl = extractUrl(rawOriginalUrl);

            if (extractedUrl) {
                const lowerUrl = extractedUrl.toLowerCase();

                if (lowerUrl.match(/\.(jpeg|jpg|png|gif|webp)$/)) {
                    thumbUrl = extractedUrl;
                    console.log(`   [URL直指定] ID:${entryId} -> ${thumbUrl}`);
                } else {
                    console.log(
                        `   [MT個別ページスクレイピング開始] ID:${entryId} -> ${extractedUrl}`
                    );
                    try {
                        const htmlContent = await fetchHtml(extractedUrl);
                        const scrapedImgUrl = extractImageFromHtml(htmlContent);

                        if (scrapedImgUrl) {
                            const urlObj = new URL(scrapedImgUrl, extractedUrl);
                            thumbUrl = urlObj.href;
                            console.log(
                                `   [個別ページスクレイピング成功] 画像発見: ${thumbUrl}`
                            );
                        } else {
                            console.log(
                                `   [個別ページスクレイピング失敗] 画像が見つかりませんでした`
                            );
                        }
                    } catch (err: unknown) {
                        if (err instanceof Error) {
                            console.warn(
                                `   [MT個別ページスクレイピングエラー] ${err.message}`
                            );
                        } else {
                            console.warn(
                                `   [MT個別ページスクレイピングエラー] ${String(err)}`
                            );
                        }
                    }
                }
            }

            // 4. 【フォールバック】CustomFields / 本文画像
            if (!thumbUrl && pluginThumbnailMap.has(entryId)) {
                thumbUrl = pluginThumbnailMap.get(entryId) || null;
                console.log(`   [CustomFields] ID:${entryId} -> ${thumbUrl}`);
            }

            if (!thumbUrl) {
                const fromContent = extractThumbnailFromContent(text, text_more);
                if (fromContent) {
                    thumbUrl = fromContent;
                    console.log(`   [本文画像] ID:${entryId}`);
                }
            }
        }
        // ========================================================================

        // 画像のダウンロード処理
        if (thumbUrl) {
            try {
                let absoluteUrl = thumbUrl;

                // 相対パスの場合のURL補完
                if (!absoluteUrl.startsWith('http')) {
                    const blogId = parseInt(cleanSqlValue(rawCols[2]), 10);
                    const blog = blogMap.get(blogId);
                    const base = blog ? blog.site_url.replace(/\/+$/, '') : '';

                    if (absoluteUrl.startsWith('/')) {
                        absoluteUrl = base + absoluteUrl;
                    } else {
                        absoluteUrl = base + '/' + absoluteUrl.replace(/^\/+/, '');
                    }
                }

                const urlObj = new URL(absoluteUrl);
                let fileName = decodeURIComponent(path.basename(urlObj.pathname));

                if (!path.extname(fileName) || fileName.length > 50) {
                    fileName = `thumb-${entryId}.jpg`;
                }

                const thumbDir = path.join(
                    PUBLIC_UPLOAD_THUMBNAIL_DIR,
                    String(entryId)
                );
                if (!fs.existsSync(thumbDir))
                    fs.mkdirSync(thumbDir, { recursive: true });

                const savePath = path.join(
                    thumbDir,
                    'thumbnail' + path.extname(fileName)
                );
                const publicPath = `/thumbnail/${entryId}/thumbnail${path.extname(fileName)}`;

                if (!fs.existsSync(savePath)) {
                    await downloadImage(absoluteUrl, savePath);
                    console.log(`   [サムネDL完了] ID:${entryId} -> ${fileName}`);
                }

                thumbnailPath = publicPath;
            } catch (err: unknown) {
                if (err instanceof Error) {
                    console.warn(
                        `   [サムネ処理失敗] ID:${entryId} URL:${thumbUrl} Error:${err.message}`
                    );
                } else {
                    console.warn(`   [サムネ処理失敗] ${String(err)}`);
                }
            }
        }

        // --- 最終データ生成と書き出し ---
        cleanText = cleanText
            .replace(/<\s*([^a-z0-9/])(?:.*?)?>/gi, '')
            .replace(/<font\b[^>]*>/gi, '')
            .replace(/<\/font>/gi, '')
            .replace(/ style=['"].*?['"]/gi, '');

        // タイトルの最終決定：
        // 1. タイトル画像がある場合は画像パスを使用
        // 2. それ以外は元のタイトル（imgタグは除去済み）をそのまま使用
        const finalTitle = titlePath || titleForComparison || '(無題)';

        const post = {
            id: entryId,
            title: finalTitle, // タイトル画像パス or 元のタイトル（HTMLタグ含む）
            date: created_on.replace(/'/g, '').substring(0, 10),
            author: 'No Name',
            thumbnail: thumbnailPath,
            content: cleanText,
            categories,
            customField,
            excerpt:
                cleanText
                    .replace(/<[^>]*>?/gm, '')
                    .slice(0, 200)
                    .replace(/\n/g, ' ') + '...',
        };

        fs.writeFileSync(
            path.join(OUTPUT_DIR, `${finalSlug}.json`),
            JSON.stringify(post, null, 2)
        );
        count++;
    }

    console.log(`公開記事書き出し: ${count} 件 完了!`);
    console.log(`カスタムフィールド: ${pluginCustomFieldMap.size} 件`);
}

main().catch((err) => console.error('致命的エラー:', err));
