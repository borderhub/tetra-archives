/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. 静的エクスポート (SSG) の設定を明示
  output: 'export',

  // 2. ★ 重要な設定: basePath ★
  // GitHub Pages のリポジトリ名（サブディレクトリ名）を指定
  basePath: '/tetra-archives',

  // 3. 画像最適化の無効化（静的エクスポートの制限対策、必要に応じて）
  images: {
    unoptimized: true,
  },

  // App Router の場合は experimental を設定
  experimental: {
    // Turbopackのroot警告を解消したい場合はこちら
    // turbopack: {
    //   root: __dirname,
    // },

    // 静的エクスポート時のデータフェッチを許可
    appDir: true,
  },
};

module.exports = nextConfig;
