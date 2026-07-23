/** Shared logger shim for Lovable standalone scripts. */

function getNamespace(): RiseupAsiaMacroExtNamespace | undefined {
    if (typeof RiseupAsiaMacroExt === "undefined") {
        return undefined;
    }

    return RiseupAsiaMacroExt;
}

export function logLovableStandaloneError(
    functionName: string,
    message: string,
    error?: CaughtError,
): void {
    const logger = getNamespace()?.Logger;

    if (logger !== undefined) {
        logger.error(functionName, message, error);

        return;
    }

    if (error !== undefined) {
        console.error(`[${functionName}] ${message}`, error);

        return;
    }

    console.error(`[${functionName}] ${message}`);
}