/**
 * UJ-B1.1 - src/utils/backup.ts
 * ==============================
 * Project backup and restore utilities for data integrity during project updates.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: None (utility module)
 *
 * This module provides functions to:
 * - Create timestamped backups of project folders
 * - Restore projects from backup archives
 * - List available backups
 * - Manage backup retention
 */

/**
 * Backup metadata structure.
 */
export interface BackupMetadata {
  /** Unique backup identifier */
  id: string;
  /** Original project path */
  projectPath: string;
  /** Project name */
  projectName: string;
  /** Backup timestamp (ISO string) */
  timestamp: string;
  /** Backup file path */
  backupPath: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Backup version format */
  version: string;
  /** Optional description/note */
  description?: string;
}

/**
 * Backup result.
 */
export interface BackupResult {
  success: boolean;
  metadata?: BackupMetadata;
  error?: string;
}

/**
 * Restore result.
 */
export interface RestoreResult {
  success: boolean;
  restoredPath?: string;
  error?: string;
}

/**
 * Backup options.
 */
export interface BackupOptions {
  /** Custom backup directory (default: project/backups/) */
  backupDir?: string;
  /** Include description in backup metadata */
  description?: string;
  /** Exclude patterns (glob patterns to skip) */
  excludePatterns?: string[];
}

/**
 * Restore options.
 */
export interface RestoreOptions {
  /** Target directory for restore (default: original path) */
  targetDir?: string;
  /** Overwrite existing files */
  overwrite?: boolean;
}

/**
 * Default backup directory name.
 */
const DEFAULT_BACKUP_DIR = "backups";

/**
 * Backup file extension.
 */
const BACKUP_EXTENSION = ".zip";

/**
 * Backup version format.
 */
const BACKUP_VERSION = "1.0";

/**
 * Default exclude patterns for backups.
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  "node_modules/**",
  ".git/**",
  "dist/**",
  "build/**",
  "__pycache__/**",
  "*.pyc",
  ".env.local",
  "backups/**",
];

/**
 * Generate a unique backup ID.
 */
const generateBackupId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `backup_${timestamp}_${random}`;
};

/**
 * Generate backup filename with timestamp.
 */
