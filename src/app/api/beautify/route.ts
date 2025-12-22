import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

const MAX_CODE_SIZE = 100 * 1024; // 100KB limit
const TIMEOUT_MS = 120 * 1000; // 2 minute timeout

const BEAUTIFY_PROMPT = `Beautify this JavaScript code. Rename obfuscated variables (like a, b, c, _0x123) to meaningful names based on their usage context. Add brief explanatory comments for complex logic. Return ONLY the beautified code, no explanations or markdown.`;

function runClaudeCommand(prompt: string, input: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", prompt], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timeoutId = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      reject(new Error("Request timed out - code may be too complex"));
    }, timeout);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeoutId);
      if (killed) return;
      if (exitCode === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Process exited with code ${exitCode}`));
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
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

    const result = await runClaudeCommand(BEAUTIFY_PROMPT, code, TIMEOUT_MS);

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Beautify error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to beautify code" },
      { status: 500 }
    );
  }
}
