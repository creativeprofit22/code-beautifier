import { NextRequest, NextResponse } from "next/server";
import { getBeautifyPrompt } from "@/lib/prompts";
import { runClaudeCommand } from "@/lib/claude";
import { processCodeWithSourceMap } from "@/lib/source-map";
import { stripMarkdownFences } from "@/lib/utils";

const MAX_CODE_SIZE = 100 * 1024; // 100KB limit
const TIMEOUT_MS = 120 * 1000; // 2 minute timeout

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    if (code.length > MAX_CODE_SIZE) {
      return NextResponse.json(
        { error: `Code exceeds maximum size of ${MAX_CODE_SIZE / 1024}KB` },
        { status: 400 }
      );
    }

    // Detect and parse inline source map (errors handled internally, never throws)
    const sourceMapResult = processCodeWithSourceMap(code);

    // Build prompt with variable hints if available
    const prompt = getBeautifyPrompt(sourceMapResult.variableHints);

    const rawResult = await runClaudeCommand(prompt, code, TIMEOUT_MS);
    const result = stripMarkdownFences(rawResult);

    return NextResponse.json({
      result,
      sourceMapDetected: sourceMapResult.hasSourceMap,
      originalSources: sourceMapResult.originalSources,
      externalSourceMapUrl: sourceMapResult.externalSourceMapUrl,
    });
  } catch (error) {
    console.error("Beautify error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to beautify code" },
      { status: 500 }
    );
  }
}
