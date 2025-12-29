import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readdir, stat } from "fs/promises";
import { join } from "path";
import { decompileApk, checkJadxAvailable, getJadxVersion } from "@/lib/jadx-wrapper";
import {
  UPLOAD_DIR,
  OUTPUT_DIR,
  sanitizeFilename,
  pathExists,
  cleanupDirs,
  type FileNode,
} from "@/lib/android-re";

// Max file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const VALID_EXTENSIONS = [".apk", ".dex", ".aar"];

/**
 * Recursively build a file tree from a directory.
 */
async function buildFileTree(dirPath: string, basePath: string = ""): Promise<FileNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = await buildFileTree(join(dirPath, entry.name), relativePath);
      nodes.push({
        name: entry.name,
        type: "folder",
        path: relativePath,
        children,
      });
    } else {
      nodes.push({
        name: entry.name,
        type: "file",
        path: relativePath,
      });
    }
  }

  // Sort: folders first, then alphabetically
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * GET /api/android-re/decompile
 * Check JADX availability and version.
 */
export async function GET() {
  const check = checkJadxAvailable();
  if (!check.available) {
    return NextResponse.json(
      { available: false, error: check.error, hint: check.hint },
      { status: 503 }
    );
  }

  const versionResult = await getJadxVersion();
  return NextResponse.json({
    available: true,
    version: versionResult.success ? versionResult.data : "unknown",
  });
}

/**
 * POST /api/android-re/decompile
 * Decompile an APK/DEX/AAR file using JADX.
 *
 * Request: multipart/form-data with 'file' field
 * Options (optional):
 * - showBadCode: boolean
 * - noRes: boolean
 * - deobf: boolean
 * - threadsCount: number
 */
export async function POST(request: NextRequest) {
  // Check JADX availability first
  const jadxCheck = checkJadxAvailable();
  if (!jadxCheck.available) {
    return NextResponse.json({ error: jadxCheck.error, hint: jadxCheck.hint }, { status: 503 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const fileField = formData.get("file");
  if (!fileField || !(fileField instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const file = fileField;

  // Validate file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = VALID_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (!hasValidExtension) {
    return NextResponse.json(
      { error: `Invalid file type. Supported: ${VALID_EXTENSIONS.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  // Parse options from form data
  const showBadCode = formData.get("showBadCode") === "true";
  const noRes = formData.get("noRes") === "true";
  const deobf = formData.get("deobf") === "true";
  const threadsCountStr = formData.get("threadsCount");
  let threadsCount: number | undefined;
  if (typeof threadsCountStr === "string" && threadsCountStr.trim()) {
    const parsed = parseInt(threadsCountStr, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 32) {
      threadsCount = parsed;
    }
  }

  // Create unique job ID
  const jobId = `jadx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uploadPath = join(UPLOAD_DIR, jobId);
  const outputPath = join(OUTPUT_DIR, jobId);

  try {
    // Ensure directories exist
    await mkdir(uploadPath, { recursive: true });
    await mkdir(outputPath, { recursive: true });

    // Save uploaded file with sanitized name
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeFilename = sanitizeFilename(file.name);
    const inputFilePath = join(uploadPath, safeFilename);
    await writeFile(inputFilePath, buffer);

    // Run JADX decompilation
    const result = await decompileApk(inputFilePath, {
      outputDir: outputPath,
      showBadCode,
      noRes,
      deobf,
      threadsCount,
    });

    if (!result.success) {
      // Cleanup on failure
      await cleanupDirs(uploadPath, outputPath);

      return NextResponse.json({ error: result.error, hint: result.hint }, { status: 500 });
    }

    // Build file tree from output
    let fileTree: FileNode[] = [];
    if (await pathExists(outputPath)) {
      const sourcesDir = join(outputPath, "sources");
      const treeRoot = (await pathExists(sourcesDir)) ? sourcesDir : outputPath;
      fileTree = await buildFileTree(treeRoot);
    }

    // Get output stats
    const stats = await stat(outputPath).catch(() => null);

    // Cleanup upload (keep output for file reading)
    await cleanupDirs(uploadPath);

    return NextResponse.json({
      success: true,
      jobId,
      fileTree,
      message: result.data,
      stats: stats ? { modifiedTime: stats.mtime.toISOString() } : undefined,
    });
  } catch (error) {
    // Cleanup on error
    await cleanupDirs(uploadPath, outputPath);

    console.error("Decompile error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Decompilation failed" },
      { status: 500 }
    );
  }
}
