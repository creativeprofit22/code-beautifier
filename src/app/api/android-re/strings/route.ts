import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile, readdir } from "fs/promises";
import { join, basename, extname } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { UPLOAD_DIR, OUTPUT_DIR, sanitizeFilename, cleanupDirs } from "@/lib/android-re";

const execAsync = promisify(exec);

// Max file size: 100MB for APKs
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const VALID_EXTENSIONS = [".apk", ".dex", ".so", ".dll", ".exe", ".dylib", ".aar"];

// Minimum string length for extraction
const MIN_STRING_LENGTH = 4;

// Maximum strings to return per category (prevent huge responses)
const MAX_STRINGS_PER_CATEGORY = 5000;

// Maximum number of files to process per category (prevent DoS)
const MAX_FILES_PER_CATEGORY = 50;

/**
 * POST /api/android-re/strings
 * Extract strings from APK, DEX, or native library files.
 *
 * Request: multipart/form-data with 'file' field
 */
export async function POST(request: NextRequest) {
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
  const fileExt = extname(fileName);
  const hasValidExtension = VALID_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (!hasValidExtension) {
    return NextResponse.json(
      { error: `Invalid file type. Supported: ${VALID_EXTENSIONS.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  // Create unique job ID
  const jobId = `strings-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

    // Extract strings based on file type
    const result: {
      resources: string[];
      dex: string[];
      native: string[];
    } = {
      resources: [],
      dex: [],
      native: [],
    };

    if (fileExt === ".apk" || fileExt === ".aar") {
      // Handle APK/AAR files
      const extracted = await extractStringsFromApk(inputFilePath, outputPath);
      result.resources = extracted.resources;
      result.dex = extracted.dex;
      result.native = extracted.native;
    } else if (fileExt === ".dex") {
      // Handle DEX files
      result.dex = await extractStringsFromBinary(inputFilePath);
    } else {
      // Handle native libraries (.so, .dll, .exe, .dylib)
      result.native = await extractStringsFromBinary(inputFilePath);
    }

    // Calculate stats
    const stats = {
      total: result.resources.length + result.dex.length + result.native.length,
      resourceCount: result.resources.length,
      dexCount: result.dex.length,
      nativeCount: result.native.length,
    };

    // Cleanup directories
    await cleanupDirs(uploadPath, outputPath);

    return NextResponse.json({
      success: true,
      jobId,
      strings: result,
      stats,
    });
  } catch (error) {
    // Cleanup on error
    await cleanupDirs(uploadPath, outputPath);

    console.error("String extraction error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "String extraction failed" },
      { status: 500 }
    );
  }
}

/**
 * Extract strings from an APK or AAR file.
 */
async function extractStringsFromApk(
  apkPath: string,
  outputPath: string
): Promise<{ resources: string[]; dex: string[]; native: string[] }> {
  const result = {
    resources: [] as string[],
    dex: [] as string[],
    native: [] as string[],
  };

  const extractDir = join(outputPath, "extracted");
  await mkdir(extractDir, { recursive: true });

  try {
    // Extract APK contents using unzip
    await execAsync(`unzip -q -o "${apkPath}" -d "${extractDir}"`, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });

    // 1. Parse strings.xml if present
    const stringsXmlPath = join(extractDir, "res", "values", "strings.xml");
    try {
      const stringsXml = await readFile(stringsXmlPath, "utf-8");
      result.resources = parseStringsXml(stringsXml);
    } catch {
      // strings.xml not found or couldn't be parsed - that's OK
    }

    // 2. Extract strings from DEX files (parallel, limited to prevent DoS)
    const dexFiles = (await findFilesWithExtension(extractDir, ".dex")).slice(
      0,
      MAX_FILES_PER_CATEGORY
    );
    const dexResults = await Promise.all(dexFiles.map(extractStringsFromBinary));
    result.dex = dexResults.flat();

    // 3. Extract strings from native libraries (parallel, limited to prevent DoS)
    const soFiles = (await findFilesWithExtension(extractDir, ".so")).slice(
      0,
      MAX_FILES_PER_CATEGORY
    );
    const soResults = await Promise.all(soFiles.map(extractStringsFromBinary));
    result.native = soResults.flat();

    // Deduplicate and limit results
    result.resources = [...new Set(result.resources)].slice(0, MAX_STRINGS_PER_CATEGORY);
    result.dex = [...new Set(result.dex)].slice(0, MAX_STRINGS_PER_CATEGORY);
    result.native = [...new Set(result.native)].slice(0, MAX_STRINGS_PER_CATEGORY);
  } catch (error) {
    // If unzip fails, try to extract strings directly from APK
    console.error("APK extraction error:", error);
    const fallbackStrings = await extractStringsFromBinary(apkPath);
    result.dex = fallbackStrings.slice(0, MAX_STRINGS_PER_CATEGORY);
  }

  return result;
}

/**
 * Parse Android strings.xml and extract string values using regex.
 * This avoids external XML parser dependencies while handling common cases.
 */
function parseStringsXml(xmlContent: string): string[] {
  const strings: string[] = [];

  try {
    // Match <string name="...">value</string> patterns
    // Handles: simple text, CDATA sections, and escaped content
    const stringPattern =
      /<string\s+name="[^"]*"[^>]*>([^<]*(?:<!\[CDATA\[[\s\S]*?\]\]>[^<]*)*)<\/string>/g;
    let match;

    while ((match = stringPattern.exec(xmlContent)) !== null) {
      let value = match[1];

      // Extract content from CDATA if present
      const cdataMatch = value.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      if (cdataMatch) {
        value = cdataMatch[1];
      }

      // Decode common XML entities
      value = decodeXmlEntities(value);

      if (value.trim()) {
        strings.push(value.trim());
      }
    }

    // Match <item> elements within string-array
    const itemPattern = /<item>([^<]*(?:<!\[CDATA\[[\s\S]*?\]\]>[^<]*)*)<\/item>/g;

    while ((match = itemPattern.exec(xmlContent)) !== null) {
      let value = match[1];

      const cdataMatch = value.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      if (cdataMatch) {
        value = cdataMatch[1];
      }

      value = decodeXmlEntities(value);

      if (value.trim()) {
        strings.push(value.trim());
      }
    }
  } catch (error) {
    console.error("XML parsing error:", error);
  }

  return strings.filter((s) => s && s.trim().length > 0);
}

