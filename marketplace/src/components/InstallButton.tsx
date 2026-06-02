'use client';

import { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface InstallButtonProps {
  command: string;
  compact?: boolean;
}

export default function InstallButton({ command, compact = false }: InstallButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setShowToast(true);
      setTimeout(() => {
        setCopied(false);
        setShowToast(false);
      }, 2000);
    } catch {
      // fallback for non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = command;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setShowToast(true);
      setTimeout(() => {
        setCopied(false);
        setShowToast(false);
      }, 2000);
    }
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={handleCopy}
          className={`w-full flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg transition-all ${
            copied
              ? 'bg-green-900/50 text-green-400 border border-green-800'
              : 'bg-violet-600 hover:bg-violet-500 text-white'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Terminal className="w-3.5 h-3.5" />
              Install
            </>
          )}
        </button>
        {showToast && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg border border-gray-700 z-50">
            Command copied to clipboard!
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-all ${
          copied
            ? 'bg-green-900/50 text-green-400 border border-green-800'
            : 'bg-violet-600 hover:bg-violet-500 text-white'
        }`}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Command Copied!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy Install Command
          </>
        )}
      </button>
      {showToast && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg border border-gray-700 z-50">
          Copied to clipboard!
        </div>
      )}
    </div>
  );
}
