"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Search, Copy, FileText, Terminal, Cpu, Check } from "lucide-react";

type StringCategory = "all" | "resources" | "dex" | "native";

interface StringsExtractorProps {
  strings: {
    resources: string[];
    dex: string[];
    native: string[];
  };
  stats: {
    total: number;
    resourceCount: number;
    dexCount: number;
    nativeCount: number;
  };
  fileName?: string;
}

interface CategoryTab {
  id: StringCategory;
  label: string;
  icon: React.ReactNode;
  count: number;
}

export function StringsExtractor({ strings, stats, fileName }: StringsExtractorProps) {
  const [category, setCategory] = useState<StringCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Refs to track timeouts for cleanup on unmount
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyAllTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (copyAllTimeoutRef.current) clearTimeout(copyAllTimeoutRef.current);
    };
  }, []);

  // Handle category change - clears copied indicator to prevent index collision
  // (index 5 in "dex" is different from index 5 in "native")
  const handleCategoryChange = useCallback((newCategory: StringCategory) => {
    setCategory(newCategory);
    setCopiedIndex(null);
  }, []);

  const categories: CategoryTab[] = useMemo(
    () => [
      { id: "all", label: "All", icon: <FileText className="h-4 w-4" />, count: stats.total },
      {
        id: "resources",
        label: "Resources",
        icon: <FileText className="h-4 w-4" />,
        count: stats.resourceCount,
      },
      { id: "dex", label: "DEX", icon: <Terminal className="h-4 w-4" />, count: stats.dexCount },
      {
        id: "native",
        label: "Native",
        icon: <Cpu className="h-4 w-4" />,
        count: stats.nativeCount,
      },
    ],
    [stats]
  );

  // Get strings for current category
  const categoryStrings = useMemo(() => {
    switch (category) {
      case "resources":
        return strings.resources;
      case "dex":
        return strings.dex;
      case "native":
        return strings.native;
      case "all":
      default:
        return [...strings.resources, ...strings.dex, ...strings.native];
    }
  }, [category, strings]);

  // Filter by search query
  const filteredStrings = useMemo(() => {
    if (!searchQuery.trim()) return categoryStrings;
    const query = searchQuery.toLowerCase();
    return categoryStrings.filter((s) => s.toLowerCase().includes(query));
  }, [categoryStrings, searchQuery]);

  const handleCopyString = useCallback(async (str: string, index: number) => {
    try {
      await navigator.clipboard.writeText(str);
      setCopiedIndex(index);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedIndex(null), 1500);
    } catch (err) {
      console.error("Failed to copy string:", err);
    }
  }, []);

  const handleCopyAll = useCallback(async () => {
    try {
      const text = filteredStrings.join("\n");
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      if (copyAllTimeoutRef.current) clearTimeout(copyAllTimeoutRef.current);
      copyAllTimeoutRef.current = setTimeout(() => setCopiedAll(false), 1500);
    } catch (err) {
      console.error("Failed to copy strings:", err);
    }
  }, [filteredStrings]);

  return (
    <div className="flex flex-col gap-4">
      {/* Stats Header */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-violet-400" />
            <div>
              <h3 className="text-lg font-medium text-zinc-100">
                {fileName ? `Strings from ${fileName}` : "Extracted Strings"}
              </h3>
              <p className="text-sm text-zinc-500">
                {stats.total.toLocaleString()} total strings extracted
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-400">
              <span className="font-medium text-zinc-100">
                {stats.resourceCount.toLocaleString()}
              </span>{" "}
              resources
            </span>
            <span className="text-zinc-400">
              <span className="font-medium text-zinc-100">{stats.dexCount.toLocaleString()}</span>{" "}
              DEX
            </span>
            <span className="text-zinc-400">
              <span className="font-medium text-zinc-100">
                {stats.nativeCount.toLocaleString()}
              </span>{" "}
              native
            </span>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2" role="tablist" aria-label="String categories">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={category === cat.id}
            aria-controls="strings-panel"
            onClick={() => handleCategoryChange(cat.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              category === cat.id
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                category === cat.id ? "bg-violet-500 text-white" : "bg-zinc-700 text-zinc-400"
              }`}
            >
              {cat.count.toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {/* Search Input & Copy All */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <input
            type="text"
            id="strings-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search strings..."
            aria-label="Search extracted strings"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2 pr-4 pl-10 text-sm text-zinc-100 placeholder-zinc-500 transition-colors focus:border-violet-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={handleCopyAll}
          disabled={filteredStrings.length === 0}
          aria-label={
            copiedAll
              ? "Copied to clipboard"
              : `Copy all ${filteredStrings.length} strings to clipboard`
          }
          className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copiedAll ? (
            <Check className="h-4 w-4 text-green-400" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          <span>
            {copiedAll ? "Copied!" : `Copy All (${filteredStrings.length.toLocaleString()})`}
          </span>
        </button>
      </div>

      {/* String List */}
      <div
        id="strings-panel"
        role="tabpanel"
        aria-label={`${category === "all" ? "All" : category} strings`}
        className="rounded-lg border border-zinc-800 bg-zinc-900/50"
      >
        {filteredStrings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="mb-3 h-8 w-8 text-zinc-600" aria-hidden="true" />
            <p className="text-sm text-zinc-400">No strings found</p>
            {searchQuery && (
              <p className="mt-1 text-xs text-zinc-500">Try a different search term or category</p>
            )}
          </div>
        ) : (
          <div className="max-h-[500px] divide-y divide-zinc-800 overflow-y-auto">
            {filteredStrings.map((str, index) => (
              <div
                key={`${category}-${index}-${str.slice(0, 50)}`}
                className="group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-zinc-800/50"
              >
                <span
                  className="min-w-[3rem] text-right font-mono text-xs text-zinc-600"
                  aria-hidden="true"
                >
                  {(index + 1).toLocaleString()}
                </span>
                <span
                  className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-300"
                  title={str}
                >
                  {str}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyString(str, index)}
                  aria-label={
                    copiedIndex === index
                      ? "Copied"
                      : `Copy string: ${str.slice(0, 50)}${str.length > 50 ? "..." : ""}`
                  }
                  className="flex-shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 focus:opacity-100"
                >
                  {copiedIndex === index ? (
                    <Check className="h-4 w-4 text-green-400" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results Count Footer */}
      {filteredStrings.length > 0 && (
        <p className="text-xs text-zinc-500">
          Showing {filteredStrings.length.toLocaleString()} of{" "}
          {categoryStrings.length.toLocaleString()} strings
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      )}
    </div>
  );
}
