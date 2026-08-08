# Enum Naming and Database Query Rules

These are non-negotiable architectural rules regarding Enums and Database Query wrappers.

## 1. Enum Generation and Naming
When extracting string unions or defining new Types:
- **No Inline String Unions:** Do NOT use inline string literal unions (e.g. `type Status = "pass" | "fail"`). They must be extracted to a centralized Enum.
- **Meaningful Names:** Do NOT generate numeric or hashed enum names (e.g. `Status7`, `Enum_24dffcd9`). All Enums MUST have semantically meaningful names based on their usage context (e.g. `XPathValidationEntryStatus`, `QueryFailureReason`).
- **Use Hybrid Enums:** Follow the hybrid Enum pattern: `export const EnumName = { A: "a" } as const; export type EnumName = typeof EnumName[keyof typeof EnumName];`

## 2. Database Query Wrappers (isSuccess/isFail)
- **Do not write naked DB queries:** Whenever you make a database query (in PHP/Python/TS), you MUST use a wrapper that encapsulates the query.
- **ServiceResult Return Type:** The wrapper must convert the raw query response into a type-based object that has `isSuccess` and `isFail` properties (e.g., `ServiceResult`).
- **Automatic Logging:** If the query fails, the wrapper MUST automatically log the error (following `spec/error-manage`). Callers should not have to manually write `if (!resp.isOk) logError(...)` for database calls.
- **Do not blindly apply everywhere:** Use this `ServiceResult` DB logging wrapper ONLY for API and database queries, not universally on every single function in the codebase.
