"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Smartphone, FileCode, Cpu, Terminal, Package } from "lucide-react";
import { TabButton } from "@/components/ui/TabButton";
import {
  ApkUploader,
  AnalysisTab,
  AnalysisStage,
  DecompiledViewer,
  NativeUploader,
  NativeAnalysisViewer,
  StringsExtractor,
  ManifestViewer,
} from "@/features/android-re/components";
import { useTabAnalysis } from "@/features/android-re/hooks";
import type { FileNode } from "@/lib/android-re";

type Tab = "decompile" | "native" | "strings" | "manifest";

// Result types for useTabAnalysis
interface NativeResult {
  analysis: {
    importedFunctions: number;
    exportedFunctions: number;
    strings: number;
    architecture?: string;
    format?: string;
  };
  rawOutput?: string;
}

interface StringsResult {
  strings: { resources: string[]; dex: string[]; native: string[] };
  stats: { total: number; resourceCount: number; dexCount: number; nativeCount: number };
}

interface ManifestResult {
  manifest: {
    package: string;
    versionCode: string;
    versionName: string;
    minSdk: string;
    targetSdk: string;
    permissions: Array<{ name: string; protectionLevel?: string }>;
    activities: Array<{
      name: string;
      exported: boolean;
      intentFilters: Array<{ action?: string; category?: string; data?: string }>;
      permission?: string;
    }>;
    services: Array<{ name: string; exported: boolean; permission?: string }>;
    receivers: Array<{
      name: string;
      exported: boolean;
      intentFilters: Array<{ action?: string }>;
    }>;
    providers: Array<{
      name: string;
      exported: boolean;
      authorities?: string;
      permission?: string;
    }>;
    securityIssues: Array<{
      severity: "high" | "medium" | "low";
      issue: string;
      component?: string;
    }>;
    debuggable: boolean;
    allowBackup: boolean;
  };
  stats: {
    permissionCount: number;
    activityCount: number;
    serviceCount: number;
    receiverCount: number;
    providerCount: number;
    securityIssueCount: number;
  };
}

