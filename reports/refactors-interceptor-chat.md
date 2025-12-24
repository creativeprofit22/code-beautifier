# Refactor Report: Interceptor Chat Assistant

Generated: 2025-12-24
Feature: Interceptor Chat Assistant
Source: reports/bugs-interceptor-chat.md

## Scope
Files analyzed:
- src/lib/chat-agent.ts
- src/app/api/interceptor/chat/route.ts
- src/features/interceptor/components/InterceptorChat.tsx
- src/features/interceptor/components/chat/ChatInput.tsx
- src/features/interceptor/components/chat/MessageBubble.tsx
- src/features/interceptor/components/chat/TypingIndicator.tsx
- src/features/interceptor/components/ScanResults.tsx

## High Priority (Tech Debt / DRY)
| # | Location | Issue | Suggested Fix | Effort | Status |
|---|----------|-------|---------------|--------|--------|
| 1 | InterceptorChat.tsx:99-117, ScanResults.tsx:229-252 | DRY violation: File download/export logic duplicated in both components | Extract to shared `downloadAsJson(data, filename)` utility in `src/lib/download.ts` | S | ✅ Done |
| 2 | InterceptorChat.tsx:24-27, chat-agent.ts:19-22 | DRY violation: `ConversationMessage` interface defined in both files | Remove duplicate from InterceptorChat.tsx, import from chat-agent.ts | S | ✅ Done |

## Medium Priority (Code Clarity)
| # | Location | Issue | Suggested Fix | Effort |
|---|----------|-------|---------------|--------|
| 1 | chat-agent.ts:95-203 | `sendChatMessage` is 108 lines with multiple responsibilities (prompt building, process spawning, JSON parsing) | Extract `buildPrompt()`, `parseClaudeResponse()` helpers | M |
| 2 | chat-agent.ts:156-171 | JSON parsing logic is complex with multiple extraction strategies | Extract to `extractJsonFromResponse(stdout: string): object` helper | S |
| 3 | route.ts:16-46 | Repeated pattern: `(action.params?.sessionId as string) \|\| "latest"` appears 5 times | Extract `getSessionId(action)` helper at top of file | S |
| 4 | ScanResults.tsx:43-51, 54-66, 178-183 | Severity config (colors, icons, styles) defined in 3 separate places | Consolidate into single `SEVERITY_CONFIG` object with all properties | S |

## Low Priority (Nice-to-Have)
| # | Location | Issue | Suggested Fix | Effort |
|---|----------|-------|---------------|--------|
| 1 | chat-agent.ts:112, 194 | Magic numbers: `slice(-6)` for history, `60000` for timeout | Extract to named constants: `MAX_HISTORY_MESSAGES = 6`, `CLAUDE_TIMEOUT_MS = 60000` | S |
| 2 | chat-agent.ts:24-78 | 55-line SYSTEM_PROMPT embedded in code | Move to separate file `src/lib/chat-prompts.ts` for easier editing | S |
| 3 | InterceptorChat.tsx:8 | `ACCENT_COLOR` hardcoded, same value passed to multiple components | Move to shared theme constants or use CSS variable | S |

## Summary
- High: 2 refactors (2 Small)
- Medium: 4 refactors (1 Medium, 3 Small)
- Low: 3 refactors (3 Small)
- Total: 9 refactors
