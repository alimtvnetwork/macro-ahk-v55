/* eslint-disable */
import { Project, SyntaxKind, TypeNode, UnionTypeNode, LiteralTypeNode, Node } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: "d:/work/macro-ahk/tsconfig.json",
});

project.addSourceFilesAtPaths("d:/work/macro-ahk/src/**/*.ts");
project.addSourceFilesAtPaths("d:/work/macro-ahk/src/**/*.tsx");
project.addSourceFilesAtPaths("d:/work/macro-ahk/standalone-scripts/macro-controller/src/**/*.ts");
project.addSourceFilesAtPaths("d:/work/macro-ahk/standalone-scripts/macro-controller/src/**/*.tsx");

function isStringLiteralUnion(node: Node): boolean {
  if (node.getKind() !== SyntaxKind.UnionType) {
    return false;
  }

  const union = node as UnionTypeNode;
  const types = union.getTypeNodes();
  if (types.length === 0) {
    return false;
  }

  for (const t of types) {
    if (t.getKind() !== SyntaxKind.LiteralType) {
      return false;
    }

    if ((t as LiteralTypeNode).getLiteral().getKind() !== SyntaxKind.StringLiteral) {
      return false;
    }
  }

  return true;
}

function getUnionValues(node: UnionTypeNode): string[] {
  const types = node.getTypeNodes();

  return types.map(t => {
    const text = (t as LiteralTypeNode).getLiteral().getText();

    return text.substring(1, text.length - 1); // remove quotes
  });
}

function toPascalCase(str: string) {
  return str.replace(/(^\w|-\w|_\w)/g, clearAndUpper);
}

function clearAndUpper(text: string) {
  return text.replace(/-|_/, "").toUpperCase();
}

function generateNameForUnion(node: Node, values: string[]): string | null {
  const parent = node.getParent();
  if (!parent) {
    return null;
  }

  let baseName = "";
  if (Node.isPropertySignature(parent) || Node.isPropertyDeclaration(parent) || Node.isParameterDeclaration(parent) || Node.isTypeAliasDeclaration(parent) || Node.isVariableDeclaration(parent)) {
    baseName = parent.getName();
  } else if (Node.isMethodSignature(parent) || Node.isMethodDeclaration(parent)) {
    baseName = parent.getName() + "Result"; // e.g. return type
  }
    
  if (baseName) {
    baseName = toPascalCase(baseName);
    if (!baseName.toLowerCase().includes("type") && !baseName.toLowerCase().includes("mode") && !baseName.toLowerCase().includes("status") && !baseName.toLowerCase().includes("state")) {
      // Append Type or Mode based on values heuristically
      baseName += "Enum";
    }

    // Capitalize first letter
    baseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);

    return baseName;
  }

  // fallback: hash of values
  const joined = values.sort().join("_");
  if (joined === "asc_desc") {
    return "SortOrder";
  }

  if (joined === "replace_toggle_range") {
    return "SelectMode";
  }
    
  return "Enum_" + Math.abs(joined.split("").reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);

    return a & a 
  }, 0)).toString(16);
}

// Ensure type files exist
const srcEnumsPath = "d:/work/macro-ahk/src/types/enums.ts";
const mcEnumsPath = "d:/work/macro-ahk/standalone-scripts/macro-controller/src/types/enums.ts";

function ensureFile(p: string) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, `// Auto-generated enums\n`, 'utf8');
    project.addSourceFileAtPath(p);
  }
}

ensureFile(srcEnumsPath);
ensureFile(mcEnumsPath);

const srcEnumsFile = project.getSourceFileOrThrow(srcEnumsPath);
const mcEnumsFile = project.getSourceFileOrThrow(mcEnumsPath);

const existingEnums = new Map<string, string>(); // 'val1_val2' -> 'EnumName'
const enumFiles = new Map<string, string>(); // 'EnumName' -> 'src' or 'mc'

let modifications = 0;

