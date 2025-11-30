import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const INPUT_SQL_FILE = './mt-dump.sql';
const OUTPUT_DIR = './src/data';
const PUBLIC_UPLOAD_DIR = './public/upload'; // 画像保存先のルート

// --- 型定義 ---

type CategoryMap = Map<number, { basename: string; label: string; parentId: number }>;

type CategoryInfo = {
  id: number;
  label: string;
  basename: string;
  parentId: number;
  path: string[]; // 階層パス (例: ["genre", "music_event"])
};

// --- ヘルパー関数（画像処理） ---

/**
 * 画像をダウンロードするヘルパー関数
 */
function downloadImage(url: string, savePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(savePath);

    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        fs.unlink(savePath, () => {});
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
      fs.unlink(savePath, () => {});
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlink(savePath, () => {});
      reject(err);
    });
  });
}

/**
 * 記事内の画像を抽出・ダウンロードし、パスを置換する関数
 */
async function processImages(content: string, slug: string): Promise<string> {
  const imgRegex = /<img\s+[^>]*src\s*=\s*["'](http[^"']+)["'][^>]*>/gi;
  const matches = [...content.matchAll(imgRegex)];

  if (matches.length === 0) {
    return content;
  }

  const targetDir = path.join(PUBLIC_UPLOAD_DIR, slug);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let newContent = content;
  const downloadPromises: Promise<void>[] = [];
  const processedUrls = new Set<string>();

  for (const match of matches) {
    const imgUrl = match[1];

    if (processedUrls.has(imgUrl)) continue;
    processedUrls.add(imgUrl);

    try {
      const urlObj = new URL(imgUrl);
      let fileName = path.basename(urlObj.pathname);
      
      if (!fileName || fileName.length > 50 || !fileName.includes('.')) {
        fileName = `image-${Date.now()}.jpg`; 
      }
      fileName = decodeURIComponent(fileName);

      const savePath = path.join(targetDir, fileName);
      const publicPath = `/upload/${slug}/${fileName}`;

      // ★ ファイルが存在するかチェックし、存在すればスキップ
      if (fs.existsSync(savePath)) {
          // console.log(`   [画像スキップ] 既にファイルが存在します: ${fileName}`);
          newContent = newContent.split(imgUrl).join(publicPath);
          continue; 
      }
      
      const task = downloadImage(imgUrl, savePath)
        .then(() => {
          newContent = newContent.split(imgUrl).join(publicPath);
          console.log(`   [画像DL] ${fileName}`);
        })
        .catch((err) => {
          console.warn(`   [画像DL失敗] ${imgUrl} : ${err.message}`);
        });

      downloadPromises.push(task);

    } catch (e) {
      console.warn(`   [URL解析エラー] ${imgUrl}`);
    }
  }

  await Promise.all(downloadPromises);

  return newContent;
}

// --- SQLパーサー関数（変更なし） ---

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
    if (char === "'") {
      inQuote = !inQuote;
    }
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
    if (inParenthesis) {
      currentBlock += char;
    }
    index++;
  }
}

function cleanSqlValue(val: string): string {
  if (val === 'NULL' || val === undefined) return '';
  if (val.startsWith("'") && val.endsWith("'")) {
    val = val.slice(1, -1);
  }
  return val
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
}

// --- カテゴリ/配置 処理の追加 ---

/**
 * SQLコンテンツから特定のテーブルのVALUESブロックを抽出する
 */
function extractSqlBlock(sqlContent: string, tableName: string): string | null {
  // `INSERT INTO <tableName>` から始まり、次のセミコロン（`;`）までを検索
  const match = sqlContent.match(new RegExp(`INSERT INTO \`${tableName}\`[\\s\\S]*?VALUES\\s*([^;]+)`, 'is'));
  return match ? match[1] : null;
}

/**
 * mt_categoryテーブルからカテゴリ情報を解析してマップを作成する
 */
function parseCategories(sqlContent: string): CategoryMap {
  const categoryMap: CategoryMap = new Map();
  
  const valuesBlock = extractSqlBlock(sqlContent, 'mt_category');
  if (!valuesBlock) {
    console.warn("警告: mt_category の INSERT 文が見つかりませんでした。");
    return categoryMap;
  }
  
  for (const rawRow of iterateSqlValues(`VALUES ${valuesBlock}`)) {
    const rawCols = parseSqlRow(rawRow);
    
    // mt_category table schema index (推定):
    // 0: category_id
    // 3: category_basename
    // 6: category_label
    // 7: category_parent
    
    const id = parseInt(cleanSqlValue(rawCols[0]), 10);
    const basename = cleanSqlValue(rawCols[3]);
    const label = cleanSqlValue(rawCols[6]);
    const parentId = parseInt(cleanSqlValue(rawCols[7]), 10) || 0;

    if (id) {
      categoryMap.set(id, { basename, label, parentId });
    }
  }
  
  return categoryMap;
}

/**
 * ★ 新規追加: mt_placementテーブルから記事IDとカテゴリIDの紐付けマップを作成する
 */
function parsePlacements(sqlContent: string): Map<number, number[]> {
    const placementMap: Map<number, number[]> = new Map();
    
    const valuesBlock = extractSqlBlock(sqlContent, 'mt_placement');
    if (!valuesBlock) {
      console.warn("警告: mt_placement の INSERT 文が見つかりませんでした。");
      return placementMap;
    }
    
    for (const rawRow of iterateSqlValues(`VALUES ${valuesBlock}`)) {
      const rawCols = parseSqlRow(rawRow);
      
      // mt_placement table schema index (推定):
      // 2: placement_category_id
      // 3: placement_entry_id
      
      const categoryId = parseInt(cleanSqlValue(rawCols[2]), 10);
      const entryId = parseInt(cleanSqlValue(rawCols[3]), 10);
  
      if (entryId && categoryId) {
        if (!placementMap.has(entryId)) {
          placementMap.set(entryId, []);
        }
        placementMap.get(entryId)!.push(categoryId);
      }
    }
    
    return placementMap;
}

