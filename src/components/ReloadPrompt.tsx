import React, { useState, useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { RotateCw, X } from 'lucide-react';

export const ReloadPrompt: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateFunction, setUpdateFunction] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const update = registerSW({
        onNeedRefresh() {
          setNeedRefresh(true);
        },
        onOfflineReady() {
          // Ready for offline use
        },
      });
      setUpdateFunction(() => update);
    }
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded border border-[#0F7B6C]/30 bg-white p-3 shadow-lg flex items-center justify-between gap-3 text-xs text-[#37352F] animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-[#0F7B6C] animate-pulse" />
        <span>New version available!</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => updateFunction?.()}
          className="inline-flex items-center gap-1 rounded bg-[#0F7B6C] px-2.5 py-1 font-medium text-white hover:bg-[#0C6256] cursor-pointer"
        >
          <RotateCw className="h-3 w-3" />
          <span>Reload</span>
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="rounded p-1 text-[#5F5E5B] hover:bg-[#F1F1EF] cursor-pointer"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
