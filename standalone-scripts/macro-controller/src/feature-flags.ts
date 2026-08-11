/**
 * Feature flags (Issue 124 §6, plus future flags).
 *
 * Source of truth: an in-memory map seeded with safe defaults. Production
 * overrides arrive via `window.marco.featureFlags` (set by the background
 * service worker on boot). Reads are synchronous and side-effect-free.
 *
 * Standards:
 *   - mem://standards/unknown-usage-policy — no implicit any/unknown leakage.
 *   - mem://constraints/no-retry-policy — flag reads are single-shot.
 */

export enum FeatureFlagNameType { LoopRunStateGateEnabled = 'Loop.RunStateGate.Enabled' };

const DEFAULTS: Readonly<Record<FeatureFlagNameType, boolean>> = {
  // Enabled in v3.37.0 (Issue 124 §6). Run-state gate + queue pause/resume
  // now wrap every adjacent move. STOP button is never clicked.
  'Loop.RunStateGate.Enabled': true,
};

interface FlagBridge {
    featureFlags?: Partial<Record<FeatureFlagNameType, boolean>>;
}

function readOverride(flag: FeatureFlagNameType): boolean | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const sdk = (window as unknown as { marco?: FlagBridge }).marco;
  if (!sdk || !sdk.featureFlags) {
    return null;
  }

  const override = sdk.featureFlags[flag];
  if (override === true || override === false) {
    return override;
  }

  return null;
}

export function isFeatureFlagEnabled(flag: FeatureFlagNameType): boolean {
  const override = readOverride(flag);
  if (override !== null) {
    return override;
  }

  return DEFAULTS[flag];
}

/** Test-only: seed an override on window.marco.featureFlags. */
export function setFeatureFlagOverrideForTests(flag: FeatureFlagNameType, value: boolean | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const root = window as unknown as { marco?: FlagBridge };
  const sdk = root.marco ?? {};
  const flags = sdk.featureFlags ?? {};
  if (value === null) {
    delete flags[flag];
  } else {
    flags[flag] = value;
  }

  sdk.featureFlags = flags;
  root.marco = sdk;
}
