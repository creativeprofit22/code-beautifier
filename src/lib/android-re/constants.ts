/**
 * Shared constants for Android RE API routes.
 */

export const UPLOAD_DIR = "/tmp/android-re-uploads";
export const OUTPUT_DIR = "/tmp/android-re-output";

/** Valid job ID patterns for path validation */
export const JADX_JOB_ID_REGEX = /^jadx-\d+-[a-z0-9]+$/;
export const GHIDRA_JOB_ID_REGEX = /^ghidra-\d+-[a-z0-9]+$/;
