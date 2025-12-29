import { rm, access } from "fs/promises";

/**
 * Sanitize filename to prevent path injection.
 * Keeps only the extension, uses "input" as base name.
 */
export function sanitizeFilename(name: string): string {
  const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
  return `input${ext}`;
}

/**
 * Check if a path exists (async).
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean up directories silently (errors are swallowed).
 */
export async function cleanupDirs(...paths: string[]): Promise<void> {
  await Promise.all(paths.map((p) => rm(p, { recursive: true, force: true }).catch(() => {})));
}
