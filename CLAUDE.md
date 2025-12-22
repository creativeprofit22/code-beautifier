# Code Beautifier

Local web app that beautifies/deobfuscates JavaScript using Claude CLI.

## Current Focus
Feature: Source Maps
Files: src/lib/source-map.ts, src/lib/prompts.ts, src/app/api/beautify/route.ts, src/app/page.tsx

## Pipeline State
Phase: refactoring
Feature: Source Maps
Tier: medium
Tier-Status: pending
Reports:
  - bugs: reports/bugs-source-maps.md
  - refactors: reports/refactors-source-maps.md

## Last Session (2025-12-22)
- Completed 2 high priority refactors:
  1. Extended `apiCall` to support full response objects (`resultField: string | null`)
  2. Refactored `handleBeautify` to use `apiCall` helper (page.tsx:354-394)
  3. Replaced Map→Object loop with `Object.fromEntries()` (source-map.ts:99)
- Build and type check pass