/**
 * Decode common XML entities.
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const codePoint = parseInt(code, 10);
      // Use fromCodePoint for full Unicode support (emoji, supplementary chars)
      return String.fromCodePoint(codePoint);
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
      const codePoint = parseInt(code, 16);
      return String.fromCodePoint(codePoint);
    });
}

/**
 * Extract readable strings from a binary file using the `strings` command.
 */
async function extractStringsFromBinary(filePath: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`strings -n ${MIN_STRING_LENGTH} "${filePath}"`, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large files
    });

    const rawStrings = stdout.split("\n");
    return filterUsefulStrings(rawStrings).slice(0, MAX_STRINGS_PER_CATEGORY);
  } catch (error) {
    console.error(`Failed to extract strings from ${basename(filePath)}:`, error);
    return [];
  }
}

/**
 * Filter out obviously non-useful strings.
 */
function filterUsefulStrings(strings: string[]): string[] {
  return strings.filter((s) => {
    const trimmed = s.trim();

    // Skip empty strings
    if (!trimmed) return false;

    // Skip very short strings (less than min length)
    if (trimmed.length < MIN_STRING_LENGTH) return false;

    // Skip strings that are only numbers
    if (/^\d+$/.test(trimmed)) return false;

    // Skip strings that are only hex (common in binaries)
    if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length <= 16) return false;

    // Skip strings that are only special characters
    if (/^[^a-zA-Z0-9]+$/.test(trimmed)) return false;

    // Skip strings that look like garbage (high ratio of non-printable or unusual chars)
    const printableRatio =
      (trimmed.match(/[a-zA-Z0-9\s.,;:!?'"()\-_=+@#$%&*/\\[\]{}|<>]/g)?.length || 0) /
      trimmed.length;
    if (printableRatio < 0.7) return false;

    // Skip common binary artifacts
    const binaryArtifacts = [
      /^\.+$/,
      /^_+$/,
      /^GLIBC_/,
      /^GCC_/,
      /^__cxa_/,
      /^__gnu_/,
      /^\$[a-z]+$/i,
    ];
    if (binaryArtifacts.some((pattern) => pattern.test(trimmed))) return false;

    return true;
  });
}

/**
 * Recursively find files with a specific extension.
 */
async function findFilesWithExtension(dir: string, ext: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        const subResults = await findFilesWithExtension(fullPath, ext);
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory access error - skip
  }

  return results;
}
