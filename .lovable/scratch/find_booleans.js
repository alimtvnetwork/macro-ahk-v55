const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const srcDir = path.join(__dirname, '..', '..', 'src');
const standaloneDir = path.join(__dirname, '..', '..', 'standalone-scripts');

const violations = {
  mixedOperators: [],
  complexConditions: [],
  badBooleanNames: [],
  enumEqualityChains: []
};

function checkNode(node, filePath, code) {
  if (node.type === 'LogicalExpression') {
    // Check for mixed operators
    if (node.left.type === 'LogicalExpression' && node.left.operator !== node.operator) {
      violations.mixedOperators.push(`${filePath}:${node.loc.start.line} - Mixed ${node.left.operator} and ${node.operator}`);
    }
    if (node.right.type === 'LogicalExpression' && node.right.operator !== node.operator) {
      violations.mixedOperators.push(`${filePath}:${node.loc.start.line} - Mixed ${node.operator} and ${node.right.operator}`);
    }

    // Count operands (rough check)
    let ops = 1;
    let curr = node;
    while (curr.left && curr.left.type === 'LogicalExpression') { ops++; curr = curr.left; }
    if (ops > 2) {
      violations.complexConditions.push(`${filePath}:${node.loc.start.line} - >2 logical operators`);
    }
  }

  // Check bad boolean names in variable declarations
  if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
    if (node.init && node.init.type === 'BooleanLiteral') {
      const name = node.id.name;
      if (!/^(is|has|should|can|will|did|does|allow|force|enable|disable)[A-Z]/.test(name) && !/^(is|has|should|can|will|did|does|allow|force)$/.test(name)) {
         violations.badBooleanNames.push(`${filePath}:${node.loc.start.line} - Boolean variable '${name}' lacks proper prefix`);
      }
    }
  }
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      const code = fs.readFileSync(fullPath, 'utf8');
      try {
        const ast = parser.parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx']
        });
        traverse(ast, {
          enter(path) {
            checkNode(path.node, fullPath, code);
          }
        });
      } catch (e) {
        // ignore parse errors
      }
    }
  }
}

scanDir(srcDir);
scanDir(standaloneDir);

console.log("Mixed Operators:", violations.mixedOperators.length);
console.log("Complex Conditions (>2 ops):", violations.complexConditions.length);
console.log("Bad Boolean Names:", violations.badBooleanNames.length);

fs.writeFileSync('boolean_violations.json', JSON.stringify(violations, null, 2));
