/**
 * error-utils.test.ts — type guards + logger delegation coverage.
 *
 * Verifies that:
 *   1. `toErrorMessage` normalizes every caught-value shape.
 *   2. The internal SDK-logger shape guard rejects malformed namespaces
 *      and only accepts an object with all 5 required functions.
 *   3. Each log helper (`logError`, `logWarn`, `logDebug`, `logConsole`,
 *      `logStackTrace`) delegates to `window.RiseupAsiaMacroExt.Logger`
 *      when present, and falls back to the matching `console.*` method
 *      (with the `[RiseupAsia] [scope] ` prefix) when the namespace is
 *      missing, `null`, or shape-invalid.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    logConsole,
    logDebug,
    logError,
    logStackTrace,
    logWarn,
    toErrorMessage,
} from '../error-utils';

type LoggerSurface = {
    error: (...a: unknown[]) => void;
    warn: (...a: unknown[]) => void;
    debug: (...a: unknown[]) => void;
    console: (...a: unknown[]) => void;
    stackTrace: (...a: unknown[]) => void;
};

function makeLogger(): LoggerSurface {
    return {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        console: vi.fn(),
        stackTrace: vi.fn(),
    };
}

function setNamespace(value: unknown): void {
    (window as unknown as Record<string, unknown>).RiseupAsiaMacroExt = value;
}

function clearNamespace(): void {
    delete (window as unknown as Record<string, unknown>).RiseupAsiaMacroExt;
}

describe('toErrorMessage', () => {
    it('extracts message from Error instance', () => {
        expect(toErrorMessage(new Error('boom'))).toBe('boom');
    });
    it('returns string values verbatim', () => {
        expect(toErrorMessage('plain')).toBe('plain');
    });
    it('stringifies non-null objects', () => {
        expect(toErrorMessage({ toString: () => 'obj' })).toBe('obj');
    });
    it('stringifies numbers and booleans', () => {
        expect(toErrorMessage(42)).toBe('42');
        expect(toErrorMessage(false)).toBe('false');
    });
    it('returns fallback for null and undefined', () => {
        expect(toErrorMessage(null)).toBe('Unknown error');
        expect(toErrorMessage(undefined)).toBe('Unknown error');
    });
});

describe('logger delegation — happy path', () => {
    let logger: LoggerSurface;

    beforeEach(() => {
        logger = makeLogger();
        setNamespace({ Logger: logger });
    });
    afterEach(() => {
        clearNamespace();
        vi.restoreAllMocks();
    });

    it('logError delegates to Logger.error with scope/message/error', () => {
        const err = new Error('x');
        logError('Scope', 'msg', err);
        expect(logger.error).toHaveBeenCalledWith('Scope', 'msg', err);
    });
    it('logWarn delegates to Logger.warn', () => {
        logWarn('S', 'w');
        expect(logger.warn).toHaveBeenCalledWith('S', 'w');
    });
    it('logDebug delegates to Logger.debug', () => {
        logDebug('S', 'd');
        expect(logger.debug).toHaveBeenCalledWith('S', 'd');
    });
    it('logConsole forwards variadic args to Logger.console', () => {
        logConsole('S', 'c', 1, 'two', { k: 3 });
        expect(logger.console).toHaveBeenCalledWith('S', 'c', 1, 'two', { k: 3 });
    });
    it('logStackTrace delegates to Logger.stackTrace', () => {
        const err = new Error('trace');
        logStackTrace('S', 't', err);
        expect(logger.stackTrace).toHaveBeenCalledWith('S', 't', err);
    });
});

describe('logger fallback — namespace missing or malformed', () => {
    let consoleError: ReturnType<typeof vi.spyOn>;
    let consoleWarn: ReturnType<typeof vi.spyOn>;
    let consoleDebug: ReturnType<typeof vi.spyOn>;
    let consoleLog: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});
        consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
        clearNamespace();
        vi.restoreAllMocks();
    });

    it('falls back to console.error when RiseupAsiaMacroExt is undefined', () => {
        clearNamespace();
        logError('Scope', 'oops');
        expect(consoleError).toHaveBeenCalledWith('[RiseupAsia] [Scope] oops');
    });
    it('includes the error argument in the fallback call', () => {
        clearNamespace();
        const err = new Error('fail');
        logError('Scope', 'oops', err);
        expect(consoleError).toHaveBeenCalledWith('[RiseupAsia] [Scope] oops', err);
    });
    it('falls back when namespace is null', () => {
        setNamespace(null);
        logWarn('Scope', 'w');
        expect(consoleWarn).toHaveBeenCalledWith('[RiseupAsia] [Scope] w');
    });
    it('falls back when Logger is missing entirely', () => {
        setNamespace({});
        logDebug('Scope', 'd');
        expect(consoleDebug).toHaveBeenCalledWith('[RiseupAsia] [Scope] d');
    });
    it('falls back when Logger is not an object', () => {
        setNamespace({ Logger: 'not-a-logger' });
        logConsole('Scope', 'c');
        expect(consoleLog).toHaveBeenCalledWith('[RiseupAsia] [Scope] c');
    });
    it('falls back when Logger is missing required methods', () => {
        // has `error` but no `warn/debug/console/stackTrace` — shape guard rejects.
        setNamespace({ Logger: { error: () => {} } });
        logError('Scope', 'partial');
        expect(consoleError).toHaveBeenCalledWith('[RiseupAsia] [Scope] partial');
    });
    it('falls back when a required method is not a function', () => {
        setNamespace({
            Logger: {
                error: () => {},
                warn: () => {},
                debug: 'nope',
                console: () => {},
                stackTrace: () => {},
            },
        });
        logDebug('Scope', 'd');
        expect(consoleDebug).toHaveBeenCalledWith('[RiseupAsia] [Scope] d');
    });
    it('logConsole fallback forwards variadic args to console.log', () => {
        clearNamespace();
        logConsole('Scope', 'msg', 1, 'two');
        expect(consoleLog).toHaveBeenCalledWith('[RiseupAsia] [Scope] msg', 1, 'two');
    });
    it('logStackTrace fallback emits a stack string on console.error', () => {
        clearNamespace();
        const err = new Error('trace');
        logStackTrace('Scope', 'boom', err);
        expect(consoleError).toHaveBeenCalledTimes(1);
        const arg = consoleError.mock.calls[0]?.[0];
        expect(typeof arg).toBe('string');
        expect(arg).toContain('[RiseupAsia] [Scope] boom');
    });
});
