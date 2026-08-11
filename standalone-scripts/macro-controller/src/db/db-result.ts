import { ServiceResult } from '../utils/result-wrapper';

export class DbResult<T> extends ServiceResult<T, string> {
  constructor(ok: boolean, value?: T, error?: string) {
    super(ok, value, error);
  }

  /** Alias for `.data` – preserves call-site compatibility with legacy `.value` usage. */
  get value(): T | undefined {
    return this.data;
  }
}
