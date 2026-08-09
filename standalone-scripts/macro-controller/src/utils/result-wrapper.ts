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
        return this.isFail;
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
}
