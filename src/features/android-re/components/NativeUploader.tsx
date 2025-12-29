"use client";

import { useState, useCallback } from "react";
import { Upload, Cpu, X } from "lucide-react";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface NativeUploaderProps {
  onFileSelect: (file: File) => void;
  onClear?: () => void;
  isLoading?: boolean;
  acceptedTypes?: string[];
}

export function NativeUploader({
  onFileSelect,
  onClear,
  isLoading = false,
  acceptedTypes = [".so", ".dll", ".exe", ".dylib", ".o"],
}: NativeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateAndSelectFile = useCallback(
    (file: File) => {
      setError(null);

      if (!isValidFile(file, acceptedTypes)) {
        setError(`Invalid file type. Supported: ${acceptedTypes.join(", ")}`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError(`File too large. Maximum size is 50MB.`);
        return;
      }

      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect, acceptedTypes]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        validateAndSelectFile(file);
      }
    },
    [validateAndSelectFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        validateAndSelectFile(file);
      }
    },
    [validateAndSelectFile]
  );

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    onClear?.();
  }, [onClear]);

  return (
    <div className="w-full">
      {selectedFile ? (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          <Cpu className="h-8 w-8 text-violet-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-100">{selectedFile.name}</p>
            <p className="text-xs text-zinc-500">{formatFileSize(selectedFile.size)}</p>
          </div>
          {!isLoading && (
            <button
              onClick={clearSelection}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="w-full">
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
              isDragging
                ? "border-violet-500 bg-violet-500/10"
                : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-600"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mb-3 h-10 w-10 text-zinc-500" />
            <p className="mb-1 text-sm font-medium text-zinc-300">
              Drop native library here or click to browse
            </p>
            <p className="text-xs text-zinc-500">Supports: {acceptedTypes.join(", ")}</p>
            <input
              type="file"
              className="hidden"
              accept={acceptedTypes.join(",")}
              onChange={handleFileInput}
            />
          </label>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

function isValidFile(file: File, acceptedTypes: string[]): boolean {
  if (!file.name || !file.name.includes(".")) return false;
  const parts = file.name.split(".");
  if (parts.length < 2) return false;
  const extension = "." + parts.pop()!.toLowerCase();
  return acceptedTypes.map((t) => t.toLowerCase()).includes(extension);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
