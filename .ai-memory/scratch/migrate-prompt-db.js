const fs = require('fs');

let content = fs.readFileSync('standalone-scripts/macro-controller/src/db/prompt-db.ts', 'utf8');

// 1. Change runSqlBridge to runLoggedQuery in import if needed, but it's likely runSql is imported.
content = content.replace(/import \{ runSqlBridge as runSql \} from '\.\/sql-bridge';/, "import { runSqlBridge as runSql, runLoggedQuery } from './sql-bridge';");
content = content.replace(/import \{ runSqlBridge \} from '\.\/sql-bridge';/, "import { runSqlBridge, runLoggedQuery } from './sql-bridge';");

// 2. Replace runSql calls
content = content.replace(/runSql\('QUERY', sql\)/g, "runLoggedQuery('QUERY', sql, 'prompt-db')");
content = content.replace(/runSql\('SCHEMA', sql\)/g, "runLoggedQuery('SCHEMA', sql, 'prompt-db')");
content = content.replace(/runSql\('SCHEMA', 'DELETE(.*?)\)/g, "runLoggedQuery('SCHEMA', 'DELETE$1, 'prompt-db')");

// 3. Replace the response fields
content = content.replace(/!resp\.isOk/g, "resp.isFail");
content = content.replace(/resp\.errorMessage \?\? 'query failed'/g, "resp.error?.message ?? 'query failed'");
content = content.replace(/resp\.errorMessage \?\? 'delete failed'/g, "resp.error?.message ?? 'delete failed'");
content = content.replace(/resp\.errorMessage \?\? 'write failed'/g, "resp.error?.message ?? 'write failed'");
content = content.replace(/resp\.errorMessage \?\? 'insert failed'/g, "resp.error?.message ?? 'insert failed'");
content = content.replace(/resp\.rows/g, "resp.data?.rows");

fs.writeFileSync('standalone-scripts/macro-controller/src/db/prompt-db.ts', content);
console.log('Migrated prompt-db to runLoggedQuery');
