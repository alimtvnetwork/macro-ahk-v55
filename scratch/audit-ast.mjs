import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const srcDirs = ['src', 'standalone-scripts', 'chrome-extension', 'prompt-manager'].map(d => path.join(rootDir, d));
const excludeDirs = ['node_modules', 'dist', 'chunks', 'build', '.lovable', 'scratch', 'test', 'tests', '__tests__', '__mocks__'];

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!excludeDirs.some(ex => fullPath.includes(path.sep + ex + path.sep) || fullPath.endsWith(path.sep + ex))) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (fullPath.match(/\.(ts|tsx)$/) && !fullPath.endsWith('.d.ts')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });
  return arrayOfFiles;
}

let files = [];
srcDirs.forEach(d => {
    if(fs.existsSync(d)) {
        files = getAllFiles(d, files);
    }
});

const violations = [];

files.forEach(file => {
    const sourceFile = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true
    );
    const relFile = path.relative(rootDir, file).replace(/\\/g, '/');

    const lines = sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd()).line + 1;
    if (file.endsWith('.tsx') && lines > 100) {
        violations.push({ type: 'file-size', file: relFile, line: 1, message: `TSX file has ${lines} lines (>100 max)` });
    } else if (lines > 300) {
        violations.push({ type: 'file-size', file: relFile, line: 1, message: `File has ${lines} lines (>300 max)` });
    }

    function visit(node, context) {
        let newContext = { ...context };
        
        // Nested IFs
        if (ts.isIfStatement(node)) {
            if (context.inIf) {
                const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                violations.push({ type: 'nested-if', file: relFile, line: start.line + 1, message: 'Nested if statement found' });
            }
            newContext.inIf = true;
        }

        // Block clears inIf if it's not the thenStatement of an if
        if (ts.isBlock(node) && node.parent && !ts.isIfStatement(node.parent)) {
            newContext.inIf = false;
        }

        // Swallowed errors
        if (ts.isCatchClause(node)) {
            const block = node.block;
            if (block.statements.length === 0) {
                const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                violations.push({ type: 'swallowed-error', file: relFile, line: start.line + 1, message: 'Empty catch block' });
            } else {
                const text = block.getText(sourceFile);
                if (!text.includes('Logger.error') && !text.includes('throw ') && !text.includes('return ') && !text.includes('apperror.')) {
                    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    violations.push({ type: 'swallowed-error', file: relFile, line: start.line + 1, message: 'Catch block missing Logger.error or throw' });
                }
            }
        }

        // Inverted booleans
        if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
            const operandText = node.operand.getText(sourceFile);
            if (/^(is|has|can|should|will|did)[A-Z]/.test(operandText)) {
                const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                violations.push({ type: 'inverted-boolean', file: relFile, line: start.line + 1, message: `Inverted boolean: !${operandText}` });
            }
        }

        // Function size > 15
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
            if (node.body && ts.isBlock(node.body)) {
                const start = sourceFile.getLineAndCharacterOfPosition(node.body.getStart());
                const end = sourceFile.getLineAndCharacterOfPosition(node.body.getEnd());
                
                // Exclude comments and blank lines
                const bodyText = node.body.getText(sourceFile);
                const actualLines = bodyText.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('//')).length - 2;

                if (actualLines > 15) {
                    let name = '<anonymous>';
                    if (node.name) name = node.name.getText(sourceFile);
                    else if (ts.isVariableDeclaration(node.parent) && node.parent.name) name = node.parent.name.getText(sourceFile);
                    
                    violations.push({ type: 'function-size', file: relFile, line: start.line + 1, message: `Function ${name} has ${actualLines} lines (>15 max)` });
                }
            }
        }

        // Restricted Identifiers
        if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
            if (ts.isIdentifier(node.name)) {
                const text = node.name.getText(sourceFile);
                if (['arr', 'cb', 'fn', 'el', 'msg', 'ctx', 'obj', 'val'].includes(text)) {
                    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    violations.push({ type: 'restricted-identifier', file: relFile, line: start.line + 1, message: `Restricted identifier: ${text}` });
                }
            }
        }

        // any type
        if (node.kind === ts.SyntaxKind.AnyKeyword) {
            const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            violations.push({ type: 'any-type', file: relFile, line: start.line + 1, message: `Use of 'any' type` });
        }

        ts.forEachChild(node, n => visit(n, newContext));
    }

    visit(sourceFile, { inIf: false });
});

fs.writeFileSync(path.join(rootDir, 'scratch/audit-results.json'), JSON.stringify(violations, null, 2));
console.log(`Found ${violations.length} violations across ${files.length} files`);
