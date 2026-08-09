import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const promptDbPath = path.join(REPO_ROOT, 'standalone-scripts/macro-controller/src/db/prompt-db.ts');
if (fs.existsSync(promptDbPath)) {
    let content = fs.readFileSync(promptDbPath, 'utf-8');
    content = content.replace(/export type DbResult<T> = ServiceResult<T, string>;\n/g, '');
    content = content.replace(/MethodEnum1/g, 'MethodEnum');
    fs.writeFileSync(promptDbPath, content, 'utf-8');
}

const promptRevDbPath = path.join(REPO_ROOT, 'standalone-scripts/macro-controller/src/db/prompt-revision-db.ts');
if (fs.existsSync(promptRevDbPath)) {
    let content = fs.readFileSync(promptRevDbPath, 'utf-8');
    content = content.replace(/export type DbResult<T> = ServiceResult<T, string>;\n/g, '');
    fs.writeFileSync(promptRevDbPath, content, 'utf-8');
}

const sqlBridgePath = path.join(REPO_ROOT, 'standalone-scripts/macro-controller/src/db/sql-bridge.ts');
if (fs.existsSync(sqlBridgePath)) {
    let content = fs.readFileSync(sqlBridgePath, 'utf-8');
    content = content.replace(/MethodEnum1/g, 'MethodEnum');
    fs.writeFileSync(sqlBridgePath, content, 'utf-8');
}

const seedPlanNextPath = path.join(REPO_ROOT, 'standalone-scripts/macro-controller/src/seed/seed-plan-next.ts');
if (fs.existsSync(seedPlanNextPath)) {
    let content = fs.readFileSync(seedPlanNextPath, 'utf-8');
    content = content.replace(/MethodEnum1/g, 'MethodEnum');
    fs.writeFileSync(seedPlanNextPath, content, 'utf-8');
}

const apiPathsPath = path.join(REPO_ROOT, 'standalone-scripts/macro-controller/src/types/api-paths.ts');
if (fs.existsSync(apiPathsPath)) {
    let content = fs.readFileSync(apiPathsPath, 'utf-8');
    content = content.replace(/export enum ApiPathType \{[\s\S]*?\}/, `export const ApiPathType = {
  UserWorkspaces: '/user/workspaces',
  UserWorkspacesSlash: '/user/workspaces/',
  CreditApiBase: DomainConstants.API_URL,
} as const;
export type ApiPathType = typeof ApiPathType[keyof typeof ApiPathType];`);
    fs.writeFileSync(apiPathsPath, content, 'utf-8');
}

const dbResultPath = path.join(REPO_ROOT, 'standalone-scripts/macro-controller/src/db/db-result.ts');
if (fs.existsSync(dbResultPath)) {
    let content = fs.readFileSync(dbResultPath, 'utf-8');
    content = content.replace(/get ok\(\) \{ return this\.ok; \}\n/g, '');
    content = content.replace(/get value\(\) \{ return this\.data; \}\n/g, '');
    fs.writeFileSync(dbResultPath, content, 'utf-8');
}

console.log("Fixes applied");
