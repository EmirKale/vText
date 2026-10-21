import path from 'path';
import os from 'os';

/**
 * Validates the --smoke-test-out target path.
 * Must end with .json and resolve strictly within os.tmpdir().
 */
export function isValidSmokeTestOutPath(filePath: string | null | undefined): boolean {
  if (!filePath) return false;
  try {
    const trimmed = filePath.trim();
    if (!trimmed.toLowerCase().endsWith('.json')) return false;

    const resolved = path.resolve(trimmed);
    const resolvedTmp = path.resolve(os.tmpdir());

    // Path must be strictly inside os.tmpdir()
    const relative = path.relative(resolvedTmp, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates the --smoke-test-open target path.
 * Must end with .docx and resolve strictly within os.tmpdir().
 */
export function isValidSmokeTestOpenPath(filePath: string | null | undefined): boolean {
  if (!filePath) return false;
  try {
    const trimmed = filePath.trim();
    if (!trimmed.toLowerCase().endsWith('.docx')) return false;

    const resolved = path.resolve(trimmed);
    const resolvedTmp = path.resolve(os.tmpdir());

    // Path must be strictly inside os.tmpdir()
    const relative = path.relative(resolvedTmp, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
