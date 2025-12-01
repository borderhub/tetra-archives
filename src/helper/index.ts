/**
 * HTMLタグをすべて除去（<br>, <b>, <strong> など全部消す）
 * <br> は半角スペースに変換して自然な見た目に
 */
export function stripHtmlTags(text: string): string {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, ' ') // <br> <br/> <br /> をスペースに
    .replace(/<\/?[^>]+>/g, '') // その他の全HTMLタグを除去
    .replace(/\s+/g, ' ') // 連続スペースを1つに
    .trim();
}

/**
 * 改行を残したい場合のバージョン（おすすめ）
 */
export function stripHtmlTagsKeepLineBreaks(text: string): string {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n') // <br> を改行に変換
    .replace(/<\/?[^>]+>/g, '') // 他のタグ除去
    .replace(/\n\s*\n/g, '\n') // 連続改行を整理
    .trim();
}
