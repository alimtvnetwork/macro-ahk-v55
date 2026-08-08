/**
 * seed-status-store.ts (v4.405.0)
 *
 * Captures a snapshot of the last PlanTierType/Next seeding boot pass so the
 * diagnostics panel (and any future support tooling) can render the
 * exact stages that ran, their outcomes, and any error reason without
 * scraping console output.
 *
 * The snapshot is written by `initMacroDb` at the end of every boot
 * (`publishSeedStatusSnapshot`) and mirrored to `localStorage` under
 * `StorageKeyType.SeedStatusSnapshot` so a panel opened before a fresh
 * boot still has the previous run's context to show.
 *
 * Best-effort throughout: reads and writes never throw to callers.
 */

import { StorageKeyType } from '../types/storage-keys';
import { logError } from '../error-utils';
import type { OrphanRepairReport } from './repair-plan-next-orphans';
import { SeedStageStatusType, SeedReportStageType } from "../types/enums";

export interface SeedStageReport {
  readonly stage:
    SeedReportStageType;
  readonly status: SeedStageStatusType;
  /** Short machine-friendly reason when `status !== 'ok'`. */
  readonly reason?: string;
  /** Optional numeric metrics (adopted, disabled, issues, etc.). */
  readonly metrics?: Readonly<Record<string, number>>;
}

export interface SeedStatusSnapshot {
  /** ISO timestamp of when the snapshot was published. */
  readonly at: string;
  /** Overall boot outcome — `ok` iff every stage is `ok` or `skipped`. */
  readonly overall: SeedStageStatusType;
  readonly stages: readonly SeedStageReport[];
  /** Optional trailing details for the orphan-repair stage. */
  readonly orphanRepair?: OrphanRepairReport;
}

let inMemorySnapshot: SeedStatusSnapshot | null = null;

export function publishSeedStatusSnapshot(snapshot: SeedStatusSnapshot): void {
  inMemorySnapshot = snapshot;
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(StorageKeyType.SeedStatusSnapshot, JSON.stringify(snapshot));
  } catch (err) {
    logError('SeedStatusStore', 'publishSeedStatusSnapshot failed', err);
  }
}

export function readSeedStatusSnapshot(): SeedStatusSnapshot | null {
  if (inMemorySnapshot) return inMemorySnapshot;
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(StorageKeyType.SeedStatusSnapshot);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SeedStatusSnapshot;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.stages)) return null;
    inMemorySnapshot = parsed;
    return parsed;
  } catch (err) {
    logError('SeedStatusStore', 'readSeedStatusSnapshot failed', err);
    return null;
  }
}

export function clearSeedStatusSnapshot(): void {
  inMemorySnapshot = null;
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(StorageKeyType.SeedStatusSnapshot);
  } catch (err) {
    logError('SeedStatusStore', 'clearSeedStatusSnapshot failed', err);
  }
}

export function computeOverall(stages: readonly SeedStageReport[]): SeedStageStatusType {
  if (stages.some((s) => s.status === 'failed')) return 'failed';
  return 'ok';
}
