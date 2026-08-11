import { Project, SyntaxKind, CallExpression, PrefixUnaryExpression, PropertyAccessExpression } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "./tsconfig.json",
});

const files = [
  "src/background/handlers/project-api-handler.ts",
  "src/background/handlers/prompt-handler.ts",
  "src/background/handlers/storage-browser-handler.ts",
  "src/background/handlers/storage-handler.ts",
  "src/background/handlers/updater-handler.ts",
  "src/background/handlers/user-script-log-handler.ts"
];

for (const filePath of files) {
  const sourceFile = project.getSourceFile(filePath);
  if (!sourceFile) {
    console.log(`ERROR: File not found: ${filePath}`);
    continue;
  }
  
  let modified = false;

  // Ensure import { ServiceResult } from '@/utils/result-wrapper';
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

  // Find all db.run, db.exec, db.prepare calls
  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    const expr = call.getExpression();
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = expr as PropertyAccessExpression;
      const text = propAccess.getText();
      if (text === "db.run" || text === "db.exec" || text === "db.prepare") {
        // Wrap with ServiceResult.wrapDb(() => ...)
        // Check if it's already wrapped
        const parent = call.getParent();
        if (parent && parent.getKind() === SyntaxKind.ArrowFunction) {
          const grandParent = parent.getParent();
          if (grandParent && grandParent.getKind() === SyntaxKind.CallExpression) {
            const grandParentCall = grandParent as CallExpression;
            if (grandParentCall.getExpression().getText() === "ServiceResult.wrapDb") {
              continue; // already wrapped
            }
          }
        }
        
        const originalText = call.getText();
        call.replaceWithText(`ServiceResult.wrapDb(() => ${originalText})`);
        modified = true;
      }
    }
  }

  // Find all !resp.ok or !result.isSuccess
  const prefixUnaryExprs = sourceFile.getDescendantsOfKind(SyntaxKind.PrefixUnaryExpression);
  for (const expr of prefixUnaryExprs) {
    if (expr.getOperatorToken() === SyntaxKind.ExclamationToken) {
      const operand = expr.getOperand();
      if (operand.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = operand as PropertyAccessExpression;
        const name = propAccess.getName();
        if (name === "ok" || name === "isSuccess") {
          const base = propAccess.getExpression().getText();
          expr.replaceWithText(`${base}.isFail`);
          modified = true;
        }
      }
    }
  }
  
  if (modified) {
    sourceFile.saveSync();
    console.log(`Updated ${filePath}`);
  }
}
