const { Project, SyntaxKind } = require("ts-morph");

const project = new Project({
  tsConfigFilePath: "../tsconfig.json",
});

const files = [
  "src/background/handlers/project-api-handler.ts",
  "src/background/handlers/prompt-handler.ts",
  "src/background/handlers/storage-browser-handler.ts",
  "src/background/handlers/storage-handler.ts",
  "src/background/handlers/updater-handler.ts",
  "src/background/handlers/user-script-log-handler.ts"
];

for (const relPath of files) {
  const filePath = require("path").resolve(__dirname, "..", relPath);
  let sourceFile;
  try {
    sourceFile = project.addSourceFileAtPath(filePath);
  } catch (e) {
    console.error(`Error loading ${filePath}: ${e}`);
    continue;
  }
  
  if (!sourceFile) {
    console.error(`File not found: ${filePath}`);
    continue;
  }
  
  let modified = false;

  const hasServiceResult = sourceFile.getImportDeclarations().some(imp => 
    imp.getNamedImports().some(named => named.getName() === "ServiceResult")
  );
  
  if (!hasServiceResult) {
    sourceFile.addImportDeclaration({
      namedImports: ["ServiceResult"],
      moduleSpecifier: "@/utils/result-wrapper"
    });
    modified = true;
  }

  const callsToReplace = [];
  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    const expr = call.getExpression();
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const text = expr.getText();
      if (text === "db.run" || text === "db.exec" || text === "db.prepare") {
        const parent = call.getParent();
        if (parent && parent.getKind() === SyntaxKind.ArrowFunction) {
          const grandParent = parent.getParent();
          if (grandParent && grandParent.getKind() === SyntaxKind.CallExpression) {
             if (grandParent.getExpression().getText() === "ServiceResult.wrapDb") {
               continue;
             }
          }
        }
        callsToReplace.push(call);
      }
    }
  }

  // Do replacements in reverse order so replacements don't invalidate positions
  for (let i = callsToReplace.length - 1; i >= 0; i--) {
    const call = callsToReplace[i];
    const originalText = call.getText();
    call.replaceWithText(`ServiceResult.wrapDb(() => ${originalText})`);
    modified = true;
  }

  const unaryToReplace = [];
  const prefixUnaryExprs = sourceFile.getDescendantsOfKind(SyntaxKind.PrefixUnaryExpression);
  for (const expr of prefixUnaryExprs) {
    if (expr.getOperatorToken() === SyntaxKind.ExclamationToken) {
      const operand = expr.getOperand();
      if (operand.getKind() === SyntaxKind.PropertyAccessExpression) {
        const name = operand.getName();
        if (name === "ok" || name === "isSuccess") {
          unaryToReplace.push(expr);
        }
      }
    }
  }
  
  for (let i = unaryToReplace.length - 1; i >= 0; i--) {
    const expr = unaryToReplace[i];
    const operand = expr.getOperand();
    const base = operand.getExpression().getText();
    expr.replaceWithText(`${base}.isFail`);
    modified = true;
  }
  
  if (modified) {
    sourceFile.saveSync();
    console.log(`Updated ${filePath}`);
  }
}
