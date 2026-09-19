const fs = require('fs');
let code = fs.readFileSync('standalone-scripts/macro-controller/src/db/prompt-db.ts', 'utf8');

code = code.replace(
    "import { runSql as runSqlBridge, type SqlBridgeResp } from './sql-bridge';",
    "import { runLoggedQuery, type SqlBridgeResp } from './sql-bridge';"
);

code = code.replace(
    'type RawSqlOk = SqlBridgeResp;',
    'type RawSqlOk = import(\'../utils/result-wrapper\').ServiceResult<SqlBridgeResp, Error>;'
);

code = code.replace(
    /async function runSql\(method: RunSqlMethod, sql: string\): Promise<RawSqlOk> \{[\s\S]*?return runSqlBridge\(method, sql\);\n\}/,
    'async function runSql(method: RunSqlMethod, sql: string, contextInfo: string): Promise<RawSqlOk> {\n    return runLoggedQuery(method, sql, contextInfo);\n}'
);

// Fix call sites:
code = code.replace(/runSql\('QUERY', sql\)/g, "runSql('QUERY', sql, 'prompt-db')");
code = code.replace(/runSql\('SCHEMA', sql\)/g, "runSql('SCHEMA', sql, 'prompt-db')");
code = code.replace(/runSql\('QUERY', 'SELECT \* FROM Prompt WHERE Id = ' \+ String\(id\) \+ ' LIMIT 1'\)/g, "runSql('QUERY', 'SELECT * FROM Prompt WHERE Id = ' + String(id) + ' LIMIT 1', 'prompt-db')");
code = code.replace(/runSql\('SCHEMA', 'DELETE FROM Prompt WHERE Id = ' \+ String\(id\)\)/g, "runSql('SCHEMA', 'DELETE FROM Prompt WHERE Id = ' + String(id), 'prompt-db')");

// Fix resp.isOk to resp.isSuccess
code = code.replace(/!resp\.isOk/g, 'resp.isFail');
code = code.replace(/resp\.errorMessage \?\? 'query failed'/g, 'resp.error?.message ?? \'query failed\'');
code = code.replace(/resp\.rows/g, 'resp.data?.rows');

fs.writeFileSync('standalone-scripts/macro-controller/src/db/prompt-db.ts', code);
console.log('Refactored prompt-db.ts');
