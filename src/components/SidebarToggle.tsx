'use client';

import { PanelLeft, PanelLeftClose } from 'lucide-react';

interface SidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export default function SidebarToggle({
  isOpen,
  onToggle,
  className = '',
}: SidebarToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`fixed top-4 left-4 z-50 lg:flex hidden items-center justify-center w-10 h-10 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-all duration-200 hover:shadow-xl ${className}`}
      aria-label={isOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
      title={isOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
    >
      {isOpen ? (
        <PanelLeftClose size={20} className="text-gray-700" />
      ) : (
        <PanelLeft size={20} className="text-gray-700" />
      )}
    </button>
  );
}
