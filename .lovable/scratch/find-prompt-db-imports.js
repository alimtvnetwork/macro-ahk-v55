const { Project } = require('ts-morph');
const project = new Project({ tsConfigFilePath: 'standalone-scripts/macro-controller/tsconfig.node.json' });

for (const sourceFile of project.getSourceFiles()) {
    const imports = sourceFile.getImportDeclarations();
    for (const imp of imports) {
        const modSpec = imp.getModuleSpecifierValue();
        if (modSpec.includes('prompt-db')) {
            const namedImports = imp.getNamedImports();
            const dbResultImport = namedImports.find(ni => ni.getName() === 'DbResult');
            if (dbResultImport) {
                console.log('FOUND in ' + sourceFile.getFilePath());
            }
        }
    }
}
