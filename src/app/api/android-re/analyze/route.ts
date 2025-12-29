import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { analyzeNativeLib, checkGhidraAvailable } from "@/lib/ghidra-wrapper";
import { UPLOAD_DIR, OUTPUT_DIR, sanitizeFilename, cleanupDirs } from "@/lib/android-re";

// Max file size: 50MB for native libs
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const VALID_EXTENSIONS = [".so", ".dll", ".exe", ".dylib", ".o"];

/**
 * GET /api/android-re/analyze
 * Check Ghidra availability.
 */
export async function GET() {
  const check = checkGhidraAvailable();
  if (!check.available) {
    return NextResponse.json(
      { available: false, error: check.error, hint: check.hint },
      { status: 503 }
    );
  }

  return NextResponse.json({ available: true });
}

/**
 * POST /api/android-re/analyze
 * Analyze a native library using Ghidra headless.
 *
 * Request: multipart/form-data with 'file' field
 * Options (optional):
 * - maxCpu: number (max CPU threads to use)
 */
export async function POST(request: NextRequest) {
  // Check Ghidra availability first
  const ghidraCheck = checkGhidraAvailable();
  if (!ghidraCheck.available) {
    return NextResponse.json({ error: ghidraCheck.error, hint: ghidraCheck.hint }, { status: 503 });
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
  const maxCpuStr = formData.get("maxCpu");
  let maxCpu: number | undefined;
  if (typeof maxCpuStr === "string" && maxCpuStr.trim()) {
    const parsed = parseInt(maxCpuStr, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 32) {
      maxCpu = parsed;
    }
  }

  // Create unique job ID
  const jobId = `ghidra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

    // Run Ghidra analysis
    const result = await analyzeNativeLib(inputFilePath, outputPath, {
      projectName: `analysis_${jobId}`,
      maxCpu,
    });

    if (!result.success) {
      // Cleanup on failure
      await cleanupDirs(uploadPath, outputPath);

      return NextResponse.json({ error: result.error, hint: result.hint }, { status: 500 });
    }

    // Parse analysis output for key findings
    const analysisData = parseGhidraOutput(result.data || "");

    // Cleanup upload directory
    await cleanupDirs(uploadPath);

    return NextResponse.json({
      success: true,
      jobId,
      analysis: analysisData,
      rawOutput: result.data,
    });
  } catch (error) {
    // Cleanup on error
    await cleanupDirs(uploadPath, outputPath);

    console.error("Ghidra analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}

/**
 * Parse Ghidra headless output for key information.
 */
function parseGhidraOutput(output: string): {
  importedFunctions: number;
  exportedFunctions: number;
  strings: number;
  architecture?: string;
  format?: string;
} {
  const result = {
    importedFunctions: 0,
    exportedFunctions: 0,
    strings: 0,
    architecture: undefined as string | undefined,
    format: undefined as string | undefined,
  };

  // Extract function counts from output
  const importMatch = output.match(/Imported\s+(\d+)\s+functions?/i);
  if (importMatch) result.importedFunctions = parseInt(importMatch[1], 10);

  const exportMatch = output.match(/Exported\s+(\d+)\s+functions?/i);
  if (exportMatch) result.exportedFunctions = parseInt(exportMatch[1], 10);

  // Extract architecture
  const archMatch = output.match(/(?:processor|architecture)[:\s]+(\w+)/i);
  if (archMatch) result.architecture = archMatch[1];

  // Extract format
  const formatMatch = output.match(/(?:format|type)[:\s]+(ELF|PE|Mach-O|DEX)/i);
  if (formatMatch) result.format = formatMatch[1];

  return result;
}
