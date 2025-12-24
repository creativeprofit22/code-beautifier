# Code Beautifier

Local web app that beautifies/deobfuscates JavaScript using Claude CLI.

## Current Focus
Section: Interceptor Chat Assistant
Files:
- src/lib/chat-agent.ts
- src/app/api/interceptor/chat/route.ts
- src/features/interceptor/components/InterceptorChat.tsx
- src/features/interceptor/components/chat/ChatInput.tsx
- src/features/interceptor/components/chat/MessageBubble.tsx
- src/features/interceptor/components/chat/TypingIndicator.tsx
- src/features/interceptor/components/ScanResults.tsx

## Pipeline State
Phase: refactoring
Feature: Interceptor Chat Assistant
Tier: low
Tier-Status: pending
Reports:
  - bugs: reports/bugs-interceptor-chat.md
  - refactors: reports/refactors-interceptor-chat.md

## Last Session (2025-12-23)
- Completed medium priority refactors (4/4):
  - Extracted `buildPrompt()` helper in chat-agent.ts
  - Extracted `extractJsonFromResponse()` helper in chat-agent.ts
  - Extracted `getSessionId(action)` helper in route.ts
  - Consolidated `SEVERITY_CONFIG` in ScanResults.tsx
- TypeScript verification passing
- Updated refactor report with completed status

## Tech Stack
Next.js 16.1, React 19, TypeScript 5, Tailwind 4, Prisma 7, tRPC 11
