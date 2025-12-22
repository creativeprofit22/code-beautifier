import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

const MAX_CODE_SIZE = 100 * 1024; // 100KB limit
const TIMEOUT_MS = 120 * 1000; // 2 minute timeout

const BEAUTIFY_PROMPT = `You are a JavaScript code beautifier. Your ONLY job is to output beautified code.

RULES:
1. Output ONLY valid JavaScript code - no markdown, no explanations, no questions
2. Rename obfuscated variables (a, b, _0x123) to meaningful names
3. Add brief comments for complex logic
4. Preserve all functionality

CRITICAL: Your response must start with code and contain ONLY code. Never ask questions or add explanations.`;

function stripMarkdownFences(output: string): string {
  // Extract code from markdown fences, even if surrounded by explanatory text
  // Handles cases with or without newline after opening fence
  const fencePattern = /```(?:javascript|js|typescript|ts)?[ \t]*\n?([\s\S]*?)```/;
  const match = output.match(fencePattern);
  return match ? match[1].trim() : output.trim();
}

function runClaudeCommand(prompt: string, input: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", prompt], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = <T>(fn: (value: T) => void, value: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      fn(value);
    };

    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      settle(reject, new Error("Request timed out - code may be too complex"));
    }, timeout);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        settle(resolve, stdout.trim());
      } else {
        settle(reject, new Error(stderr || `Process exited with code ${exitCode}`));
      }
    });

    child.on("error", (err) => {
      settle(reject, err);
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    if (code.length > MAX_CODE_SIZE) {
      return NextResponse.json(
        { error: `Code exceeds maximum size of ${MAX_CODE_SIZE / 1024}KB` },
        { status: 400 }
      );
    }

    const rawResult = await runClaudeCommand(BEAUTIFY_PROMPT, code, TIMEOUT_MS);
    const result = stripMarkdownFences(rawResult);

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Beautify error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to beautify code" },
      { status: 500 }
    );
  }
}
