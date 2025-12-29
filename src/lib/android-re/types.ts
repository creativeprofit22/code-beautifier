/**
 * Shared types for Android RE features.
 */

/**
 * Represents a node in the decompiled file tree.
 */
export interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}
