import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Plus, X } from 'lucide-react';

/** Tabs rendered inside the title bar. The active tab merges into the desk below it. */
export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useAppStore();

  return (
    <div className="flex items-end h-full min-w-0 gap-px overflow-x-auto no-drag [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                closeTab(tab.id);
              }
            }}
            onClick={() => setActiveTab(tab.id)}
            title={tab.filePath || tab.title}
            className={`group relative flex items-center gap-2 h-[32px] pl-3 pr-1.5 min-w-[120px] max-w-[220px] rounded-t-lg text-ui cursor-default transition-colors ${
              isActive
                ? 'bg-desk text-ink font-medium'
                : 'text-muted hover:text-ink hover:bg-ink/[0.04]'
            }`}
          >
            <span className="truncate flex-1">{tab.title}</span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              aria-label={`${tab.title} sekmesini kapat`}
              className="relative grid place-items-center w-5 h-5 rounded shrink-0 hover:bg-ink/10"
            >
              {/* Unsaved dot that turns into a close button on hover */}
              {tab.isDirty && (
                <span className="absolute w-[7px] h-[7px] rounded-full bg-accent group-hover:opacity-0 transition-opacity" />
              )}
              <X
                className={`w-3.5 h-3.5 transition-opacity ${
                  tab.isDirty ? 'opacity-0 group-hover:opacity-100' : isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60'
                }`}
              />
            </button>

            {/* Soft separators between inactive tabs */}
            {!isActive && (
              <span className="absolute right-0 top-2 bottom-2 w-px bg-line group-hover:opacity-0" />
            )}
          </div>
        );
      })}

      <button
        onClick={() => addTab()}
        title="Yeni belge (Ctrl+N)"
        aria-label="Yeni belge"
        className="icon-btn mb-[3px] ml-1 shrink-0"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
