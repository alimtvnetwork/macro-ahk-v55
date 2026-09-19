module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let isModified = false;
  let needsEventsImport = false;
  let needsLogLevelsImport = false;

  const eventMap = {
    'click': 'CLICK',
    'keydown': 'KEYDOWN',
    'keyup': 'KEYUP',
    'mousedown': 'MOUSEDOWN',
    'mouseup': 'MOUSEUP',
    'input': 'INPUT',
    'change': 'CHANGE',
    'message': 'MESSAGE'
  };

  const logMap = {
    'info': 'INFO',
    'warn': 'WARN',
    'error': 'ERROR',
    'success': 'SUCCESS'
  };

  // Replace event strings in addEventListener / removeEventListener
  root.find(j.CallExpression, {
    callee: {
      property: {
        name: (name) => ['addEventListener', 'removeEventListener'].includes(name)
      }
    }
  }).forEach(path => {
    const args = path.node.arguments;
    if (args.length > 0 && args[0].type === 'StringLiteral') {
      const val = args[0].value;
      if (eventMap[val]) {
        args[0] = j.memberExpression(
          j.identifier('Events'),
          j.identifier(eventMap[val])
        );
        isModified = true;
        needsEventsImport = true;
      }
    }
  });

  // Replace log levels in custom logging functions if they take a level as first arg
  // e.g. notify('success', ...)
  root.find(j.CallExpression, {
    callee: {
      name: 'notify'
    }
  }).forEach(path => {
    const args = path.node.arguments;
    if (args.length > 0 && args[0].type === 'StringLiteral') {
      const val = args[0].value;
      if (logMap[val]) {
        args[0] = j.memberExpression(
          j.identifier('LogLevels'),
          j.identifier(logMap[val])
        );
        isModified = true;
        needsLogLevelsImport = true;
      }
    }
  });

  if (isModified) {
    const imports = root.find(j.ImportDeclaration);
    const existingEventsImport = root.find(j.ImportDeclaration, { source: { value: '@/constants/events' } }).size() > 0;
    const existingLogLevelsImport = root.find(j.ImportDeclaration, { source: { value: '@/constants/log-levels' } }).size() > 0;

    if (needsEventsImport && !existingEventsImport) {
      const newImport = j.importDeclaration(
        [j.importSpecifier(j.identifier('Events'))],
        j.literal('@/constants/events')
      );
      if (imports.length > 0) {
        j(imports.at(0).get()).insertBefore(newImport);
      } else {
        root.get().node.program.body.unshift(newImport);
      }
    }

    if (needsLogLevelsImport && !existingLogLevelsImport) {
      const newImport = j.importDeclaration(
        [j.importSpecifier(j.identifier('LogLevels'))],
        j.literal('@/constants/log-levels')
      );
      if (imports.length > 0) {
        j(imports.at(0).get()).insertBefore(newImport);
      } else {
        root.get().node.program.body.unshift(newImport);
      }
    }

    return root.toSource();
  }
  return null;
};
module.exports.parser = 'tsx';
