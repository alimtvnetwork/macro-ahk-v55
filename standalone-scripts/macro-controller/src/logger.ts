/**
 * Canonical logging entry point for the macro-controller module.
 *
 * ALL consumers MUST import logging symbols from `./logger` (or the
 * appropriate `../logger`, `../../logger`, ...) path. Do NOT import
 * from `./logging` directly: that path is reserved as the internal
 * implementation file and is enforced by
 * `scripts/check-canonical-logger-imports.mjs` in CI.
 *
 * Rationale: prevents `TS2307` drift and filename-guessing between
 * `logger` vs `logging`. See conversation log entries around v4.400+.
 */
export * from './logging';
