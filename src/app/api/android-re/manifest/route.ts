import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { UPLOAD_DIR, OUTPUT_DIR, sanitizeFilename, cleanupDirs } from "@/lib/android-re";

const execAsync = promisify(exec);

// Max file size: 100MB for APKs
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const VALID_EXTENSIONS = [".apk", ".aar"];

// ============================================================================
// Types
// ============================================================================

interface IntentFilter {
  action?: string;
  category?: string;
  data?: string;
}

interface ActivityInfo {
  name: string;
  exported: boolean;
  intentFilters: IntentFilter[];
  permission?: string;
}

interface ServiceInfo {
  name: string;
  exported: boolean;
  permission?: string;
}

interface ReceiverInfo {
  name: string;
  exported: boolean;
  intentFilters: Array<{ action?: string }>;
  permission?: string;
}

interface ProviderInfo {
  name: string;
  exported: boolean;
  authorities?: string;
  permission?: string;
  readPermission?: string;
  writePermission?: string;
}

interface PermissionInfo {
  name: string;
  protectionLevel?: string;
}

interface SecurityIssue {
  severity: "high" | "medium" | "low";
  issue: string;
  component?: string;
}

interface ManifestResult {
  package: string;
  versionCode: string;
  versionName: string;
  minSdk: string;
  targetSdk: string;
  permissions: PermissionInfo[];
  activities: ActivityInfo[];
  services: ServiceInfo[];
  receivers: ReceiverInfo[];
  providers: ProviderInfo[];
  securityIssues: SecurityIssue[];
  debuggable: boolean;
  allowBackup: boolean;
}

// ============================================================================
// Known Android permission protection levels
// ============================================================================

const DANGEROUS_PERMISSIONS = new Set([
  "android.permission.READ_CALENDAR",
  "android.permission.WRITE_CALENDAR",
  "android.permission.CAMERA",
  "android.permission.READ_CONTACTS",
  "android.permission.WRITE_CONTACTS",
  "android.permission.GET_ACCOUNTS",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.RECORD_AUDIO",
  "android.permission.READ_PHONE_STATE",
  "android.permission.READ_PHONE_NUMBERS",
  "android.permission.CALL_PHONE",
  "android.permission.ANSWER_PHONE_CALLS",
  "android.permission.READ_CALL_LOG",
  "android.permission.WRITE_CALL_LOG",
  "android.permission.ADD_VOICEMAIL",
  "android.permission.USE_SIP",
  "android.permission.PROCESS_OUTGOING_CALLS",
  "android.permission.BODY_SENSORS",
  "android.permission.ACTIVITY_RECOGNITION",
  "android.permission.SEND_SMS",
  "android.permission.RECEIVE_SMS",
  "android.permission.READ_SMS",
  "android.permission.RECEIVE_WAP_PUSH",
  "android.permission.RECEIVE_MMS",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.NEARBY_WIFI_DEVICES",
  "android.permission.BLUETOOTH_SCAN",
  "android.permission.BLUETOOTH_ADVERTISE",
  "android.permission.BLUETOOTH_CONNECT",
]);

const SIGNATURE_PERMISSIONS = new Set([
  "android.permission.BIND_ACCESSIBILITY_SERVICE",
  "android.permission.BIND_AUTOFILL_SERVICE",
  "android.permission.BIND_CARRIER_SERVICES",
  "android.permission.BIND_CHOOSER_TARGET_SERVICE",
  "android.permission.BIND_CONDITION_PROVIDER_SERVICE",
  "android.permission.BIND_DEVICE_ADMIN",
  "android.permission.BIND_DREAM_SERVICE",
  "android.permission.BIND_INPUT_METHOD",
  "android.permission.BIND_MIDI_DEVICE_SERVICE",
  "android.permission.BIND_NFC_SERVICE",
  "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
  "android.permission.BIND_PRINT_SERVICE",
  "android.permission.BIND_QUICK_ACCESS_WALLET_SERVICE",
  "android.permission.BIND_QUICK_SETTINGS_TILE",
  "android.permission.BIND_REMOTEVIEWS",
  "android.permission.BIND_SCREENING_SERVICE",
  "android.permission.BIND_TELECOM_CONNECTION_SERVICE",
  "android.permission.BIND_TEXT_SERVICE",
  "android.permission.BIND_TV_INPUT",
  "android.permission.BIND_VISUAL_VOICEMAIL_SERVICE",
  "android.permission.BIND_VOICE_INTERACTION",
  "android.permission.BIND_VPN_SERVICE",
  "android.permission.BIND_VR_LISTENER_SERVICE",
  "android.permission.BIND_WALLPAPER",
  "android.permission.CLEAR_APP_CACHE",
  "android.permission.MANAGE_DOCUMENTS",
  "android.permission.READ_VOICEMAIL",
  "android.permission.REQUEST_COMPANION_RUN_IN_BACKGROUND",
  "android.permission.REQUEST_COMPANION_USE_DATA_IN_BACKGROUND",
  "android.permission.REQUEST_DELETE_PACKAGES",
  "android.permission.REQUEST_INSTALL_PACKAGES",
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.WRITE_SETTINGS",
  "android.permission.WRITE_VOICEMAIL",
]);

