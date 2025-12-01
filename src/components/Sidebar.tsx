'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

type SidebarProps = {
  title?: string; // サイドバータイトル（デフォルト: "ARCHIVE"）
  titleLink?: string; // タイトルのリンク先
  mobileTitle?: string; // モバイルメニューのタイトル（デフォルト: "MENU"）
  children: ReactNode;
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
  className?: string; // 追加のカスタムクラス
};

export default function Sidebar({
  title = 'ARCHIVE',
  titleLink,
  mobileTitle = 'MENU',
  children,
  isMobile,
  isOpen,
  onClose,
  className = '',
}: SidebarProps) {
  return (
    <>
      {/* デスクトップサイドバー */}
      <aside
        className={`hidden lg:block w-80 bg-white border-r border-gray-200 sticky top-0 h-screen overflow-y-auto shadow-lg ${className}`}
      >
        <div className="p-8">
          <h1 className="text-3xl font-black mb-10 tracking-wider">
            {titleLink ? (
              <Link
                href={titleLink}
                className="hover:text-gray-600 transition-colors"
              >
                {title}
              </Link>
            ) : (
              <span>{title}</span>
            )}
          </h1>
          {children}
        </div>
      </aside>

      {/* モバイルサイドバー（オーバーレイ） */}
      {isMobile && (
        <>
          {/* オーバーレイ背景 */}
          <div
            className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 lg:hidden ${
              isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
            }`}
            onClick={onClose}
          />

          {/* サイドバーパネル */}
          <aside
            className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 z-50 lg:hidden overflow-y-auto ${
              isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black tracking-wider">
                  {mobileTitle}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close menu"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              {children}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