/**
 * カテゴリIDから階層パス（basenameの配列）を構築する
 */
function buildCategoryPath(
    categoryId: number, 
    map: CategoryMap, 
    path: string[] = []
): string[] {
    const category = map.get(categoryId);
    if (!category) {
        return path;
    }
    
    path.unshift(category.basename); 
    
    if (category.parentId === 0) {
        return path;
    }
    
    return buildCategoryPath(category.parentId, map, path);
}

/**
 * カテゴリIDに基づいて完全なカテゴリ情報を取得する
 */
function getCategoryInfo(
    categoryId: number, 
    map: CategoryMap
): CategoryInfo | null {
    const category = map.get(categoryId);
    if (!category) return null;

    const path = buildCategoryPath(categoryId, map);

    return {
        id: categoryId,
        label: category.label,
        basename: category.basename,
        parentId: category.parentId,
        path: path
    };
}


// --- メイン処理 ---

async function main() {
  if (!fs.existsSync(INPUT_SQL_FILE)) {
    console.error(`エラー: ${INPUT_SQL_FILE} が見つかりません`);
    process.exit(1);
  }

  // 出力ディレクトリ作成
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(PUBLIC_UPLOAD_DIR)) fs.mkdirSync(PUBLIC_UPLOAD_DIR, { recursive: true });

  console.log('SQLファイルを読み込んでいます...');
  const sql = fs.readFileSync(INPUT_SQL_FILE, 'utf8');

  // ★ 1. カテゴリデータの読み込みとマップ作成
  console.log('カテゴリデータを解析しています (mt_category)...');
  const categoryDataMap = parseCategories(sql);
  console.log(`カテゴリを ${categoryDataMap.size} 件読み込みました。`);
  
  // ★ 2. 配置データ (mt_placement) の読み込みとマップ作成
  console.log('配置データを解析しています (mt_placement)...');
  const entryCategoriesMap = parsePlacements(sql);
  console.log(`記事とカテゴリの紐付けを ${entryCategoriesMap.size} 記事分読み込みました。`);


  let count = 0;
  const seenSlugs = new Set<string>();

  // mt_entryのデータ処理を開始
  for (const rawRow of iterateSqlValues(sql)) {
    const rawCols = parseSqlRow(rawRow);
    
    // mt_entry table schema index (推定):
    const id = cleanSqlValue(rawCols[0]);
    const entryId = parseInt(id, 10);
    // entry_category_id (rawCols[4]や[7]) は無視し、placementテーブルを使用
    const basename = cleanSqlValue(rawCols[5]);
    const status = rawCols[12]; 
    const text = cleanSqlValue(rawCols[14]);
    const text_more = cleanSqlValue(rawCols[15]);
    const title = cleanSqlValue(rawCols[16]);
    const created_on = cleanSqlValue(rawCols[19]);

    // 公開ステータスチェック
    if (status != '2' && status != "'2'") {
      continue;
    }

    const fullText = (text + '\n\n' + text_more).trim();
    let cleanText = fullText.trim();

    // スラッグ生成
    let slug = basename && basename !== '' ? basename : `post-${id}`;
    slug = slug.toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    let finalSlug = slug;
    let i = 1;
    while (seenSlugs.has(finalSlug)) {
      finalSlug = `${slug}-${i++}`;
    }
    seenSlugs.add(finalSlug);

    console.log(`処理中: ${finalSlug} (ID:${id})`);

    // 画像ダウンロード処理の実行
    cleanText = await processImages(cleanText, finalSlug);
    
    // ★ 3. 複数カテゴリ情報の取得と追加
    const associatedCategoryIds = entryCategoriesMap.get(entryId) || [];
    
    const categories: CategoryInfo[] = associatedCategoryIds
        .map(catId => getCategoryInfo(catId, categoryDataMap))
        .filter((info): info is CategoryInfo => info !== null); 

    // ★ 永続的なエラー回避のためのタグ除去処理を追加 ★
    // 1. <DMより転載> のような、a-z, 0-9, / 以外で始まる無効なタグを除去
    //    (注: これにより <日本語タグ> や <!!!> など、非標準タグを大雑把に除去できます)
    cleanText = cleanText.replace(/<\s*([^a-z0-9/])(?:.*?)?>/gi, ''); 
    // 2. 廃止された <font> タグと閉じタグ </font> を両方除去
    cleanText = cleanText.replace(/<font\b[^>]*>/gi, '').replace(/<\/font>/gi, '');
    // 3. すべての要素から style="..." 属性を削除 (前々回の問題対策)
    cleanText = cleanText.replace(/ style=['"].*?['"]/gi, '');

    const post = {
      id: entryId,
      title: title || '(無題)',
      date: created_on.replace(/'/g, '').substring(0, 10),
      author: "No Name",
      content: cleanText || "",
      // ★ カテゴリ情報を配列として追加
      categories: categories, 
      excerpt: cleanText.replace(/<[^>]*>?/gm, '').slice(0, 200).replace(/\n/g, ' ') + "..." 
    };

    const filePath = path.join(OUTPUT_DIR, `${finalSlug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(post, null, 2));
    
    count++;
  }

  console.log('------------------------------------------------');
  console.log(`書き出した公開記事: ${count} 件`);
  console.log(`完了！`);
}

main().catch(err => console.error('致命的エラー:', err));
