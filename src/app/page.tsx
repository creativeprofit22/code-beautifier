"use client";

import { useState, ReactNode } from "react";
import { Copy, Check, Sparkles, Loader2, X } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";

const COPY_FEEDBACK_DURATION_MS = 2000;
const PANEL_HEIGHT = "h-[calc(100vh-220px)]";

interface CodePanelProps {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
}

function CodePanel({ title, headerRight, children }: CodePanelProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <span className="text-sm font-medium text-zinc-400">{title}</span>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

export default function Home() {
  const [inputCode, setInputCode] = useState("");
  const [outputCode, setOutputCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleBeautify = async () => {
    if (!inputCode.trim()) {
      setError("Please enter some code to beautify");
      return;
    }

    setIsLoading(true);
    setError(null);
    setOutputCode("");

    try {
      const response = await fetch("/api/beautify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: inputCode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to beautify code");
      }

      const data = await response.json();
      setOutputCode(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!outputCode) return;

    if (!navigator.clipboard) {
      setError("Clipboard not available (requires HTTPS or localhost)");
      return;
    }

    try {
      await navigator.clipboard.writeText(outputCode);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
    } catch {
      setError("Failed to copy to clipboard");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 font-sans text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Sparkles className="h-6 w-6 text-violet-500" />
          <h1 className="text-2xl font-bold tracking-tight">Code Beautifier</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col gap-4 p-6">
        <div className="mx-auto w-full max-w-7xl flex-1">
          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-red-400">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-4 rounded p-1 transition-colors hover:bg-red-500/20"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Code Panels */}
          <div className={`grid ${PANEL_HEIGHT} grid-cols-1 gap-4 lg:grid-cols-2`}>
            {/* Input Panel */}
            <CodePanel
              title="Input"
              headerRight={
                <span className="text-xs text-zinc-500">
                  Paste minified or obfuscated JavaScript
                </span>
              }
            >
              <textarea
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="// Paste your minified JavaScript here...&#10;var a=function(b){return b*2};"
                className="flex-1 resize-none bg-transparent p-4 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
                spellCheck={false}
              />
            </CodePanel>

            {/* Output Panel */}
            <CodePanel
              title="Output"
              headerRight={
                <button
                  onClick={handleCopy}
                  disabled={!outputCode}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-green-500">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              }
            >
              <div className="relative flex-1 overflow-auto">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-zinc-500">
                      <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                      <span className="text-sm">Beautifying code...</span>
                    </div>
                  </div>
                ) : outputCode ? (
                  <Highlight theme={themes.nightOwl} code={outputCode} language="javascript">
                    {({ style, tokens, getLineProps, getTokenProps }) => (
                      <pre
                        className="h-full overflow-auto p-4 font-mono text-sm"
                        style={{ ...style, background: "transparent" }}
                      >
                        {tokens.map((line, i) => (
                          <div key={i} {...getLineProps({ line })}>
                            <span className="mr-4 inline-block w-8 text-right text-zinc-600 select-none">
                              {i + 1}
                            </span>
                            {line.map((token, key) => (
                              <span key={key} {...getTokenProps({ token })} />
                            ))}
                          </div>
                        ))}
                      </pre>
                    )}
                  </Highlight>
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-600">
                    <span className="text-sm">Beautified code will appear here</span>
                  </div>
                )}
              </div>
            </CodePanel>
          </div>

          {/* Beautify Button */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleBeautify}
              disabled={isLoading || !inputCode.trim()}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-violet-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Beautifying...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>Beautify</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
