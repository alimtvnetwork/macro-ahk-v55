import { logCaughtError } from "../background/bg-logger";

/**
 * Executes a function and catches any errors.
 * Logs them automatically using logCaughtError.
 */
export function wrapQuery<T>(
    tag: string,
    message: string,
    fn: () => T,
    fallback?: T
): T | undefined {
    try {
        return fn();
    } catch (error) {
        logCaughtError(tag, message, error);
        return fallback;
    }
}

export async function wrapQueryAsync<T>(
    tag: string,
    message: string,
    fn: () => Promise<T>,
    fallback?: T
): Promise<T | undefined> {
    try {
        return await fn();
    } catch (error) {
        logCaughtError(tag, message, error);
        return fallback;
    }
}
