import { spawn } from "child_process";
import { INTERCEPTOR_SYSTEM_PROMPT } from "./chat-prompts";

/**
 * Chat Agent - Uses Claude Code CLI to power an AI assistant
 * for the Interceptor Toolkit
 */

// Configuration constants
const MAX_HISTORY_MESSAGES = 6;
const CLAUDE_TIMEOUT_MS = 60000;

export interface ChatAction {
  type: "listSessions" | "showSession" | "startCapture" | "runScan" | "generateOpenAPI" | "runMock" | "analyze";
  params?: Record<string, unknown>;
}

export interface ChatResponse {
  message: string;
  action?: ChatAction;
  error?: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Build the full prompt with system instructions and conversation history
 */
function buildPrompt(conversationHistory: ConversationMessage[], userMessage: string): string {
  let prompt = INTERCEPTOR_SYSTEM_PROMPT + "\n\n";

  if (conversationHistory.length > 0) {
    prompt += "## Conversation History\n";
    for (const msg of conversationHistory.slice(-MAX_HISTORY_MESSAGES)) {
      prompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
    }
    prompt += "\n";
  }

  prompt += `## Current Request\nUser: ${userMessage}\n\nRespond with JSON only:`;
  return prompt;
}

/**
 * Extract JSON from Claude's response, handling markdown code blocks
 */
function extractJsonFromResponse(stdout: string): ChatResponse {
  let jsonStr = stdout.trim();

  // Remove markdown code blocks if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Try to find JSON object in response
  const jsonStart = jsonStr.indexOf("{");
  const jsonEnd = jsonStr.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1) {
    jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
  }

  const parsed = JSON.parse(jsonStr);
  return {
    message: parsed.message || "I processed your request.",
    action: parsed.action,
  };
}

/**
 * Check if Claude Code CLI is available (cross-platform)
 */
export async function checkClaudeCodeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    // Use 'claude --version' instead of 'which' for cross-platform compatibility
    const proc = spawn("claude", ["--version"], { stdio: "ignore" });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

/**
 * Send a message to Claude Code CLI and get a structured response
 */
export async function sendChatMessage(
  userMessage: string,
  conversationHistory: ConversationMessage[] = []
): Promise<ChatResponse> {
  const isAvailable = await checkClaudeCodeAvailable();
  if (!isAvailable) {
    return {
      message: "Claude Code CLI is not installed. Please install it with: npm install -g @anthropic-ai/claude-code",
      error: "cli_not_found",
    };
  }

  const prompt = buildPrompt(conversationHistory, userMessage);

  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (response: ChatResponse) => {
      if (resolved) return;
      resolved = true;
      resolve(response);
    };

    const claudeProcess = spawn("claude", ["--print"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    claudeProcess.stdin.write(prompt);
    claudeProcess.stdin.end();

    claudeProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    claudeProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    claudeProcess.on("close", (code) => {
      if (code !== 0) {
        safeResolve({
          message: "Sorry, I encountered an error processing your request.",
          error: stderr || "unknown_error",
        });
        return;
      }

      // Try to parse JSON from response
      try {
        safeResolve(extractJsonFromResponse(stdout));
      } catch {
        // If JSON parsing fails, return the raw response as message
        safeResolve({
          message: stdout.trim() || "I'm not sure how to help with that.",
        });
      }
    });

    claudeProcess.on("error", (err) => {
      safeResolve({
        message: "Failed to communicate with Claude.",
        error: err.message,
      });
    });

    // Timeout after configured duration
    setTimeout(() => {
      if (resolved) return;
      claudeProcess.kill("SIGTERM");
      safeResolve({
        message: "Request timed out. Please try again.",
        error: "timeout",
      });
    }, CLAUDE_TIMEOUT_MS);
  });
}
