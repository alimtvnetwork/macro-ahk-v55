import { Project, SyntaxKind, TypeGuards, Node } from 'ts-morph';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: "d:/work/macro-ahk/tsconfig.json",
});
project.addSourceFilesAtPaths("d:/work/macro-ahk/standalone-scripts/macro-controller/src/**/*.ts");

function getRelativeImportPath(sourceFile, targetPath) {
  let rel = path.relative(path.dirname(sourceFile.getFilePath()), targetPath).replace(/\\/g, '/');

  if (!rel.startsWith('.')) {
    rel = './' + rel;
  }

  return rel.replace('.ts', '');
}

const targetPath = "d:/work/macro-ahk/standalone-scripts/macro-controller/src/utils/result-wrapper.ts";
const modifiedFiles = new Set();

for (const sourceFile of project.getSourceFiles()) {
  if (sourceFile.getFilePath().includes('result-wrapper.ts')) {
    continue;
  }
    
  let modified = false;

  // 1. Wrap fetches: `const resp = await fetch(...)` -> `const resp = ServiceResult.wrapFetch(await fetch(...))`
  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    if (call.getExpression().getText() === 'fetch') {
      const parent = call.getParent();

      if (parent && parent.getKind() === SyntaxKind.AwaitExpression) {
        // Check if it's already wrapped
        const grandParent = parent.getParent();

        if (grandParent && grandParent.getKind() === SyntaxKind.CallExpression && grandParent.getExpression().getText() === 'ServiceResult.wrapFetch') {
          continue;
        }

        parent.replaceWithText(`ServiceResult.wrapFetch(${parent.getText()})`);
        modified = true;
      } else if (parent && parent.getKind() === SyntaxKind.VariableDeclaration) {
        // without await? Not typical for fetch, but if it exists, leave it or wrap it
      }
    }
  }

  // 2. Wrap custom Service calls returning {ok: boolean} like seedPlanNextPrompts
  // Not easy to do automatically for all functions, but we can wrap where we see them, or we can just change `.isSuccess` to `.isSuccess` everywhere.
  // Let's replace `.isSuccess` accesses on wrapped objects.
  const propAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  for (const access of propAccesses) {
    if (access.getName() === 'ok') {
      // Check if it's negated
      const parent = access.getParent();

      if (parent && parent.getKind() === SyntaxKind.PrefixUnaryExpression && parent.getOperatorToken() === SyntaxKind.ExclamationToken) {
        // !resp.isSuccess -> !resp.isSuccess
        parent.replaceWithText(`${access.getExpression().getText()}.isFail`);
        modified = true;
      } else {
        // resp.isSuccess -> resp.isSuccess
        // Skip assignments
        if (parent && parent.getKind() === SyntaxKind.BinaryExpression && parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken && parent.getLeft() === access) {
          continue; // Skip `obj.isSuccess = true`
        }

        // Skip if it's `ok: boolean` in an interface
        if (parent && parent.getKind() === SyntaxKind.PropertySignature) {
          continue;
        }
                
        access.replaceWithText(`${access.getExpression().getText()}.isSuccess`);
        modified = true;
      }
    }
  }

  if (modified) {
    // Add import
    const importPath = getRelativeImportPath(sourceFile, targetPath);

    if (!sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === importPath)) {
      sourceFile.addImportDeclaration({
        namedImports: ['ServiceResult'],
        moduleSpecifier: importPath
      });
    }

    sourceFile.saveSync();
    modifiedFiles.add(sourceFile.getFilePath());
    console.log(`Updated: ${sourceFile.getFilePath()}`);
  }
}
