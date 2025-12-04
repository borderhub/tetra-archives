'use client';

import { useState } from 'react';
import Image from 'next/image';

/**
 * html2canvasの動作確認用テストコンポーネント
 *
 * 使用方法:
 * 1. src/app/test-pdf/page.tsx として配置
 * 2. http://localhost:3000/test-pdf にアクセス
 * 3. 各ボタンをクリックして動作を確認
 */
export default function TestPDFComponent() {
  const [status, setStatus] = useState('待機中...');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  // テスト1: html2canvasのインポート確認
  const testImport = async () => {
    setStatus('テスト1: インポート確認中...');
    setLogs([]);
    try {
      addLog('html2canvas インポート開始...');
      const html2canvasModule = await import('html2canvas-pro');
      const html2canvas = html2canvasModule.default;
      addLog(`html2canvas インポート成功: ${typeof html2canvas}`);

      addLog('jsPDF インポート開始...');
      const jsPDFModule = await import('jspdf');
      const { jsPDF } = jsPDFModule;
      addLog(`jsPDF インポート成功: ${typeof jsPDF}`);

      setStatus('✅ インポートテスト成功');
    } catch (error) {
      addLog(`❌ エラー: ${error}`);
      setStatus('❌ インポートテスト失敗');
    }
  };

  // テスト2: 要素のキャプチャ確認
  const testCapture = async () => {
    setStatus('テスト2: キャプチャ確認中...');
    setLogs([]);
    try {
      addLog('html2canvas 読み込み中...');
      const html2canvas = (await import('html2canvas-pro')).default;

      addLog('要素取得中...');
      const element = document.getElementById('test-content');
      if (!element) {
        throw new Error('test-content要素が見つかりません');
      }
      addLog(`要素取得成功: ${element.tagName}`);

      // 要素をクローンしてスタイルを書き換え
      addLog('要素をクローンしてスタイルを書き換え中...');
      const clonedElement = element.cloneNode(true) as HTMLElement;
      clonedElement.id = 'test-content-clone';
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-9999px';
      clonedElement.style.top = '0';
      document.body.appendChild(clonedElement);

      // すべての要素のbackground-imageを削除
      const allElements = [
        clonedElement,
        ...Array.from(clonedElement.querySelectorAll('*')),
      ];
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.backgroundImage = 'none';
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      addLog('キャプチャ開始...');
      const canvas = await html2canvas(clonedElement, {
        scale: 2,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // クリーンアップ
      document.body.removeChild(clonedElement);

      addLog(`キャプチャ成功! サイズ: ${canvas.width}x${canvas.height}px`);
      setStatus('✅ キャプチャテスト成功');
    } catch (error) {
      addLog(`❌ エラー: ${error}`);
      setStatus('❌ キャプチャテスト失敗');
      console.error('詳細エラー:', error);

      // クリーンアップ
      const clonedElement = document.getElementById('test-content-clone');
      if (clonedElement) document.body.removeChild(clonedElement);
    }
  };

  // テスト3: PDF生成確認
  const testPDFGeneration = async () => {
    setStatus('テスト3: PDF生成確認中...');
    setLogs([]);
    try {
      addLog('ライブラリ読み込み中...');
      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');

      addLog('要素取得中...');
      const element = document.getElementById('test-content');
      if (!element) throw new Error('要素なし');

      // 要素をクローンしてスタイルを書き換え
      addLog('要素をクローンしてスタイルを書き換え中...');
      const clonedElement = element.cloneNode(true) as HTMLElement;
      clonedElement.id = 'test-content-clone';
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-9999px';
      clonedElement.style.top = '0';
      document.body.appendChild(clonedElement);

      // すべての要素のbackground-imageを削除
      const allElements = [
        clonedElement,
        ...Array.from(clonedElement.querySelectorAll('*')),
      ];
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.backgroundImage = 'none';
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      addLog('キャプチャ中...');
      const canvas = await html2canvas(clonedElement, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      addLog(`キャプチャ完了: ${canvas.width}x${canvas.height}px`);

      // クリーンアップ
      document.body.removeChild(clonedElement);

      addLog('画像データ変換中...');
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      addLog('画像データ変換完了');

      addLog('PDF作成中...');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      addLog('PDF画像追加中...');
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

      addLog('PDF保存中...');
      pdf.save('test.pdf');

      addLog('✅ PDF生成成功! test.pdfをダウンロードしました');
      setStatus('✅ PDF生成テスト成功');
    } catch (error) {
      addLog(`❌ エラー: ${error}`);
      setStatus('❌ PDF生成テスト失敗');
      console.error('詳細エラー:', error);

      // クリーンアップ
      const clonedElement = document.getElementById('test-content-clone');
      if (clonedElement) document.body.removeChild(clonedElement);
    }
  };

  // テスト4: 画像付きキャプチャ確認
  const testWithImages = async () => {
    setStatus('テスト4: 画像付きキャプチャ確認中...');
    setLogs([]);
    try {
      addLog('html2canvas 読み込み中...');
      const html2canvas = (await import('html2canvas-pro')).default;

      addLog('要素取得中...');
      const element = document.getElementById('test-content-with-image');
      if (!element) {
        throw new Error('test-content-with-image要素が見つかりません');
      }

      // LAB色回避処理は不要だが、念のため追加
      addLog('キャプチャ開始（画像込み）...');
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      addLog(`キャプチャ成功! サイズ: ${canvas.width}x${canvas.height}px`);
      setStatus('✅ 画像付きキャプチャテスト成功');
    } catch (error) {
      addLog(`❌ エラー: ${error}`);
      setStatus('❌ 画像付きキャプチャテスト失敗');
      console.error('詳細エラー:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">html2canvas 動作テスト</h1>

        {/* ステータス表示 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">ステータス</h2>
          <p className="text-lg">{status}</p>
        </div>

        {/* テストボタン */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">テスト実行</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={testImport}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded"
            >
              テスト1: インポート確認
            </button>
            <button
              onClick={testCapture}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded"
            >
              テスト2: キャプチャ確認
            </button>
            <button
              onClick={testPDFGeneration}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded"
            >
              テスト3: PDF生成
            </button>
            <button
              onClick={testWithImages}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded"
            >
              テスト4: 画像付きキャプチャ
            </button>
          </div>
        </div>

        {/* ログ表示 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">実行ログ</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">ログなし</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* テストコンテンツ1: テキストのみ */}
        <div
          id="test-content"
          className="bg-white rounded-lg shadow p-8 mb-6 border-4 border-blue-500"
        >
          <h2 className="text-2xl font-bold mb-4 text-gray-800">
            テストコンテンツ1
          </h2>
          <p className="text-gray-700 mb-4">
            これはhtml2canvasのテストコンテンツです。
            このボックスがPDFに正しくキャプチャされるか確認します。
          </p>
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 rounded">
            <p className="font-bold">グラデーション背景のテスト</p>
            <p>日本語テキストが正しく表示されるか確認</p>
          </div>
        </div>

        {/* テストコンテンツ2: 画像付き */}
        <div
          id="test-content-with-image"
          className="bg-white rounded-lg shadow p-8 border-4 border-green-500"
        >
          <h2 className="text-2xl font-bold mb-4 text-gray-800">
            テストコンテンツ2（画像付き）
          </h2>
          <p className="text-gray-700 mb-4">
            画像が含まれるコンテンツのテストです。
          </p>
          <div className="bg-gray-200 p-4 rounded mb-4">
            <p className="text-sm text-gray-600 mb-2">プレースホルダー画像:</p>
            <Image
              src="https://via.placeholder.com/400x200/4299e1/ffffff?text=Test+Image"
              alt="Test"
              className="w-full rounded"
            />
          </div>
          <p className="text-gray-600 text-sm">
            ※ 画像が表示されない場合はCORS設定を確認してください
          </p>
        </div>

        {/* 説明 */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded">
          <h3 className="font-bold mb-2">テストの進め方:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              まず「テスト1:
              インポート確認」を実行して、ライブラリが正しく読み込めるか確認
            </li>
            <li>
              次に「テスト2: キャプチャ確認」でキャプチャ機能が動作するか確認
            </li>
            <li>「テスト3: PDF生成」で実際にPDFファイルをダウンロード</li>
            <li>
              「テスト4:
              画像付きキャプチャ」で画像を含むコンテンツのキャプチャを確認
            </li>
          </ol>
          <p className="mt-4 text-sm text-gray-700">
            各テストの実行ログとブラウザのコンソールを確認して、エラーがないか確認してください。
          </p>
        </div>
      </div>
    </div>
  );
}
