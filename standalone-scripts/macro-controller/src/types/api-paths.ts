import { DomainConstants } from "../constants/domain";
/**
 * API path and URL constants.
 */
export const ApiPathType = {
  UserWorkspaces: '/user/workspaces',
  UserWorkspacesSlash: '/user/workspaces/',
  CreditApiBase: DomainConstants.API_URL,
} as const;
export type ApiPathType = typeof ApiPathType[keyof typeof ApiPathType];
