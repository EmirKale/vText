import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Plus, X, FileText } from 'lucide-react';

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useAppStore();

  return (
    <div className="flex items-center h-9 px-2 gap-1 border-b border-border-light dark:border-border-dark bg-canvas-light/60 dark:bg-canvas-dark/60 select-none overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex items-center gap-2 h-7 px-3 rounded-md text-xs cursor-pointer transition-all border ${
              isActive
                ? 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark font-medium shadow-sm text-content-light dark:text-content-dark'
                : 'border-transparent text-content-mutedLight dark:text-content-mutedDark hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5 opacity-70" />
            <span className="truncate max-w-[140px]">{tab.title}</span>
            {tab.isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"></span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      <button
        onClick={() => addTab()}
        title="Yeni Belge (Ctrl+N)"
        className="flex items-center justify-center w-7 h-7 rounded-md text-content-mutedLight dark:text-content-mutedDark hover:bg-black/5 dark:hover:bg-white/5 hover:text-content-light dark:hover:text-content-dark transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
