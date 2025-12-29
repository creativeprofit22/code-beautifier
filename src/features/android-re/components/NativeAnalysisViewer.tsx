"use client";

import { useState, useMemo, memo } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Type,
  Cpu,
  FileType,
  ChevronDown,
  ChevronRight,
  Terminal,
} from "lucide-react";

interface NativeAnalysis {
  importedFunctions: number;
  exportedFunctions: number;
  strings: number;
  architecture?: string;
  format?: string;
}

interface NativeAnalysisViewerProps {
  analysis: NativeAnalysis;
  rawOutput?: string;
  fileName?: string;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
}

const StatCard = memo(function StatCard({ icon, label, value, accent = false }: StatCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-3">
        <div className={accent ? "text-violet-400" : "text-zinc-500"}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="truncate font-mono text-lg font-medium text-zinc-100">{value}</p>
        </div>
      </div>
    </div>
  );
});

export function NativeAnalysisViewer({ analysis, rawOutput, fileName }: NativeAnalysisViewerProps) {
  const [isRawExpanded, setIsRawExpanded] = useState(false);

  // Memoize line count to avoid recalculating on every render
  const lineCount = useMemo(() => {
    if (!rawOutput || !rawOutput.trim()) return 0;
    return rawOutput.split("\n").length;
  }, [rawOutput]);

  return (
    <div className="space-y-6">
      {/* Header */}
      {fileName && (
        <div className="flex items-center gap-2">
          <FileType className="h-5 w-5 text-violet-400" />
          <h3 className="text-lg font-medium text-zinc-100">{fileName}</h3>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          icon={<ArrowDownToLine className="h-5 w-5" />}
          label="Imported Functions"
          value={analysis.importedFunctions.toLocaleString()}
          accent
        />
        <StatCard
          icon={<ArrowUpFromLine className="h-5 w-5" />}
          label="Exported Functions"
          value={analysis.exportedFunctions.toLocaleString()}
          accent
        />
        <StatCard
          icon={<Type className="h-5 w-5" />}
          label="Strings"
          value={analysis.strings.toLocaleString()}
          accent
        />
        <StatCard
          icon={<Cpu className="h-5 w-5" />}
          label="Architecture"
          value={analysis.architecture || "Unknown"}
        />
        <StatCard
          icon={<FileType className="h-5 w-5" />}
          label="Format"
          value={analysis.format || "Unknown"}
        />
      </div>

      {/* Raw Output Section */}
      {rawOutput && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
          <button
            type="button"
            onClick={() => setIsRawExpanded(!isRawExpanded)}
            aria-expanded={isRawExpanded}
            aria-controls="raw-output-section"
            className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-zinc-800/50"
          >
            {isRawExpanded ? (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            )}
            <Terminal className="h-4 w-4 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-300">Raw Output</span>
            <span className="ml-auto text-xs text-zinc-600">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </span>
          </button>

          {isRawExpanded && (
            <div id="raw-output-section" className="border-t border-zinc-800">
              <pre className="max-h-96 overflow-auto p-4 text-xs text-zinc-400">
                <code>{rawOutput}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
