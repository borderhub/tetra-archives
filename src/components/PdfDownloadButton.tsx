'use client';

// クライアントコンポーネントとしてボタンを定義
export default function PdfDownloadButton() {
  const handleDownload = () => {
    alert('PDF生成機能は現在準備中です。');
  };

  return (
    <section>
      <h2 className="text-sm font-bold tracking-widest uppercase mb-3">
        DOWNLOAD
      </h2>
      <button
        onClick={handleDownload}
        className="w-full text-center border-2 border-black px-4 py-2 font-bold bg-white text-black hover:bg-red-600 hover:border-red-600 hover:text-white transition-colors duration-200"
      >
        Download PDF
      </button>
      <p className="text-xs text-gray-500 mt-2">
        ※ 印刷向けのpdfで出力されます。
      </p>
    </section>
  );
}
