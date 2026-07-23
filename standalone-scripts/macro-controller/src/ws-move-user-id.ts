/**
 * ws-move-user-id.ts — Extract the current user's id from the bearer JWT
 * for the v2 membership-scoped workspace-move endpoint.
 *
 * Full `sub` (not truncated). `auth-jwt-utils.decodeJwtPayload` truncates
 * to 30 chars for UI display; the move endpoint needs the full value in
 * the URL path. See mem://features/workspace-move-membership-endpoint-v2.
 */

import { logError } from './error-utils';

const JWT_PART_COUNT = 3;

function decodeBase64UrlJson(segment: string): Record<string, unknown> | null {
    try {
        const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
        const parsed: unknown = JSON.parse(atob(normalized));

        if (parsed && typeof parsed === 'object') {
            return parsed as Record<string, unknown>;
        }

        return null;
    } catch (caught: unknown) {
        logError('ws-move-user-id', 'JWT payload decode failed', caught);

        return null;
    }
}

/**
 * Extract the untruncated `sub` claim (Firebase uid) from a bearer token.
 * Returns empty string on any failure (caller decides how to surface).
 */
export function extractUserIdFromBearer(bearerToken: string): string {
    if (typeof bearerToken !== 'string' || bearerToken.length === 0) {
        return '';
    }

    const parts = bearerToken.split('.');

    if (parts.length !== JWT_PART_COUNT) {
        return '';
    }

    const payload = decodeBase64UrlJson(parts[1]);

    if (!payload) {
        return '';
    }

    const sub = payload.sub;

    return typeof sub === 'string' ? sub : '';
}