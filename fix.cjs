const { Project, SyntaxKind } = require("ts-morph");

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});
project.addSourceFilesAtPaths("src/background/**/*.ts");

const files = project.getSourceFiles();

for (const sourceFile of files) {
  let modified = false;

  let done = false;
  while (!done) {
    done = true;
    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      if (call.getExpression().getText() === "ServiceResult.wrapDb") {
        const args = call.getArguments();
        if (args.length > 0 && args[0].getKind() === SyntaxKind.ArrowFunction) {
          const arrow = args[0];
          const body = arrow.getBody();
          if (body.getKind() === SyntaxKind.Block) {
             continue; // Skip multi-line blocks
          }
          let bodyText = body.getText();
          
          let parent = call.getParent();
          let nodeToReplace = call;
          
          if (parent && parent.getKind() === SyntaxKind.PropertyAccessExpression && parent.getName() === "data") {
            const grandParent = parent.getParent();
            if (grandParent && grandParent.getKind() === SyntaxKind.NonNullExpression) {
              nodeToReplace = grandParent;
            } else {
              nodeToReplace = parent;
            }
          }
          
          nodeToReplace.replaceWithText(bodyText);
          modified = true;
          done = false;
          break; 
        }
      }
    }
  }
  
  if (modified) {
    sourceFile.saveSync();
    console.log(`Unwrapped in ${sourceFile.getFilePath()}`);
  }
}
