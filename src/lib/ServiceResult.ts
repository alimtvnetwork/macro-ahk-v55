export class ServiceResult<T> {
  public readonly isSuccess: boolean;
  public readonly isFail: boolean;
  public readonly data: T | null;
  public readonly error: string | null;
  public readonly errorCode: number | null;

  private constructor(isSuccess: boolean, data: T | null, error: string | null, errorCode: number | null = null) {
    this.isSuccess = isSuccess;
    this.isFail = !isSuccess;
    this.data = data;
    this.error = error;
    this.errorCode = errorCode;
  }

  public static ok<U>(data: U): ServiceResult<U> {
    return new ServiceResult<U>(true, data, null);
  }

  public static fail<U>(error: string, errorCode: number | null = null, path?: string, missingItem?: string, reasoning?: string): ServiceResult<U> {
    // According to CODE RED rules: All file/path errors MUST include exact path, missing item, and reasoning.
    let fullErrorMessage = error;
    if (path || missingItem || reasoning) {
        fullErrorMessage += ` | Path: ${path || 'N/A'} | Missing: ${missingItem || 'N/A'} | Reason: ${reasoning || 'N/A'}`;
    }
    // Namespace Logging: Use RiseupAsiaMacroExt.Logger.error()
    if (typeof window !== 'undefined' && (window as any).RiseupAsiaMacroExt?.Logger?.error) {
      (window as any).RiseupAsiaMacroExt.Logger.error(fullErrorMessage);
    } else {
      console.error("[RiseupAsiaMacroExt.Logger] ERROR:", fullErrorMessage);
    }
    return new ServiceResult<U>(false, null, fullErrorMessage, errorCode);
  }
}
