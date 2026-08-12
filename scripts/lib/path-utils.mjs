// Unified path converter for cross-platform compatibility

import { relative } from 'node:path';

/**
 * Normalizes a path to always use POSIX forward slashes, regardless of the platform.
 * This ensures consistent paths in JSON audits and generated files.
 */
export function toPosixPath(p) {
  return p.replaceAll('\\', '/');
}

/**
 * Returns a relative path from `root` to `p`, normalized to use POSIX forward slashes.
 */
export function toRelativePosixPath(root, p) {
  return toPosixPath(relative(root, p));
}