// ============================================================================
// API Route Handler
// ============================================================================

/**
 * POST /api/android-re/manifest
 * Parse AndroidManifest.xml from APK files and return structured data.
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
  const jobId = `manifest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

    // Parse the manifest
    const result = await parseAndroidManifest(inputFilePath, outputPath);

    // Calculate stats
    const stats = {
      permissionCount: result.permissions.length,
      activityCount: result.activities.length,
      serviceCount: result.services.length,
      receiverCount: result.receivers.length,
      providerCount: result.providers.length,
      securityIssueCount: result.securityIssues.length,
    };

    // Cleanup directories
    await cleanupDirs(uploadPath, outputPath);

    return NextResponse.json({
      success: true,
      jobId,
      manifest: result,
      stats,
    });
  } catch (error) {
    // Cleanup on error
    await cleanupDirs(uploadPath, outputPath);

    console.error("Manifest parsing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Manifest parsing failed" },
      { status: 500 }
    );
  }
}

// ============================================================================
// Manifest Parsing Logic
// ============================================================================

/**
 * Parse AndroidManifest.xml from an APK file using aapt/aapt2.
 */
async function parseAndroidManifest(apkPath: string, _outputPath: string): Promise<ManifestResult> {
  // Try aapt2 first, fallback to aapt
  let xmlTreeOutput: string;

  try {
    // aapt2 dump xmltree format
    const { stdout } = await execAsync(
      `aapt2 dump xmltree "${apkPath}" --file AndroidManifest.xml`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 60000 }
    );
    xmlTreeOutput = stdout;
  } catch {
    try {
      // Fallback to aapt (different syntax)
      const { stdout } = await execAsync(`aapt dump xmltree "${apkPath}" AndroidManifest.xml`, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000,
      });
      xmlTreeOutput = stdout;
    } catch (fallbackError) {
      throw new Error(
        "Failed to parse manifest. Neither aapt2 nor aapt available: " +
          (fallbackError instanceof Error ? fallbackError.message : String(fallbackError))
      );
    }
  }

  // Also get badging info for version details (more reliable for some fields)
  let badgingOutput = "";
  try {
    const { stdout } = await execAsync(`aapt dump badging "${apkPath}"`, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    });
    badgingOutput = stdout;
  } catch {
    // Badging info is supplementary, continue without it
  }

  // Parse the xmltree output
  const result = parseAaptXmlTree(xmlTreeOutput, badgingOutput);

  // Analyze security issues
  result.securityIssues = analyzeSecurityIssues(result);

  return result;
}

/**
 * Parse aapt xmltree output format.
 *
 * The format looks like:
 * N: android=http://schemas.android.com/apk/res/android
 * E: manifest (line=2)
 *   A: android:versionCode(0x0101021b)=(type 0x10)0x1
 *   A: android:versionName(0x0101021c)="1.0" (Raw: "1.0")
 *   A: package="com.example.app" (Raw: "com.example.app")
 *   E: uses-sdk (line=6)
 *     A: android:minSdkVersion(0x0101020c)=(type 0x10)0x15
 *     A: android:targetSdkVersion(0x01010270)=(type 0x10)0x1e
 *   E: uses-permission (line=8)
 *     A: android:name(0x01010003)="android.permission.INTERNET" (Raw: "android.permission.INTERNET")
 *   E: application (line=10)
 *     A: android:debuggable(0x0101000f)=(type 0x12)0xffffffff
 *     E: activity (line=15)
 *       A: android:name(0x01010003)=".MainActivity" (Raw: ".MainActivity")
 *       A: android:exported(0x01010010)=(type 0x12)0xffffffff
 */
