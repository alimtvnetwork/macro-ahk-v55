import { ServiceResult } from "../../utils/result-wrapper";
import { logBgError, BgLogTag } from "../bg-logger";

export async function withQueryLogging<T>(
    tag: BgLogTag,
    operationName: string,
    queryFn: () => Promise<T> | T
): Promise<ServiceResult<T, Error>> {
    try {
        const result = await queryFn();

        return new ServiceResult<T, Error>(true, result, undefined);
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        
        logBgError(
            tag,
            `DB_ERROR_${operationName.replace(/\s+/g, "_").toUpperCase()}`,
            `Database query failed during ${operationName}: ${error.message}`,
            error,
            { operationName }
        );

        return new ServiceResult<T, Error>(false, undefined, error);
    }
}
