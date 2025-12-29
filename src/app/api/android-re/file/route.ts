import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, resolve } from "path";
import { OUTPUT_DIR, JADX_JOB_ID_REGEX, GHIDRA_JOB_ID_REGEX } from "@/lib/android-re";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit for reading

// Allowed file extensions for reading
const ALLOWED_EXTENSIONS = [
  ".java",
  ".kt",
  ".xml",
  ".json",
  ".txt",
  ".properties",
  ".gradle",
  ".pro",
  ".cfg",
  ".md",
  ".html",
  ".css",
  ".js",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
];

/**
 * GET /api/android-re/file
 * Read a decompiled file's content.
 *
 * Query params:
 * - jobId: string (required) - The decompilation job ID
 * - path: string (required) - Relative path to the file within the output
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const filePath = searchParams.get("path");

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  // Validate jobId format to prevent path traversal
  if (!JADX_JOB_ID_REGEX.test(jobId) && !GHIDRA_JOB_ID_REGEX.test(jobId)) {
    return NextResponse.json({ error: "Invalid jobId format" }, { status: 400 });
  }

  // Prevent path traversal
  if (filePath.includes("..") || filePath.startsWith("/")) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  // Check file extension - handle files without extensions
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === filePath.length - 1) {
    return NextResponse.json({ error: "File must have a valid extension" }, { status: 400 });
  }
  const ext = filePath.substring(dotIndex).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
      { status: 400 }
    );
  }

  // Build candidate paths and resolve them BEFORE checking existence
  const jobOutputDir = join(OUTPUT_DIR, jobId);
  const sourcesPath = resolve(join(jobOutputDir, "sources", filePath));
  const directPath = resolve(join(jobOutputDir, filePath));

  // Security: Verify resolved paths are within OUTPUT_DIR BEFORE any file operations
  const resolvedOutputDir = resolve(OUTPUT_DIR);
  if (!sourcesPath.startsWith(resolvedOutputDir) || !directPath.startsWith(resolvedOutputDir)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Now check which path exists and get file info
  let targetPath: string | null = null;
  let fileStats: Awaited<ReturnType<typeof stat>> | null = null;

  try {
    fileStats = await stat(sourcesPath);
    if (fileStats.isFile()) {
      targetPath = sourcesPath;
    }
  } catch {
    // Try direct path
  }

  if (!targetPath) {
    try {
      fileStats = await stat(directPath);
      if (fileStats.isFile()) {
        targetPath = directPath;
      }
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
  }

  if (!targetPath || !fileStats) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Check file size before reading
  if (fileStats.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  try {
    const content = await readFile(targetPath, "utf-8");

    return NextResponse.json({
      path: filePath,
      content,
      size: content.length,
    });
  } catch (error) {
    // Handle encoding errors gracefully
    if (error instanceof Error && error.message.includes("encoding")) {
      return NextResponse.json({ error: "File is not valid UTF-8 text" }, { status: 400 });
    }
    console.error("File read error:", error);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
