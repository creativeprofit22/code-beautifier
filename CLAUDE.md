# Code Beautifier

Local web app that beautifies/deobfuscates JavaScript using Claude CLI.

## Current Focus
Feature: Interceptor Module - Phase 1 Implementation

## Pipeline State
Phase: build
Feature: Interceptor Module
Tier: Phase 1 - Core Infrastructure
Tier-Status: pending
Reports:
  - bugs: reports/bugs-code-beautifier-mvp.md
  - refactors: reports/refactors-code-beautifier-mvp.md

## Last Session (2025-12-22)
Designed Interceptor Module - Claude-powered network intelligence system:
- Researched Postman Labs (Newman, SDK, Generators) and mitmproxy
- Designed 4-phase architecture: Core -> Intelligence -> Generators -> UI
- Made repo private via gh CLI
- Discussed operational security - NO traces in builds/servers

## CRITICAL: No Traces Policy
The interceptor must leave NO traces in production builds or deployed servers:

1. **Gitignore these** (add to .gitignore):
   - `captures/` - all intercepted traffic
   - `*.jsonl` - traffic logs
   - `mitmproxy-data/` - certs and config
   - `scripts/*.log`

2. **Keep captures local** - never commit captured data

3. **Dev-only or separate tool** - either:
   - Use `NODE_ENV === 'development'` guards, OR
   - Keep as standalone tool outside main app

4. **Project-local mitmproxy config**:
   ```bash
   MITMPROXY_HOME=./mitmproxy-data mitmdump -s scripts/interceptor.py
   ```

## Next Steps
1. Update .gitignore with interceptor exclusions
2. Phase 1: Create `scripts/interceptor.py` (mitmproxy addon)
3. Phase 1: Create `src/lib/interceptor/types.ts` and `storage.ts`
4. Phase 1: Create `/api/intercept/ingest` and `/api/intercept/sessions` routes
5. Test: mitmproxy -> Next.js API -> captures/ storage

## Interceptor Module Plan

### Architecture
```
mitmproxy addon -> /api/intercept/ingest -> captures/sessions/ -> Claude -> artifacts/
```

### Phase 1 Files (Core Infrastructure)
- `scripts/interceptor.py` - mitmproxy addon
- `src/lib/interceptor/types.ts` - TypeScript types
- `src/lib/interceptor/storage.ts` - Session management
- `src/app/api/intercept/ingest/route.ts` - Traffic ingestion
- `src/app/api/intercept/sessions/route.ts` - Session CRUD

### Phase 2 Files (Intelligence)
- `src/lib/interceptor/prompts.ts` - Claude prompts
- `src/lib/interceptor/schema-inference.ts` - OpenAPI inference
- `src/app/api/intercept/analyze/route.ts` - Analysis trigger

### Phase 3 Files (Generators)
- `src/lib/interceptor/generators/*.ts` - OpenAPI, SDK, tests

### Phase 4 Files (UI)
- `src/app/intercept/page.tsx` - Main UI
- `src/components/ui/TrafficList.tsx`, `SessionPanel.tsx`

### Storage Format
```
captures/sessions/{id}/manifest.json, traffic.jsonl, insights/
```

### Quick Start (after Phase 1)
```bash
npm run dev
MITMPROXY_HOME=./mitmproxy-data mitmdump -s scripts/interceptor.py --set api_url=http://localhost:3000/api/intercept/ingest
```

## Tech Stack
Next.js 16.1, React 19, TypeScript 5, Tailwind 4, Prisma 7, tRPC 11
