import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  /* config options here */
  basePath: isProd ? '/tetra_archives' : '',
  assetPrefix: isProd ? '/tetra_archives/' : '',
  images: {
    unoptimized: isProd, // GitHub Pagesでは最適化を無効化
  },
  ...(isProd && { output: 'export' }), // 本番時のみ静的エクスポートを有効化
};

export default nextConfig;