export default function AndroidRePage() {
  const [activeTab, setActiveTab] = useState<Tab>("decompile");

  // === Decompile Tab State (kept separate due to file tree complexity) ===
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>();
  const [fileContent, setFileContent] = useState<string | undefined>();
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const decompileAbortRef = useRef<AbortController | null>(null);
  const fileLoadAbortRef = useRef<AbortController | null>(null);

  // === Native Tab - Uses useTabAnalysis hook ===
  const nativeExtractResult = useCallback(
    (data: Record<string, unknown>): NativeResult => ({
      analysis: data.analysis as NativeResult["analysis"],
      rawOutput: data.rawOutput as string | undefined,
    }),
    []
  );

  const native = useTabAnalysis<NativeResult>({
    endpoint: "/api/android-re/analyze",
    extractResult: nativeExtractResult,
  });

  // === Strings Tab - Uses useTabAnalysis hook ===
  const stringsExtractResult = useCallback(
    (data: Record<string, unknown>): StringsResult => ({
      strings: data.strings as StringsResult["strings"],
      stats: data.stats as StringsResult["stats"],
    }),
    []
  );

  const strings = useTabAnalysis<StringsResult>({
    endpoint: "/api/android-re/strings",
    extractResult: stringsExtractResult,
  });

  // === Manifest Tab - Uses useTabAnalysis hook ===
  const manifestExtractResult = useCallback(
    (data: Record<string, unknown>): ManifestResult => ({
      manifest: data.manifest as ManifestResult["manifest"],
      stats: data.stats as ManifestResult["stats"],
    }),
    []
  );

  const manifest = useTabAnalysis<ManifestResult>({
    endpoint: "/api/android-re/manifest",
    extractResult: manifestExtractResult,
  });

  // Cleanup decompile abort controllers on unmount
  useEffect(() => {
    return () => {
      decompileAbortRef.current?.abort();
      fileLoadAbortRef.current?.abort();
    };
  }, []);

  // === Decompile Tab Handlers ===
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

    decompileAbortRef.current?.abort();
    decompileAbortRef.current = new AbortController();

    try {
      setAnalysisStage("uploading");
      setErrorMessage(undefined);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("showBadCode", "true");

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

      setJobId(data.jobId);
      setFileTree(data.fileTree || []);
      setAnalysisStage("complete");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setErrorMessage(err instanceof Error ? err.message : "Decompilation failed");
      setAnalysisStage("error");
    }
  }, [selectedFile, analysisStage]);

  const handleTreeFileSelect = useCallback(
    async (path: string) => {
      if (!jobId) return;

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

  // === Progress Messages ===
  const decompileProgressMessage = useMemo(() => {
    if (analysisStage === "uploading") return "Preparing file...";
    if (analysisStage === "decompiling") return "Extracting Java source code...";
    return undefined;
  }, [analysisStage]);

  const nativeProgressMessage = useMemo(() => {
    if (native.stage === "uploading") return "Uploading native library...";
    if (native.stage === "analyzing") return "Analyzing with Ghidra headless...";
    return undefined;
  }, [native.stage]);

  const stringsProgressMessage = useMemo(() => {
    if (strings.stage === "uploading") return "Uploading file...";
    if (strings.stage === "analyzing") return "Extracting strings...";
    return undefined;
  }, [strings.stage]);

  const manifestProgressMessage = useMemo(() => {
    if (manifest.stage === "uploading") return "Uploading APK...";
    if (manifest.stage === "analyzing") return "Parsing AndroidManifest.xml...";
    return undefined;
  }, [manifest.stage]);

  // === Render Tabs ===
  const renderDecompileTab = () => (
    <AnalysisTab
      uploader={
        <ApkUploader
          onFileSelect={handleFileSelect}
          onClear={handleFileClear}
          isLoading={isProcessing}
        />
      }
      actionButton={{
        label: "Decompile with JADX",
        icon: FileCode,
        onClick: handleDecompile,
      }}
      stage={analysisStage}
      progressMessage={decompileProgressMessage}
      error={errorMessage}
      resultViewer={
        <DecompiledViewer
          files={fileTree}
          onFileSelect={handleTreeFileSelect}
          selectedFile={selectedFilePath}
          fileContent={isLoadingFile ? "// Loading..." : fileContent}
        />
      }
      emptyState={{
        icon: FileCode,
        title: "Ready to decompile",
        description:
          "Upload an APK, DEX, or AAR file to decompile it to Java source code using JADX.",
      }}
      hasFile={!!selectedFile}
      hasResult={fileTree.length > 0}
    />
  );

  const renderNativeTab = () => (
    <AnalysisTab
      uploader={
        <NativeUploader
          onFileSelect={native.handleFileSelect}
          onClear={native.handleFileClear}
          isLoading={native.isProcessing}
        />
      }
      actionButton={{
        label: "Analyze with Ghidra",
        icon: Cpu,
        onClick: native.handleAnalyze,
      }}
      stage={native.stage}
      progressMessage={nativeProgressMessage}
      error={native.error}
      resultViewer={
        native.result && (
          <NativeAnalysisViewer
            analysis={native.result.analysis}
            rawOutput={native.result.rawOutput}
            fileName={native.file?.name}
          />
        )
      }
      emptyState={{
        icon: Cpu,
        title: "Ready to analyze",
        description:
          "Upload a native library (.so, .dll, .exe, .dylib, .o) to analyze it with Ghidra headless.",
      }}
      hasFile={!!native.file}
      hasResult={!!native.result}
    />
  );

  const renderStringsTab = () => (
    <AnalysisTab
      uploader={
        <NativeUploader
          onFileSelect={strings.handleFileSelect}
          onClear={strings.handleFileClear}
          isLoading={strings.isProcessing}
          acceptedTypes={[".apk", ".dex", ".so", ".dll", ".exe", ".dylib", ".aar"]}
        />
      }
      actionButton={{
        label: "Extract Strings",
        icon: Terminal,
        onClick: strings.handleAnalyze,
      }}
      stage={strings.stage}
      progressMessage={stringsProgressMessage}
      error={strings.error}
      resultViewer={
        strings.result && (
          <StringsExtractor
            strings={strings.result.strings}
            stats={strings.result.stats}
            fileName={strings.file?.name}
          />
        )
      }
      emptyState={{
        icon: Terminal,
        title: "String Extraction",
        description:
          "Extract and analyze strings from APK resources, DEX files, and native libraries.",
      }}
      hasFile={!!strings.file}
      hasResult={!!strings.result}
    />
  );

  const renderManifestTab = () => (
    <AnalysisTab
      uploader={
        <ApkUploader
          onFileSelect={manifest.handleFileSelect}
          onClear={manifest.handleFileClear}
          isLoading={manifest.isProcessing}
        />
      }
      actionButton={{
        label: "Parse Manifest",
        icon: Package,
        onClick: manifest.handleAnalyze,
      }}
      stage={manifest.stage}
      progressMessage={manifestProgressMessage}
      error={manifest.error}
      resultViewer={
        manifest.result && (
          <ManifestViewer
            manifest={manifest.result.manifest}
            stats={manifest.result.stats}
            fileName={manifest.file?.name}
          />
        )
      }
      emptyState={{
        icon: Package,
        title: "Manifest Parser",
        description:
          "Parse AndroidManifest.xml to view permissions, components, and security analysis.",
      }}
      hasFile={!!manifest.file}
      hasResult={!!manifest.result}
    />
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
            <TabButton
              label="Manifest"
              icon={Package}
              isActive={activeTab === "manifest"}
              onClick={() => setActiveTab("manifest")}
            />
          </div>

          {/* Tab Content */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            {activeTab === "decompile" && renderDecompileTab()}
            {activeTab === "native" && renderNativeTab()}
            {activeTab === "strings" && renderStringsTab()}
            {activeTab === "manifest" && renderManifestTab()}
          </div>
        </div>
      </main>
    </div>
  );
}
