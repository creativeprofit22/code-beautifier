# Refactor Hunt Report: Android RE API Routes

**Date**: 2025-12-28
**Feature**: Android RE API Routes
**Files Analyzed**:
- `src/app/api/android-re/decompile/route.ts` (223 lines)
- `src/app/api/android-re/analyze/route.ts` (183 lines)
- `src/app/api/android-re/file/route.ts` (137 lines)
- `src/app/android-re/page.tsx` (271 lines)

---

## High Priority

### 1. Duplicate `sanitizeFilename` function
**Files**: `decompile/route.ts:16-19`, `analyze/route.ts:15-18`
**Issue**: Exact duplicate function in both files
**Impact**: Code drift risk, maintenance burden
**Fix**: Extract to `src/lib/android-re/utils.ts`

```typescript
// Both files have identical:
function sanitizeFilename(name: string): string {
  const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
  return `input${ext}`;
}
```

---

### 2. Duplicate `FileNode` interface
**Files**: `decompile/route.ts:33-38`, `page.tsx:16-21`
**Issue**: Same interface defined in two places
**Impact**: Type drift, IntelliSense confusion
**Fix**: Extract to `src/features/android-re/types.ts`

```typescript
interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}
```

---

### 3. Duplicate directory constants
**Files**: All 3 API routes
**Issue**: `UPLOAD_DIR` and `OUTPUT_DIR` repeated in each file
**Impact**: Change one, forget others
**Fix**: Create `src/lib/android-re/constants.ts`

| File | UPLOAD_DIR | OUTPUT_DIR |
|------|-----------|-----------|
| decompile/route.ts:9-10 | ✓ | ✓ |
| analyze/route.ts:9-10 | ✓ | ✓ |
| file/route.ts:5 | - | ✓ |

---

## Medium Priority

### 4. Repeated cleanup pattern
**Files**: `decompile/route.ts:184-185,202,213-214`, `analyze/route.ts:117-118,127,137-138`
**Issue**: Same cleanup logic duplicated 6 times
**Impact**: Error-prone, verbose
**Current**:
```typescript
await rm(uploadPath, { recursive: true, force: true }).catch(() => {});
await rm(outputPath, { recursive: true, force: true }).catch(() => {});
```
**Fix**: Create helper function:
```typescript
async function cleanupDirs(...paths: string[]): Promise<void> {
  await Promise.all(paths.map(p => rm(p, { recursive: true, force: true }).catch(() => {})));
}
```

---

### 5. Duplicate form validation pattern
**Files**: `decompile/route.ts:112-133`, `analyze/route.ts:51-80`
**Issue**: Nearly identical file validation logic (formData parsing, extension check, size check)
**Impact**: ~30 lines duplicated
**Fix**: Extract `validateUploadedFile(request, options)` helper that returns `{ file, error }` result

Validation steps duplicated:
1. Parse formData with try/catch
2. Check file field exists and is File instance
3. Validate extension against allowed list
4. Validate size against max limit

---

### 6. State reset duplication in page.tsx
**File**: `page.tsx:36-55`
**Issue**: `handleFileSelect` and `handleFileClear` both reset 5+ state values
**Impact**: Easy to miss one when adding new state
**Current**:
```typescript
// handleFileSelect resets: jobId, fileTree, selectedFilePath, fileContent
// handleFileClear resets: selectedFile, jobId, fileTree, selectedFilePath, fileContent
```
**Fix**: Create `resetDecompileState()` helper or use `useReducer`

---

## Low Priority

### 7. JobId format regex inline
**File**: `file/route.ts:51`
**Issue**: Regex patterns for jobId validation are inline strings
**Impact**: Minor - could mismatch with generation logic
**Current**:
```typescript
if (!/^jadx-\d+-[a-z0-9]+$/.test(jobId) && !/^ghidra-\d+-[a-z0-9]+$/.test(jobId)) {
```
**Fix**: Constants in shared file: `JADX_JOB_ID_REGEX`, `GHIDRA_JOB_ID_REGEX`

---

### 8. `pathExists` utility not shared
**File**: `decompile/route.ts:24-31`
**Issue**: Useful helper only exists in one file
**Impact**: Will likely need in other routes
**Fix**: Move to `src/lib/android-re/utils.ts` when needed elsewhere

---

## Not Issues (Reviewed, No Action)

- **`buildFileTree`**: Only used in decompile route, appropriately scoped
- **`parseGhidraOutput`**: Inline in analyze route, fine until complexity grows
- **Different MAX_FILE_SIZE values**: 100MB (APK) vs 50MB (native) vs 10MB (read) are intentional per use case
- **Tab render functions in page.tsx**: Small, readable as inline functions

---

## Summary

| Priority | Count | Effort |
|----------|-------|--------|
| High | 3 | ~30 min |
| Medium | 3 | ~45 min |
| Low | 2 | ~15 min |

**Recommended First Action**: Create `src/lib/android-re/` directory with:
- `constants.ts` - shared paths, limits
- `utils.ts` - sanitizeFilename, cleanupDirs, validateUploadedFile
- `types.ts` - FileNode interface

This consolidation will reduce ~80 lines of duplication across the routes.
