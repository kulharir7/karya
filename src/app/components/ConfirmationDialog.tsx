"use client";

import { useEffect, useRef } from "react";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: string;
  toolName: string;
  args?: any;
  onConfirm: () => void;
  onDeny: () => void;
}

export default function ConfirmationDialog({
  open,
  title,
  message,
  toolName,
  args,
  onConfirm,
  onDeny,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap and escape key
  useEffect(() => {
    if (!open) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDeny();
    };
    
    document.addEventListener("keydown", handleEscape);
    dialogRef.current?.focus();
    
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onDeny]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDeny}
      />
      
      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-red-50 border-b border-red-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-red-600 font-medium">⚠️ Dangerous Operation</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-gray-700 mb-4">{message}</p>
          
          {/* Tool details */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Tool</div>
            <div className="font-mono text-sm text-gray-800 mb-3">{toolName}</div>
            
            {args && Object.keys(args).length > 0 && (
              <>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Arguments</div>
                <pre className="text-xs text-gray-600 bg-white rounded p-2 border overflow-x-auto max-h-32">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onDeny}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Allow Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