for (const sourceFile of project.getSourceFiles()) {
  if (sourceFile.getFilePath().includes('types/enums.ts')) {
    continue;
  }

  if (sourceFile.getFilePath().includes('node_modules')) {
    continue;
  }

  const unions = sourceFile.getDescendantsOfKind(SyntaxKind.UnionType) as UnionTypeNode[];
  let fileModified = false;

  // Filter to only true inline string unions
  const inlineUnions = unions.filter(u => {
    if (!isStringLiteralUnion(u)) {
      return false;
    }

    // Check if it's already in a type alias declaration that IS NOT what we want to rename,
    // Wait, if it's already `type X = "a" | "b"`, maybe we want to migrate it to enum object?
    // Let's migrate all of them.
    return true;
  });

  for (const union of inlineUnions) {
    // Since we might have replaced parent nodes, check if node was forgotten
    if (union.wasForgotten()) {
      continue;
    }

    const values = getUnionValues(union);
    if (values.length < 2) {
      continue;
    } // Not a real union enum
        
    const sig = values.slice().sort().join("_");
        
    let enumName = existingEnums.get(sig);
    let isSrc = sourceFile.getFilePath().includes('/src/background/') || 
                    sourceFile.getFilePath().includes('/src/components/') || 
                    sourceFile.getFilePath().includes('/src/lib/') ||
                    sourceFile.getFilePath().match(/src\/[^\/]+\.tsx?$/); // root src files
        
    // macro-controller has its own src
    if (sourceFile.getFilePath().includes('/standalone-scripts/macro-controller/src/')) {
      isSrc = false;
    }

    const targetEnumFile = isSrc ? srcEnumsFile : mcEnumsFile;
    const targetEnumFilePath = isSrc ? srcEnumsPath : mcEnumsPath;

    if (!enumName) {
      enumName = generateNameForUnion(union, values);
      if (!enumName) {
        continue;
      }
            
      // deduplicate name
      let uniqueName = enumName;
      let counter = 1;
      while (Array.from(existingEnums.values()).includes(uniqueName)) {
        uniqueName = enumName + counter;
        counter++;
      }

      enumName = uniqueName;
      existingEnums.set(sig, enumName);
      enumFiles.set(enumName, isSrc ? 'src' : 'mc');

      // Generate enum object & type
      const objProps = values.map(v => {
        let propName = v.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        if (propName === '') {
          propName = 'EMPTY';
        }

        if (/^[0-9]/.test(propName)) {
          propName = '_' + propName;
        }

        return `${propName}: "${v}"`;
      }).join(', ');
            
      targetEnumFile.addStatements(`export const ${enumName} = { ${objProps} } as const;\nexport type ${enumName} = typeof ${enumName}[keyof typeof ${enumName}];\n`);
    } else {
      // Check if cross-boundary import is needed, though we will just import from the one it was defined in
      // For simplicity, just redefine it if it crosses boundaries, or import it.
      // We will handle imports below.
    }

    // Replace the union with the enum name
    // Wait, if it is already a type alias `export type SelectMode = "a" | "b"`, we should replace the whole type alias with the enum object?
    const parent = union.getParent();
    if (Node.isTypeAliasDeclaration(parent) && parent.getName() === enumName) {
      // Already matching name? Remove it, the import will cover it
      // Or just leave it and let it be. Actually, if we just replace the right side, it becomes `export type EnumName = EnumName` which is an error.
      parent.remove();
      fileModified = true;
    } else {
      union.replaceWithText(enumName);
      fileModified = true;
    }

    // Add import
    const definedInSrc = enumFiles.get(enumName) === 'src';
    const expectedPath = definedInSrc ? srcEnumsPath : mcEnumsPath;
        
    if (sourceFile.getFilePath() !== expectedPath) {
      let relPath = path.relative(path.dirname(sourceFile.getFilePath()), expectedPath).replace(/\\/g, '/');
      if (!relPath.startsWith('.')) {
        relPath = './' + relPath;
      }

      relPath = relPath.replace('.ts', '');
            
      // Check if import exists
      const existingImport = sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === relPath);
      if (existingImport) {
        if (!existingImport.getNamedImports().some(ni => ni.getName() === enumName)) {
          existingImport.addNamedImport(enumName);
        }
      } else {
        sourceFile.addImportDeclaration({
          namedImports: [enumName],
          moduleSpecifier: relPath
        });
      }
    }
  }

  if (fileModified) {
    sourceFile.saveSync();
    modifications++;
    console.log(`Updated: ${sourceFile.getFilePath()}`);
  }
}

srcEnumsFile.saveSync();
mcEnumsFile.saveSync();

console.log(`Modifications completed in ${modifications} files.`);
