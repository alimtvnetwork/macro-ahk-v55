/* eslint-disable */
import { Project, SyntaxKind, VariableDeclaration, Node } from 'ts-morph';
import * as fs from 'fs';

const project = new Project({
  tsConfigFilePath: "d:/work/macro-ahk/tsconfig.json",
});

project.addSourceFilesAtPaths("d:/work/macro-ahk/src/**/*.ts");
project.addSourceFilesAtPaths("d:/work/macro-ahk/src/**/*.tsx");
project.addSourceFilesAtPaths("d:/work/macro-ahk/standalone-scripts/macro-controller/src/**/*.ts");
project.addSourceFilesAtPaths("d:/work/macro-ahk/standalone-scripts/macro-controller/src/**/*.tsx");

console.log("Analyzing...");

const enumFiles = [
  project.getSourceFileOrThrow("d:/work/macro-ahk/src/types/enums.ts"),
  project.getSourceFileOrThrow("d:/work/macro-ahk/standalone-scripts/macro-controller/src/types/enums.ts")
];

function toPascalCase(str: string) {
  return str.replace(/(^\w|-\w|_\w)/g, (text) => text.replace(/-|_/, "").toUpperCase());
}

let renames = 0;
const usedNames = new Set<string>();

// Pre-fill used names
for (const file of enumFiles) {
  for (const v of file.getVariableDeclarations()) {
    usedNames.add(v.getName());
  }
}

for (const file of enumFiles) {
  const varDecls = file.getVariableDeclarations();
  for (const varDecl of varDecls) {
    const name = varDecl.getName();
    if (name.startsWith("Enum_") || name.startsWith("Semantic") || /\d+$/.test(name)) {
      // Find references to this enum
      const typeAlias = file.getTypeAlias(name);
      if (!typeAlias) {
        continue;
      } // Skip if no type alias

      let bestName: string | null = null;
            
      // Look at where the type alias is used to derive a name
      const refs = typeAlias.findReferencesAsNodes();
      for (const ref of refs) {
        if (ref.getSourceFile() === file) {
          continue;
        }
                
        const propSig = ref.getFirstAncestorByKind(SyntaxKind.PropertySignature) || ref.getFirstAncestorByKind(SyntaxKind.PropertyDeclaration);
        const paramDecl = ref.getFirstAncestorByKind(SyntaxKind.Parameter);
                
        if (propSig) {
          const propName = propSig.getName();
          let containerName = "";
          const container = propSig.getFirstAncestorByKind(SyntaxKind.InterfaceDeclaration) || 
                                      propSig.getFirstAncestorByKind(SyntaxKind.ClassDeclaration) ||
                                      propSig.getFirstAncestorByKind(SyntaxKind.TypeAliasDeclaration);
          if (container) {
            containerName = container.getName() || "";
          }

          if (propName && containerName) {
            bestName = toPascalCase(containerName) + toPascalCase(propName);
            break;
          }
        } else if (paramDecl) {
          const paramName = paramDecl.getName();
          let containerName = "";
          const func = paramDecl.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) || 
                                 paramDecl.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ||
                                 paramDecl.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
          if (func && (Node.isFunctionDeclaration(func) || Node.isMethodDeclaration(func))) {
            containerName = func.getName() || "";
          }

          if (paramName && containerName) {
            bestName = toPascalCase(containerName) + toPascalCase(paramName);
            break;
          }
        }
      }

      if (!bestName) {
        bestName = "Semantic" + name.replace("Enum_", "").replace(/\d+$/, "");
      }

      // Ensure unique
      let uniqueName = bestName;
      let counter = 1;
      while (usedNames.has(uniqueName)) {
        uniqueName = bestName + counter;
        counter++;
      }
            
      usedNames.add(uniqueName);

      console.log(`Renaming ${name} to ${uniqueName}`);
            
      // Rename the type alias first
      typeAlias.rename(uniqueName);
      // Then rename the variable decl 
      // Note: renaming the variable decl might rename the type alias if they are linked by identical name? 
      // ts-morph handles this surprisingly well, but since we renamed typeAlias, let's just rename varDecl.
      const newVarDecl = file.getVariableDeclaration(name);
      if (newVarDecl) {
        newVarDecl.rename(uniqueName);
      }

      renames++;
    }
  }
}

console.log(`Performed ${renames} renames. Saving...`);
project.saveSync();
console.log("Done!");