function parseAaptXmlTree(xmlTree: string, badging: string): ManifestResult {
  const result: ManifestResult = {
    package: "",
    versionCode: "",
    versionName: "",
    minSdk: "",
    targetSdk: "",
    permissions: [],
    activities: [],
    services: [],
    receivers: [],
    providers: [],
    securityIssues: [],
    debuggable: false,
    allowBackup: true, // Default to true as per Android docs
  };

  const lines = xmlTree.split("\n");

  // State tracking for parsing nested elements
  let currentElement: string | null = null;
  let currentComponent: Partial<ActivityInfo | ServiceInfo | ReceiverInfo | ProviderInfo> | null =
    null;
  let componentType: "activity" | "service" | "receiver" | "provider" | null = null;
  let inIntentFilter = false;
  let currentIntentFilter: IntentFilter = {};
  let _elementDepth = 0;
  let componentDepth = 0;
  let intentFilterDepth = 0;

  for (const line of lines) {
    // Calculate current depth based on leading spaces
    const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
    const currentDepth = Math.floor(leadingSpaces / 2);

    // Parse element start: E: elementName (line=N)
    const elementMatch = line.match(/^\s*E:\s+(\S+)/);
    if (elementMatch) {
      const elementName = elementMatch[1];
      _elementDepth = currentDepth;

      // End current component if we're at same or higher level
      if (currentComponent && componentDepth >= currentDepth) {
        saveComponent(result, currentComponent, componentType);
        currentComponent = null;
        componentType = null;
      }

      // End intent filter if we're at same or higher level
      if (inIntentFilter && intentFilterDepth >= currentDepth) {
        if (currentComponent && "intentFilters" in currentComponent) {
          (currentComponent.intentFilters as IntentFilter[]).push({ ...currentIntentFilter });
        }
        inIntentFilter = false;
        currentIntentFilter = {};
      }

      currentElement = elementName;

      // Handle specific elements
      switch (elementName) {
        case "activity":
        case "activity-alias":
          currentComponent = { name: "", exported: false, intentFilters: [] };
          componentType = "activity";
          componentDepth = currentDepth;
          break;
        case "service":
          currentComponent = { name: "", exported: false };
          componentType = "service";
          componentDepth = currentDepth;
          break;
        case "receiver":
          currentComponent = { name: "", exported: false, intentFilters: [] };
          componentType = "receiver";
          componentDepth = currentDepth;
          break;
        case "provider":
          currentComponent = { name: "", exported: false };
          componentType = "provider";
          componentDepth = currentDepth;
          break;
        case "intent-filter":
          inIntentFilter = true;
          intentFilterDepth = currentDepth;
          currentIntentFilter = {};
          break;
      }
      continue;
    }

    // Parse attributes: A: android:name(0x...)="value" (Raw: "value")
    // or: A: android:name(0x...)=(type 0x10)0x1f
    // Also handles: A: package="value" (no android: prefix, no hex ID)
    const attrMatch = line.match(
      /^\s*A:\s+(?:android:)?(\w+)(?:\([^)]*\))?=(?:"([^"]*)"|(?:\(type [^)]+\))?(0x[0-9a-fA-F]+|-?\d+))/
    );
    if (attrMatch) {
      const attrName = attrMatch[1];
      const stringValue = attrMatch[2];
      const hexValue = attrMatch[3];

      // Handle manifest-level attributes
      if (currentElement === "manifest") {
        if (attrName === "package") {
          result.package = stringValue || "";
        } else if (attrName === "versionCode") {
          result.versionCode = hexValue ? String(parseInt(hexValue, 16)) : stringValue || "";
        } else if (attrName === "versionName") {
          result.versionName = stringValue || "";
        }
      }

      // Handle uses-sdk attributes
      if (currentElement === "uses-sdk") {
        if (attrName === "minSdkVersion") {
          result.minSdk = hexValue ? String(parseInt(hexValue, 16)) : stringValue || "";
        } else if (attrName === "targetSdkVersion") {
          result.targetSdk = hexValue ? String(parseInt(hexValue, 16)) : stringValue || "";
        }
      }

      // Handle uses-permission
      if (currentElement === "uses-permission" && attrName === "name") {
        const permName = stringValue || "";
        if (permName) {
          result.permissions.push({
            name: permName,
            protectionLevel: getPermissionProtectionLevel(permName),
          });
        }
      }

      // Handle application attributes
      if (currentElement === "application") {
        if (attrName === "debuggable") {
          // 0xffffffff = true, 0x0 = false
          result.debuggable = hexValue === "0xffffffff" || hexValue === "-1";
        } else if (attrName === "allowBackup") {
          // 0xffffffff = true, 0x0 = false
          result.allowBackup = hexValue !== "0x0" && hexValue !== "0";
        }
      }

      // Handle component attributes
      if (currentComponent) {
        if (attrName === "name") {
          currentComponent.name = stringValue || "";
        } else if (attrName === "exported") {
          currentComponent.exported = hexValue === "0xffffffff" || hexValue === "-1";
        } else if (attrName === "permission") {
          currentComponent.permission = stringValue;
        } else if (attrName === "authorities" && componentType === "provider") {
          (currentComponent as ProviderInfo).authorities = stringValue;
        } else if (attrName === "readPermission" && componentType === "provider") {
          (currentComponent as ProviderInfo).readPermission = stringValue;
        } else if (attrName === "writePermission" && componentType === "provider") {
          (currentComponent as ProviderInfo).writePermission = stringValue;
        }
      }

      // Handle intent-filter children
      if (inIntentFilter) {
        if (currentElement === "action" && attrName === "name") {
          currentIntentFilter.action = stringValue;
        } else if (currentElement === "category" && attrName === "name") {
          currentIntentFilter.category = stringValue;
        } else if (currentElement === "data") {
          // Collect data attributes (scheme, host, path, etc.)
          if (attrName === "scheme" || attrName === "host" || attrName === "path") {
            const dataStr = currentIntentFilter.data || "";
            currentIntentFilter.data =
              dataStr + (dataStr ? ", " : "") + `${attrName}=${stringValue}`;
          }
        }
      }
    }
  }

  // Save any remaining component
  if (currentComponent) {
    if (inIntentFilter && "intentFilters" in currentComponent) {
      (currentComponent.intentFilters as IntentFilter[]).push({ ...currentIntentFilter });
    }
    saveComponent(result, currentComponent, componentType);
  }

  // Extract additional info from badging output if available
  if (badging) {
    parseBadgingOutput(result, badging);
  }

  // Infer exported status for components with intent-filters (Android 12+ behavior)
  inferExportedStatus(result);

  return result;
}

