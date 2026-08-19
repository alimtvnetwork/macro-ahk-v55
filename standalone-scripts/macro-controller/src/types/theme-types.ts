/**
 * Macro Controller — Theme Types and Helpers
 *
 * Phase 8: Moved theme helper/validation functions from config-validator.ts.
 */

export const ThemePresetType = {
  DARK: 'dark',
  LIGHT: 'light',
} as const;

export type ThemePresetType = typeof ThemePresetType[keyof typeof ThemePresetType];

export function isInvalidThemePreset(preset: string | undefined): boolean {
  return (
    !!preset &&
    preset !== ThemePresetType.DARK &&
    preset !== ThemePresetType.LIGHT
  );
}
