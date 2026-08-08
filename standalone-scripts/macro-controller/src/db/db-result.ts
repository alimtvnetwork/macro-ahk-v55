import { ServiceResult } from '../utils/result-wrapper';

export class DbResult<T> extends ServiceResult<T, string> {
    constructor(ok: boolean, value?: T, error?: string) {
        super(ok, value, error);
    }
    get ok() { return this.ok; }
    get value() { return this.data; }
}
