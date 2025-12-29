"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Smartphone, FileCode, Cpu, Terminal } from "lucide-react";
import { TabButton } from "@/components/ui/TabButton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ApkUploader,
  AnalysisProgress,
  AnalysisStage,
  DecompiledViewer,
  NativeUploader,
  NativeAnalysisViewer,
} from "@/features/android-re/components";
import type { FileNode } from "@/lib/android-re";

type Tab = "decompile" | "native" | "strings";

export default function AndroidRePage() {
  const [activeTab, setActiveTab] = useState<Tab>("decompile");
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // Decompilation results
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>();
  const [fileContent, setFileContent] = useState<string | undefined>();
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Native analysis state
  const [nativeFile, setNativeFile] = useState<File | null>(null);
  const [nativeStage, setNativeStage] = useState<AnalysisStage>("idle");
  const [nativeError, setNativeError] = useState<string | undefined>();
  const [nativeAnalysis, setNativeAnalysis] = useState<{
    importedFunctions: number;
    exportedFunctions: number;
    strings: number;
    architecture?: string;
    format?: string;
  } | null>(null);
  const [nativeRawOutput, setNativeRawOutput] = useState<string | undefined>();

  // Abort controllers for cancelling in-flight requests
  const decompileAbortRef = useRef<AbortController | null>(null);
  const nativeAbortRef = useRef<AbortController | null>(null);
  const fileLoadAbortRef = useRef<AbortController | null>(null);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      decompileAbortRef.current?.abort();
      nativeAbortRef.current?.abort();
      fileLoadAbortRef.current?.abort();
    };
  }, []);

  /** Reset decompilation results to initial state */
  const resetDecompileResults = useCallback(() => {
    setAnalysisStage("idle");
    setErrorMessage(undefined);
    setJobId(null);
    setFileTree([]);
    setSelectedFilePath(undefined);
    setFileContent(undefined);
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      setSelectedFile(file);
      resetDecompileResults();
    },
    [resetDecompileResults]
  );

  const handleFileClear = useCallback(() => {
    setSelectedFile(null);
    resetDecompileResults();
  }, [resetDecompileResults]);

  const handleDecompile = useCallback(async () => {
    if (!selectedFile || analysisStage !== "idle") return;

    // Cancel any in-flight request
    decompileAbortRef.current?.abort();
    decompileAbortRef.current = new AbortController();

    try {
      setAnalysisStage("uploading");
      setErrorMessage(undefined);

      // Build form data
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("showBadCode", "true");

      // Upload and decompile
      const response = await fetch("/api/android-re/decompile", {
        method: "POST",
        body: formData,
        signal: decompileAbortRef.current.signal,
      });

      setAnalysisStage("decompiling");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Decompilation failed");
      }

      // Store results
      setJobId(data.jobId);
      setFileTree(data.fileTree || []);
      setAnalysisStage("complete");
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") return;
      setErrorMessage(err instanceof Error ? err.message : "Decompilation failed");
      setAnalysisStage("error");
    }
  }, [selectedFile, analysisStage]);

  const handleTreeFileSelect = useCallback(
    async (path: string) => {
      if (!jobId) return;

      // Cancel any in-flight file load request
      fileLoadAbortRef.current?.abort();
      fileLoadAbortRef.current = new AbortController();

      setSelectedFilePath(path);
      setIsLoadingFile(true);
      setFileContent(undefined);

      try {
        const response = await fetch(
          `/api/android-re/file?jobId=${encodeURIComponent(jobId)}&path=${encodeURIComponent(path)}`,
          { signal: fileLoadAbortRef.current.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load file");
        }

        setFileContent(data.content);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Failed to load file:", err);
        setFileContent(
          `// Error loading file: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      } finally {
        setIsLoadingFile(false);
      }
    },
    [jobId]
  );

  const isProcessing =
    analysisStage !== "idle" && analysisStage !== "complete" && analysisStage !== "error";

  // Native analysis handlers
  const resetNativeResults = useCallback(() => {
    setNativeStage("idle");
    setNativeError(undefined);
    setNativeAnalysis(null);
    setNativeRawOutput(undefined);
  }, []);

  const handleNativeFileSelect = useCallback(
    (file: File) => {
      setNativeFile(file);
      resetNativeResults();
    },
    [resetNativeResults]
  );

  const handleNativeFileClear = useCallback(() => {
    setNativeFile(null);
    resetNativeResults();
  }, [resetNativeResults]);

  const handleNativeAnalyze = useCallback(async () => {
    if (!nativeFile || nativeStage !== "idle") return;

    // Cancel any in-flight request
    nativeAbortRef.current?.abort();
    nativeAbortRef.current = new AbortController();

    try {
      setNativeStage("uploading");
      setNativeError(undefined);

      const formData = new FormData();
      formData.append("file", nativeFile);

      const response = await fetch("/api/android-re/analyze", {
        method: "POST",
        body: formData,
        signal: nativeAbortRef.current.signal,
      });

      setNativeStage("analyzing");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setNativeAnalysis(data.analysis);
      setNativeRawOutput(data.rawOutput);
      setNativeStage("complete");
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") return;
      setNativeError(err instanceof Error ? err.message : "Analysis failed");
      setNativeStage("error");
    }
  }, [nativeFile, nativeStage]);

  const isNativeProcessing =
    nativeStage !== "idle" && nativeStage !== "complete" && nativeStage !== "error";

  const renderDecompileTab = () => (
    <div className="flex flex-col gap-6">
      <ApkUploader
        onFileSelect={handleFileSelect}
        onClear={handleFileClear}
        isLoading={isProcessing}
      />

      {selectedFile && analysisStage === "idle" && (
        <button
          onClick={handleDecompile}
          className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:bg-violet-500"
        >
          <FileCode className="h-4 w-4" />
          <span>Decompile with JADX</span>
        </button>
      )}

      {analysisStage !== "idle" && (
        <AnalysisProgress
          stage={analysisStage}
          message={
            analysisStage === "uploading"
              ? "Preparing file..."
              : analysisStage === "decompiling"
                ? "Extracting Java source code..."
                : undefined
          }
          error={errorMessage}
        />
      )}

      {analysisStage === "complete" && (
        <DecompiledViewer
          files={fileTree}
          onFileSelect={handleTreeFileSelect}
          selectedFile={selectedFilePath}
          fileContent={isLoadingFile ? "// Loading..." : fileContent}
        />
      )}

      {!selectedFile && (
        <EmptyState
          icon={FileCode}
          title="Ready to decompile"
          description="Upload an APK, DEX, or AAR file to decompile it to Java source code using JADX."
        />
      )}
    </div>
  );

  const renderNativeTab = () => (
    <div className="flex flex-col gap-6">
      <NativeUploader
        onFileSelect={handleNativeFileSelect}
        onClear={handleNativeFileClear}
        isLoading={isNativeProcessing}
      />

      {nativeFile && nativeStage === "idle" && (
        <button
          onClick={handleNativeAnalyze}
          className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:bg-violet-500"
        >
          <Cpu className="h-4 w-4" />
          <span>Analyze with Ghidra</span>
        </button>
      )}

      {nativeStage !== "idle" && (
        <AnalysisProgress
          stage={nativeStage}
          message={
            nativeStage === "uploading"
              ? "Uploading native library..."
              : nativeStage === "analyzing"
                ? "Analyzing with Ghidra headless..."
                : undefined
          }
          error={nativeError}
        />
      )}

      {nativeStage === "complete" && nativeAnalysis && (
        <NativeAnalysisViewer
          analysis={nativeAnalysis}
          rawOutput={nativeRawOutput}
          fileName={nativeFile?.name}
        />
      )}

      {!nativeFile && (
        <EmptyState
          icon={Cpu}
          title="Ready to analyze"
          description="Upload a native library (.so, .dll, .exe, .dylib, .o) to analyze it with Ghidra headless."
        />
      )}
    </div>
  );

  const renderStringsTab = () => (
    <div className="flex flex-col gap-6">
      <EmptyState
        icon={Terminal}
        title="String Extraction"
        description="Extract and analyze strings from APK resources, DEX files, and native libraries."
      />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 font-sans text-zinc-100">
      <main className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full max-w-7xl flex-1">
          {/* Page Header */}
          <div className="mb-8">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2">
                <Smartphone className="h-6 w-6 text-violet-400" />
              </div>
              <h1 className="text-2xl font-bold text-zinc-100">Android RE</h1>
            </div>
            <p className="max-w-2xl text-zinc-500">
              Reverse engineer Android applications. Decompile APKs with JADX and analyze native
              libraries with Ghidra.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
              <Terminal className="h-4 w-4 text-zinc-500" />
              <code className="text-xs text-zinc-400">
                Tools: <span className="text-violet-400">JADX</span> (Java decompiler) +{" "}
                <span className="text-amber-400">Ghidra</span> (native analysis)
              </code>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6 flex gap-2">
            <TabButton
              label="Decompile"
              icon={FileCode}
              isActive={activeTab === "decompile"}
              onClick={() => setActiveTab("decompile")}
            />
            <TabButton
              label="Native Analysis"
              icon={Cpu}
              isActive={activeTab === "native"}
              onClick={() => setActiveTab("native")}
            />
            <TabButton
              label="Strings"
              icon={Terminal}
              isActive={activeTab === "strings"}
              onClick={() => setActiveTab("strings")}
            />
          </div>

          {/* Tab Content */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            {activeTab === "decompile" && renderDecompileTab()}
            {activeTab === "native" && renderNativeTab()}
            {activeTab === "strings" && renderStringsTab()}
          </div>
        </div>
      </main>
    </div>
  );
}
