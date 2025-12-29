# Refactor Hunt Report: Native Analysis UI

**Feature:** Native Analysis UI
**Files Analyzed:**
- `src/features/android-re/components/NativeUploader.tsx` (156 lines)
- `src/features/android-re/components/NativeAnalysisViewer.tsx` (135 lines)
- `src/app/android-re/page.tsx` (377 lines)

---

## HIGH Priority

### 1. Race Condition Bugs - Missing AbortController (3 locations)

**Files:** `page.tsx:68-102`, `page.tsx:174-204`, `page.tsx:104-148`

All three async operations lack proper cancellation handling:

| Location | Function | Issue |
|----------|----------|-------|
| line 68 | `handleDecompile` | No AbortController - request continues if component unmounts or user cancels |
| line 174 | `handleNativeAnalyze` | No AbortController - same issue |
| line 104 | `handleTreeFileSelect` | Partial fix (checks `requestedPath`) but fetch still runs to completion |

**Fix:** Add AbortController pattern with cleanup via useRef + useEffect:
```tsx
const abortRef = useRef<AbortController | null>(null);

const handleDecompile = useCallback(async () => {
  abortRef.current?.abort();
  abortRef.current = new AbortController();

  try {
    const response = await fetch(url, { signal: abortRef.current.signal });
    // ...
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    // handle real errors
  }
}, [deps]);

useEffect(() => () => abortRef.current?.abort(), []); // cleanup on unmount
```

---

### 2. Bottleneck - Render Functions Recreated Every Render (3 locations)

**File:** `page.tsx:209-318`

```tsx
// ❌ Bad: Functions recreated on every render
const renderDecompileTab = () => ( ... );  // line 209
const renderNativeTab = () => ( ... );     // line 260
const renderStringsTab = () => ( ... );    // line 310
```

**Fix:** Extract to memoized child components:
```tsx
// ✅ Good: Separate component with React.memo
const DecompileTab = memo(function DecompileTab({ ... }: DecompileTabProps) {
  return ( ... );
});
```

---

### 3. Bottleneck - Inline Icons in Button JSX (2 locations)

**File:** `page.tsx:222-223`, `page.tsx:273-274`

```tsx
// ❌ Bad: New JSX node created every render
<FileCode className="h-4 w-4" />
<Cpu className="h-4 w-4" />
```

**Fix:** Extract icon elements to constants outside component:
```tsx
// ✅ Good: Constant reference
const FILE_CODE_ICON = <FileCode className="h-4 w-4" />;
const CPU_ICON = <Cpu className="h-4 w-4" />;
```

---

## MEDIUM Priority

### 4. Missing Memoization - Derived State (2 locations)

**File:** `page.tsx:150-151`, `page.tsx:206-207`

```tsx
// ❌ Bad: Recalculated every render
const isProcessing =
  analysisStage !== "idle" && analysisStage !== "complete" && analysisStage !== "error";
const isNativeProcessing =
  nativeStage !== "idle" && nativeStage !== "complete" && nativeStage !== "error";
```

**Fix:** Wrap with useMemo:
```tsx
const isProcessing = useMemo(
  () => analysisStage !== "idle" && analysisStage !== "complete" && analysisStage !== "error",
  [analysisStage]
);
```

---

### 5. Missing React.memo - StatCard Component

**File:** `NativeAnalysisViewer.tsx:36-48`

`StatCard` is a pure presentational component that receives primitive props. It should be wrapped with `React.memo` to prevent unnecessary re-renders when parent re-renders.

```tsx
// ❌ Current
function StatCard({ icon, label, value, accent = false }: StatCardProps) { ... }

// ✅ Fix
const StatCard = memo(function StatCard({ icon, label, value, accent = false }: StatCardProps) { ... });
```

---

### 6. Inline Icons in StatCard Calls (5 locations)

**File:** `NativeAnalysisViewer.tsx:72-98`

```tsx
// ❌ Bad: New JSX created every render
icon={<ArrowDownToLine className="h-5 w-5" />}
```

**Fix:** Pre-define icon elements:
```tsx
const STAT_ICONS = {
  import: <ArrowDownToLine className="h-5 w-5" />,
  export: <ArrowUpFromLine className="h-5 w-5" />,
  strings: <Type className="h-5 w-5" />,
  arch: <Cpu className="h-5 w-5" />,
  format: <FileType className="h-5 w-5" />,
} as const;
```

---

## LOW Priority

### 7. DRY Violation - Duplicate Type Definition

**Files:** `page.tsx:36-42` vs `NativeAnalysisViewer.tsx:15-21`

Same interface defined in two places:
```tsx
// page.tsx:36-42
const [nativeAnalysis, setNativeAnalysis] = useState<{
  importedFunctions: number;
  exportedFunctions: number;
  strings: number;
  architecture?: string;
  format?: string;
} | null>(null);

// NativeAnalysisViewer.tsx:15-21
interface NativeAnalysis { ... } // Same shape
```

**Fix:** Export `NativeAnalysis` interface from NativeAnalysisViewer and import in page.tsx.

---

### 8. DRY Violation - Duplicate Button Pattern

**File:** `page.tsx:218-225`, `page.tsx:268-276`

Two nearly identical analyze buttons with same styling:
```tsx
<button className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:bg-violet-500">
```

**Fix:** Extract to `AnalyzeButton` component or use existing button component from UI library.

---

### 9. DRY Violation - Similar Reset Functions

**File:** `page.tsx:46-53`, `page.tsx:154-159`

`resetDecompileResults` and `resetNativeResults` follow same pattern.

**Assessment:** Leave as-is. Different state variables make abstraction complex without benefit.

---

## Summary

| Priority | Count | Impact |
|----------|-------|--------|
| HIGH | 5 | Race conditions, render performance |
| MEDIUM | 3 | Unnecessary re-renders |
| LOW | 3 | Code duplication |

**Recommended Fix Order:**
1. AbortController pattern (fixes race conditions)
2. Extract render functions to components (biggest perf win)
3. Add React.memo + extract icons (prevents cascading re-renders)
4. Memoize derived state
5. DRY cleanup (optional)
