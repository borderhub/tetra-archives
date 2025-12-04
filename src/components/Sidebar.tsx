'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { ReactNode, useEffect } from 'react';

interface SidebarProps {
  title: string;
  titleLink: string;
  mobileTitle: string;
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * サイドバーコンポーネント（デスクトップ開閉機能対応版）
 * 
 * モバイル: オーバーレイ付きの全画面サイドバー
 * デスクトップ: 開閉可能な固定サイドバー
 */
export default function Sidebar({
  title,
  titleLink,
  mobileTitle,
  isMobile,
  isOpen,
  onClose,
  children,
}: SidebarProps) {
  return (
    <>
      {/* オーバーレイ（モバイルのみ） */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-opacity-50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* サイドバー本体 */}
      <aside
        className={`
          p-4 fixed lg:sticky top-0 h-screen bg-white shadow-lg z-40
          transition-all duration-300 ease-in-out
          ${isMobile
            ? // モバイル: スライドイン・アウト
            isOpen
              ? 'translate-x-0 w-80'
              : '-translate-x-full w-80'
            : // デスクトップ: 幅の変更とフェード
            isOpen
              ? 'w-80 opacity-100'
              : 'w-0 opacity-0 overflow-hidden'
          }
        `}
      >
        <div className="flex flex-col h-full">
          {/* ヘッダー */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <Link
              href={titleLink}
              className="text-2xl font-bold text-gray-900 hover:text-gray-700 transition-colors"
            >
              {isMobile ? mobileTitle : title}
            </Link>

            {/* 閉じるボタン（モバイルのみ） */}
            {isMobile && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="サイドバーを閉じる"
              >
                <X size={24} className="text-gray-600" />
              </button>
            )}
          </div>

          {/* コンテンツエリア */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </aside>
    </>
  );
}
