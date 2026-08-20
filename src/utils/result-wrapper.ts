export class ServiceResult<T = unknown, E = unknown> {
  constructor(
        public readonly ok: boolean,
        public readonly data?: T,
        public readonly error?: E
  ) {}

  get isSuccess(): boolean {
    return this.ok;
  }

  get isFail(): boolean {
    return !this.ok;
  }

  static wrapFetch(response: Response): ServiceResult<Response, Error> {
    return new ServiceResult(
      response.ok,
      response.ok ? response : undefined,
      response.ok ? undefined : new Error(response.statusText)
    );
  }

  static wrap<T extends { ok: boolean; error?: unknown }>(res: T): ServiceResult<T, unknown> {
    return new ServiceResult(res.ok, res, res.error);
  }

  static wrapDb<T>(dbAction: () => T, queryName = "Database Query"): ServiceResult<T, unknown> {
    try {
      const result = dbAction();

      return new ServiceResult<T, unknown>(true, result);
    } catch (e) {
      const glob = globalThis as unknown as { RiseupAsiaMacroExt?: { Logger?: { error?: (scope: string, message: string, err: unknown) => void } } };

      if (typeof glob !== "undefined" && glob.RiseupAsiaMacroExt?.Logger?.error) {
        glob.RiseupAsiaMacroExt.Logger.error("SQLITE", `[DB] ${queryName} failed`, e);
      } else {
        // eslint-disable-next-line no-restricted-syntax
        console.error(`[Marco] DB Error: ${queryName}`, e);
      }

      return new ServiceResult<T, unknown>(false, undefined, e);
    }
  }
}
