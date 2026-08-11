import { type Page } from '@playwright/test';

/**
 * Seeds prompt entries into IndexedDB `JsonCopy` ensuring they are marked as user-added
 * (`isDefault: false`). This is required for export tests, as default-flagged rows
 * are filtered out by `filterUserAddedEntries`.
 */
export async function seedUserAddedEntries(page: Page, entries: Record<string, unknown>[]): Promise<void> {
  const seededEntries = entries.map(e => ({
    ...e,
    isDefault: false,
  }));

  await page.evaluate(async (payload) => {
    interface Api {
      writeJsonCopy: (entries: unknown[]) => Promise<void>;
    }
    const api = (window as unknown as { __roundtrip: Api }).__roundtrip;
    await api.writeJsonCopy(payload);
  }, seededEntries);
}
