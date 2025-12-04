'use client';

import { LayoutGrid, List } from 'lucide-react';

type ViewMode = 'list' | 'masonry';

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  className?: string;
}

export default function ViewToggle({
  currentView,
  onViewChange,
  className = '',
}: ViewToggleProps) {
  return (
    <div
      className={`inline-flex items-center bg-white rounded-lg shadow-md border border-gray-200 p-1 ${className}`}
    >
      <button
        onClick={() => onViewChange('list')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          currentView === 'list'
            ? 'bg-gray-600 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
        aria-label="リスト表示"
      >
        <List size={18} />
        <span className="hidden sm:inline">リスト</span>
      </button>
      <button
        onClick={() => onViewChange('masonry')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          currentView === 'masonry'
            ? 'bg-gray-600 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
        aria-label="グリッド表示"
      >
        <LayoutGrid size={18} />
        <span className="hidden sm:inline">グリッド</span>
      </button>
    </div>
  );
}

export type { ViewMode };
