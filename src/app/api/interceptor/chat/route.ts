import { NextRequest, NextResponse } from "next/server";
import { sendChatMessage, ChatAction, ConversationMessage } from "@/lib/chat-agent";
import { runInterceptorCommand, runSecurityScan, generateOpenAPI } from "@/lib/interceptor";

interface ChatRequest {
  message: string;
  history?: ConversationMessage[];
}

/**
 * Extract session ID from action params, defaulting to "latest"
 */
function getSessionId(action: ChatAction): string {
  return (action.params?.sessionId as string) || "latest";
}

/**
 * Execute an action returned by the chat agent
 */
async function executeAction(action: ChatAction): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (action.type) {
      case "listSessions": {
        const result = await runInterceptorCommand(["sessions", "list", "--json"]);
        return { success: result.success, data: result.data, error: result.error };
      }

      case "showSession": {
        const result = await runInterceptorCommand(["sessions", "show", getSessionId(action), "--json"]);
        return { success: result.success, data: result.data, error: result.error };
      }

      case "runScan": {
        const severity = action.params?.severity as string | undefined;
        const result = await runSecurityScan(getSessionId(action), { severity });
        return { success: result.success, data: result.data, error: result.error };
      }

      case "generateOpenAPI": {
        const format = (action.params?.format as "yaml" | "json") || "json";
        const includeExamples = action.params?.includeExamples as boolean | undefined;
        const result = await generateOpenAPI(getSessionId(action), { format, includeExamples });
        return { success: result.success, data: result.data, error: result.error };
      }

      case "analyze": {
        const task = (action.params?.task as string) || "summarize";
        const result = await runInterceptorCommand(["analyze", "--session", getSessionId(action), "--task", task, "--json"]);
        return { success: result.success, data: result.data, error: result.error };
      }

      case "startCapture":
      case "runMock":
        // These run in terminal, so just acknowledge
        return { success: true, data: { note: "Command should be run in terminal" } };

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Action execution failed"
    };
  }
}

/**
 * Format action results for display
 */
function formatActionResult(action: ChatAction, result: { success: boolean; data?: unknown; error?: string }): string {
  if (!result.success) {
    return `\n\n**Error:** ${result.error || "Action failed"}`;
  }

  const data = result.data;
  if (!data) return "";

  switch (action.type) {
    case "listSessions": {
      const sessions = Array.isArray(data) ? data : [];
      if (sessions.length === 0) {
        return "\n\n*No sessions found. Start a capture first with:*\n`interceptor capture --mode passive --port 8080`";
      }
      const list = sessions.map((s: { id?: string; name?: string; request_count?: number; created?: string }) =>
        `- **${s.name || s.id}**: ${s.request_count || 0} requests (${s.created || "unknown date"})`
      ).join("\n");
      return `\n\n${list}`;
    }

    case "showSession": {
      const session = data as { id?: string; name?: string; request_count?: number; endpoints?: string[] };
      return `\n\n**Session:** ${session.name || session.id}\n**Requests:** ${session.request_count || 0}\n**Endpoints:** ${(session.endpoints || []).slice(0, 5).join(", ")}${(session.endpoints?.length || 0) > 5 ? "..." : ""}`;
    }

    case "runScan": {
      const scan = data as { vulnerabilities?: Array<{ severity: string; title: string }> };
      const vulns = scan.vulnerabilities || [];
      if (vulns.length === 0) {
        return "\n\n*No vulnerabilities found.*";
      }
      const list = vulns.slice(0, 5).map((v) => `- [${(v.severity ?? "UNKNOWN").toUpperCase()}] ${v.title ?? "Untitled"}`).join("\n");
      return `\n\n**Found ${vulns.length} vulnerabilities:**\n${list}${vulns.length > 5 ? `\n...and ${vulns.length - 5} more` : ""}`;
    }

    case "generateOpenAPI": {
      return "\n\n*OpenAPI spec generated successfully.*";
    }

    case "analyze": {
      const analysis = data as { summary?: string };
      return analysis.summary ? `\n\n${analysis.summary}` : "";
    }

    default:
      return "";
  }
}

/**
 * POST /api/interceptor/chat
 * Send a message to the AI chat agent
 */
export async function POST(request: NextRequest) {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, history = [] } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    // Get AI response
    const chatResponse = await sendChatMessage(message, history);

    let finalMessage = chatResponse.message;
    let actionResult = null;

    // Execute action if present
    if (chatResponse.action) {
      actionResult = await executeAction(chatResponse.action);
      finalMessage += formatActionResult(chatResponse.action, actionResult);
    }

    return NextResponse.json({
      message: finalMessage,
      action: chatResponse.action,
      actionResult,
      error: chatResponse.error,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat request failed" },
      { status: 500 }
    );
  }
}
