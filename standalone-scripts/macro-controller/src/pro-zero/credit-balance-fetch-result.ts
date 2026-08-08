/**
 * CreditBalanceFetchResult — discriminated union returned by the fetch client.
 *
 * Spec: spec/22-app-issues/110-macro-controller-pro-zero-credit-balance.md §6.7
 */

import { CreditBalanceFetchStatusType } from './credit-balance-fetch-status';
import type { CreditBalanceResponseTyped } from './credit-balance-response-typed';

export type CreditBalanceFetchResult =
    | { status: CreditBalanceFetchStatusType.SUCCESS; data: CreditBalanceResponseTyped }
    | { status: CreditBalanceFetchStatusType.HTTP_ERROR; httpStatus: number }
    | { status: CreditBalanceFetchStatusType.NETWORK_ERROR; reason: string }
    | { status: CreditBalanceFetchStatusType.PARSE_ERROR; reason: string };