/**
 * Save a component to the result based on its type.
 */
function saveComponent(
  result: ManifestResult,
  component: Partial<ActivityInfo | ServiceInfo | ReceiverInfo | ProviderInfo>,
  type: "activity" | "service" | "receiver" | "provider" | null
): void {
  if (!type || !component.name) return;

  switch (type) {
    case "activity":
      result.activities.push(component as ActivityInfo);
      break;
    case "service":
      result.services.push(component as ServiceInfo);
      break;
    case "receiver":
      result.receivers.push(component as ReceiverInfo);
      break;
    case "provider":
      result.providers.push(component as ProviderInfo);
      break;
  }
}

/**
 * Parse aapt dump badging output for additional info.
 */
function parseBadgingOutput(result: ManifestResult, badging: string): void {
  // package: name='com.example' versionCode='1' versionName='1.0'
  const packageMatch = badging.match(
    /package:\s+name='([^']+)'\s+versionCode='([^']+)'\s+versionName='([^']+)'/
  );
  if (packageMatch) {
    if (!result.package) result.package = packageMatch[1];
    if (!result.versionCode) result.versionCode = packageMatch[2];
    if (!result.versionName) result.versionName = packageMatch[3];
  }

  // sdkVersion:'21'
  const minSdkMatch = badging.match(/sdkVersion:'(\d+)'/);
  if (minSdkMatch && !result.minSdk) {
    result.minSdk = minSdkMatch[1];
  }

  // targetSdkVersion:'33'
  const targetSdkMatch = badging.match(/targetSdkVersion:'(\d+)'/);
  if (targetSdkMatch && !result.targetSdk) {
    result.targetSdk = targetSdkMatch[1];
  }
}

/**
 * Infer exported status for components with intent-filters.
 * Pre-Android 12: Components with intent-filters are implicitly exported.
 * Android 12+: Must explicitly set exported.
 */
