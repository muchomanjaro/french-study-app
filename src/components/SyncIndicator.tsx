import React from "react";

interface SyncIndicatorProps {
  syncing?: boolean;
  synced?: boolean;
  lastSync?: string;
}

export default function SyncIndicator({ syncing = false, synced = false, lastSync }: SyncIndicatorProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
          syncing
            ? "bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300"
            : synced
            ? "bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700 text-green-600 dark:text-green-300"
            : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
        }`}
      >
        {syncing && (
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        <span>{syncing ? "Syncing..." : synced ? "Saved" : "Offline"}</span>
        {lastSync && <span className="opacity-50">{lastSync}</span>}
      </div>
    </div>
  );
}
