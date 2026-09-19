const { Project } = require('ts-morph');
const project = new Project({ tsConfigFilePath: 'standalone-scripts/macro-controller/tsconfig.json' });

for (const sourceFile of project.getSourceFiles()) {
    if (sourceFile.getFilePath().endsWith('db-result.ts')) continue;
    let modified = false;

    // Find imports from something ending in /prompt-db
    const imports = sourceFile.getImportDeclarations();
    for (const imp of imports) {
        const modSpec = imp.getModuleSpecifierValue();
        if (modSpec.endsWith('/prompt-db') || modSpec === './prompt-db') {
            const namedImports = imp.getNamedImports();
            const dbResultImport = namedImports.find(ni => ni.getName() === 'DbResult');
            if (dbResultImport) {
                // Remove DbResult from the named imports
                dbResultImport.remove();
                
                // If it was the only one, the import might be empty now. If so, remove the whole import
                if (imp.getNamedImports().length === 0) {
                    imp.remove();
                }

                // Add a new import for DbResult from /db-result
                const newModSpec = modSpec.replace('/prompt-db', '/db-result');
                sourceFile.addImportDeclaration({
                    namedImports: ['DbResult'],
                    moduleSpecifier: newModSpec
                });
                modified = true;
            }
        }
    }

    if (modified) {
        sourceFile.saveSync();
        console.log('Fixed imports in ' + sourceFile.getFilePath());
    }
}
