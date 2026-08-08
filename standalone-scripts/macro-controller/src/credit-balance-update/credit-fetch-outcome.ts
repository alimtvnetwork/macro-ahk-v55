/** Outcomes for one credit-balance resolution attempt. */
export const enum CreditFetchOutcomeType {
    InlineHit = 'InlineHit',
    ApiHit = 'ApiHit',
    ApiCacheHit = 'ApiCacheHit',
    Timeout = 'Timeout',
    HttpError = 'HttpError',
    AuthError = 'AuthError',
    Skipped = 'Skipped',
    ParseError = 'ParseError',
    MissingToken = 'MissingToken',
}