function inferExportedStatus(result: ManifestResult): void {
  const targetSdk = parseInt(result.targetSdk) || 0;

  // For older apps (target < 31), infer exported for components with intent-filters
  if (targetSdk < 31) {
    for (const activity of result.activities) {
      if (activity.intentFilters.length > 0 && !activity.exported) {
        activity.exported = true;
      }
    }
    for (const receiver of result.receivers) {
      if (receiver.intentFilters.length > 0 && !receiver.exported) {
        receiver.exported = true;
      }
    }
  }
}

/**
 * Get the protection level for a known Android permission.
 */
function getPermissionProtectionLevel(permissionName: string): string {
  if (DANGEROUS_PERMISSIONS.has(permissionName)) {
    return "dangerous";
  }
  if (SIGNATURE_PERMISSIONS.has(permissionName)) {
    return "signature";
  }
  // Check for common patterns
  if (permissionName.includes("BIND_")) {
    return "signature";
  }
  return "normal";
}

// ============================================================================
// Security Analysis
// ============================================================================

/**
 * Analyze the parsed manifest for security issues.
 */
function analyzeSecurityIssues(manifest: ManifestResult): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  // HIGH: Debuggable flag enabled
  if (manifest.debuggable) {
    issues.push({
      severity: "high",
      issue:
        "Application is debuggable. This allows attackers to attach debuggers and inspect/modify app behavior at runtime.",
    });
  }

  // MEDIUM: allowBackup enabled (default is true)
  if (manifest.allowBackup) {
    issues.push({
      severity: "medium",
      issue:
        'Application allows backup. User data can be extracted via adb backup. Consider setting android:allowBackup="false" or implementing BackupAgent.',
    });
  }

  // HIGH: Exported activities without permission protection
  for (const activity of manifest.activities) {
    if (activity.exported && !activity.permission) {
      // Check if it's a launcher activity (generally OK to be exported)
      const isLauncher = activity.intentFilters.some(
        (f) =>
          f.action === "android.intent.action.MAIN" &&
          f.category === "android.intent.category.LAUNCHER"
      );

      if (!isLauncher) {
        issues.push({
          severity: "high",
          issue: `Exported activity without permission protection. Any app can start this activity.`,
          component: activity.name,
        });
      }
    }
  }

  // HIGH: Exported services without permission protection
  for (const service of manifest.services) {
    if (service.exported && !service.permission) {
      issues.push({
        severity: "high",
        issue: `Exported service without permission protection. Any app can bind to or start this service.`,
        component: service.name,
      });
    }
  }

  // HIGH: Exported broadcast receivers without permission protection
  for (const receiver of manifest.receivers) {
    if (receiver.exported && receiver.intentFilters.length > 0) {
      // Receivers with intent-filters for system broadcasts are often intentional
      const isSystemBroadcast = receiver.intentFilters.some((f) =>
        f.action?.startsWith("android.intent.")
      );

      if (!isSystemBroadcast) {
        issues.push({
          severity: "medium",
          issue: `Exported broadcast receiver with custom intent-filter. Verify this is intentional.`,
          component: receiver.name,
        });
      }
    }
  }

  // HIGH: Exported content providers without permission protection
  for (const provider of manifest.providers) {
    if (provider.exported) {
      if (!provider.permission && !provider.readPermission && !provider.writePermission) {
        issues.push({
          severity: "high",
          issue: `Exported content provider without permission protection. Any app can read/write data.`,
          component: provider.name,
        });
      }
    }
  }

  // MEDIUM: Dangerous permissions
  const dangerousPerms = manifest.permissions.filter((p) => p.protectionLevel === "dangerous");
  if (dangerousPerms.length > 5) {
    issues.push({
      severity: "medium",
      issue: `Application requests ${dangerousPerms.length} dangerous permissions. Review if all are necessary.`,
    });
  }

  // LOW: Target SDK below current recommended
  const targetSdk = parseInt(manifest.targetSdk) || 0;
  if (targetSdk > 0 && targetSdk < 28) {
    issues.push({
      severity: "low",
      issue: `Target SDK (${targetSdk}) is below 28. App may not enforce runtime permissions properly.`,
    });
  }

  // MEDIUM: Low minimum SDK with security implications
  const minSdk = parseInt(manifest.minSdk) || 0;
  if (minSdk > 0 && minSdk < 21) {
    issues.push({
      severity: "medium",
      issue: `Minimum SDK (${minSdk}) is below 21 (Lollipop). App may run on devices without full disk encryption and other security features.`,
    });
  }

  return issues;
}
