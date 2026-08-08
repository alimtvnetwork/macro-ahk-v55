module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let isModified = false;

  root.find(j.CallExpression, {
    callee: { name: 'logError' }
  }).forEach(path => {
    const args = path.node.arguments;
    if (args.length >= 2 && 
        args[0].type === 'StringLiteral' && args[0].value === 'AutoCatch' &&
        args[1].type === 'StringLiteral' && args[1].value === 'Unhandled exception') {
      
      args[0] = j.identifier('ERROR_CONTEXT_AUTOCATCH');
      args[1] = j.identifier('ERROR_MSG_UNHANDLED');
      isModified = true;
    }
  });

  if (isModified) {
    // Add import statement for constants
    const imports = root.find(j.ImportDeclaration);
    const existingImport = root.find(j.ImportDeclaration, { 
      source: { value: '../constants/errors' } 
    }).size() > 0;

    if (!existingImport) {
      // Need to find relative path. Let's assume most files are 1 or 2 levels deep.
      // This is a naive injection, in reality we should just define the constants in the file if we can't do relative properly.
      // Actually, since these are in many different subfolders, calculating relative path is hard in jscodeshift.
      // Alternatively, we can define the constants at the top of the file.
      // Or better, let's just replace the strings with a local const if we want to avoid duplicate string warning.
      // Let's insert: const ERROR_CONTEXT_AUTOCATCH = "AutoCatch"; const ERROR_MSG_UNHANDLED = "Unhandled exception";
      const hasConst = root.find(j.VariableDeclarator, { id: { name: 'ERROR_CONTEXT_AUTOCATCH' } }).size() > 0;
      if (!hasConst) {
         const constDecl = j.variableDeclaration('const', [
           j.variableDeclarator(j.identifier('ERROR_CONTEXT_AUTOCATCH'), j.literal('AutoCatch')),
           j.variableDeclarator(j.identifier('ERROR_MSG_UNHANDLED'), j.literal('Unhandled exception'))
         ]);
         root.get().node.program.body.unshift(constDecl);
      }
    }
    return root.toSource();
  }
  return null;
};
module.exports.parser = 'tsx';