const generateBackupFilename = (projectName: string): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${timestamp}_${safeName}${BACKUP_EXTENSION}`;
};

/**
 * Create a backup of a project folder.
 *
 * In a real Tauri application, this would use Tauri's fs and zip APIs.
 * This implementation provides the interface and mock behavior.
 *
 * @param projectPath - Path to the project folder to backup
 * @param options - Backup options
 * @returns Backup result with metadata
 *
 * @example
 * ```typescript
 * const result = await createBackup("C:/Projects/my-app", {
 *   description: "Before major refactoring"
 * });
 * if (result.success) {
 *   console.log("Backup created:", result.metadata?.backupPath);
 * }
 * ```
 */
export async function createBackup(
  projectPath: string,
  options: BackupOptions = {}
): Promise<BackupResult> {
  try {
    const {
      backupDir = `${projectPath}/${DEFAULT_BACKUP_DIR}`,
      description,
      excludePatterns = DEFAULT_EXCLUDE_PATTERNS,
    } = options;

    // Extract project name from path
    const pathParts = projectPath.replace(/\\/g, "/").split("/");
    const projectName = pathParts[pathParts.length - 1] || "project";

    // Generate backup filename and path
    const backupFilename = generateBackupFilename(projectName);
    const backupPath = `${backupDir}/${backupFilename}`;

    // In real implementation, would:
    // 1. Ensure backup directory exists
    // 2. Create ZIP archive of project folder
    // 3. Apply exclude patterns
    // 4. Write metadata file inside archive
    // 5. Return actual file size

    // Mock implementation - simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    const metadata: BackupMetadata = {
      id: generateBackupId(),
      projectPath,
      projectName,
      timestamp: new Date().toISOString(),
      backupPath,
      sizeBytes: 0, // Would be actual file size
      version: BACKUP_VERSION,
      description,
    };

    // Log backup action (would be actual file operation in Tauri)
    console.log("[Backup] Created backup:", {
      path: backupPath,
      excludePatterns,
      metadata,
    });

    return {
      success: true,
      metadata,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Backup] Failed to create backup:", errorMessage);
    return {
      success: false,
      error: `Failed to create backup: ${errorMessage}`,
    };
  }
}

/**
 * Restore a project from a backup archive.
 *
 * @param backupPath - Path to the backup ZIP file
 * @param options - Restore options
 * @returns Restore result
 *
 * @example
 * ```typescript
 * const result = await restoreBackup("C:/Projects/my-app/backups/2024-01-15_my-app.zip", {
 *   targetDir: "C:/Projects/my-app-restored"
 * });
 * if (result.success) {
 *   console.log("Restored to:", result.restoredPath);
 * }
 * ```
 */
export async function restoreBackup(
  backupPath: string,
  options: RestoreOptions = {}
): Promise<RestoreResult> {
  try {
    const { targetDir, overwrite = false } = options;

    // In real implementation, would:
    // 1. Verify backup file exists
    // 2. Read metadata from archive
    // 3. Determine target directory (original or specified)
    // 4. Extract archive contents
    // 5. Handle file conflicts based on overwrite option

    // Mock implementation - simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Determine restore path
    const restorePath = targetDir || extractProjectPathFromBackup(backupPath);

    // Log restore action (would be actual file operation in Tauri)
    console.log("[Backup] Restoring backup:", {
      from: backupPath,
      to: restorePath,
      overwrite,
    });

    return {
      success: true,
      restoredPath: restorePath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Backup] Failed to restore backup:", errorMessage);
    return {
      success: false,
      error: `Failed to restore backup: ${errorMessage}`,
    };
  }
}

/**
 * List available backups for a project.
 *
 * @param projectPath - Path to the project folder
 * @param backupDir - Optional custom backup directory
 * @returns Array of backup metadata sorted by timestamp (newest first)
 *
 * @example
 * ```typescript
 * const backups = await listBackups("C:/Projects/my-app");
 * console.log(`Found ${backups.length} backups`);
 * ```
 */
export async function listBackups(
  projectPath: string,
  backupDir?: string
): Promise<BackupMetadata[]> {
  try {
    const targetDir = backupDir || `${projectPath}/${DEFAULT_BACKUP_DIR}`;

    // In real implementation, would:
    // 1. List files in backup directory
    // 2. Filter for .zip files
    // 3. Read metadata from each archive
    // 4. Sort by timestamp

    // Mock implementation
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Return empty array for mock (would return actual backups)
    console.log("[Backup] Listing backups in:", targetDir);
    return [];
  } catch (error) {
    console.error("[Backup] Failed to list backups:", error);
    return [];
  }
}

/**
 * Delete a backup file.
 *
 * @param backupPath - Path to the backup file to delete
 * @returns True if deletion was successful
 *
 * @example
 * ```typescript
 * const deleted = await deleteBackup("C:/Projects/my-app/backups/old-backup.zip");
 * ```
 */
export async function deleteBackup(backupPath: string): Promise<boolean> {
  try {
    // In real implementation, would delete the file
    await new Promise((resolve) => setTimeout(resolve, 50));
    console.log("[Backup] Deleted backup:", backupPath);
    return true;
  } catch (error) {
    console.error("[Backup] Failed to delete backup:", error);
    return false;
  }
}

/**
 * Clean up old backups, keeping only the specified number of most recent.
 *
 * @param projectPath - Path to the project folder
 * @param keepCount - Number of recent backups to keep (default: 5)
 * @returns Number of backups deleted
 *
 * @example
 * ```typescript
 * const deleted = await cleanupOldBackups("C:/Projects/my-app", 3);
 * console.log(`Cleaned up ${deleted} old backups`);
 * ```
 */
export async function cleanupOldBackups(
  projectPath: string,
  keepCount: number = 5
): Promise<number> {
  try {
    const backups = await listBackups(projectPath);

    if (backups.length <= keepCount) {
      return 0;
    }

    // Sort by timestamp (newest first) and get backups to delete
    const sortedBackups = [...backups].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const toDelete = sortedBackups.slice(keepCount);
    let deletedCount = 0;

    for (const backup of toDelete) {
      const success = await deleteBackup(backup.backupPath);
      if (success) {
        deletedCount++;
      }
    }

    console.log("[Backup] Cleaned up", deletedCount, "old backups");
    return deletedCount;
  } catch (error) {
    console.error("[Backup] Failed to cleanup backups:", error);
    return 0;
  }
}

/**
 * Verify backup integrity.
 *
 * @param backupPath - Path to the backup file
 * @returns True if backup is valid and not corrupted
 */
export async function verifyBackup(backupPath: string): Promise<boolean> {
  try {
    // In real implementation, would:
    // 1. Open ZIP file
    // 2. Verify checksum
    // 3. Check metadata is present
    // 4. Optionally verify file contents

    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log("[Backup] Verified backup:", backupPath);
    return true;
  } catch (error) {
    console.error("[Backup] Backup verification failed:", error);
    return false;
  }
}

/**
 * Extract project path from backup filename (helper function).
 */
function extractProjectPathFromBackup(backupPath: string): string {
  // Parse backup path to extract original project location
  // Format: /path/to/project/backups/timestamp_projectname.zip
  const parts = backupPath.replace(/\\/g, "/").split("/");
  const backupsIndex = parts.indexOf(DEFAULT_BACKUP_DIR);

  if (backupsIndex > 0) {
    return parts.slice(0, backupsIndex).join("/");
  }

  // Fallback: return parent of backup file
  return parts.slice(0, -1).join("/");
}

/**
 * Export backup utilities as default object.
 */
export default {
  createBackup,
  restoreBackup,
  listBackups,
  deleteBackup,
  cleanupOldBackups,
  verifyBackup,
};
