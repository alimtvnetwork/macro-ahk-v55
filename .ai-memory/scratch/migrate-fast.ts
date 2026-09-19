/* eslint-disable */
import { Project, SyntaxKind, TypeAliasDeclaration, UnionTypeNode, LiteralTypeNode, VariableDeclaration, ts, EnumDeclaration, StringLiteral } from "ts-morph";

function capitalize(str: string) {
  if (!str) {
    return str;
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toEnumMemberName(str: string) {
  let propName = str.split(/[-_ ]+/).map(capitalize).join('');
  if (!propName) {
    return "Empty";
  }

  if (/^[0-9]/.test(propName)) {
    propName = "_" + propName;
  }

  return propName;
}

const project = new Project({
  compilerOptions: {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    baseUrl: "d:/work/macro-ahk",
    paths: {
      "@/*": ["src/*"]
    }
  }
});

project.addSourceFilesAtPaths("d:/work/macro-ahk/src/**/*.ts");
project.addSourceFilesAtPaths("d:/work/macro-ahk/src/**/*.tsx");
project.addSourceFilesAtPaths("d:/work/macro-ahk/standalone-scripts/**/*.ts");
project.addSourceFilesAtPaths("d:/work/macro-ahk/standalone-scripts/**/*.tsx");
project.addSourceFilesAtPaths("d:/work/macro-ahk/spec/**/*.ts");

const enumsMap = new Map<string, { enumName: string, mapping: Record<string, string> }>();

console.log("Processing POJO enums in types/enums.ts files...");
const enumsFiles = project.getSourceFiles().filter(f => f.getFilePath().includes("types/enums.ts"));

for (const sf of enumsFiles) {
  const varDecls = sf.getVariableDeclarations();
  for (const varDecl of varDecls) {
    const init = varDecl.getInitializerIfKind(SyntaxKind.AsExpression)?.getExpressionIfKind(SyntaxKind.ObjectLiteralExpression);
    if (init) {
      const name = varDecl.getName();
      let newName = name;
      if (!newName.endsWith("Type")) {
        newName += "Type";
      }
            
      const mapping: Record<string, string> = {};
      const members: any[] = [];
            
      for (const prop of init.getProperties()) {
        if (prop.getKind() === SyntaxKind.PropertyAssignment) {
          const pa = prop as any;
          const propName = pa.getName();
          const valInit = pa.getInitializerIfKind(SyntaxKind.StringLiteral);
          if (valInit) {
            const val = valInit.getLiteralValue();
            mapping[val] = propName;
            members.push({ name: propName, value: val });
          }
        }
      }
            
      enumsMap.set(newName, { enumName: newName, mapping });
            
      sf.insertEnum(varDecl.getVariableStatement()!.getChildIndex(), {
        name: newName,
        isExported: true,
        members
      });
            
      // Rename type alias
      const typeAlias = sf.getTypeAlias(name);
      if (typeAlias) {
        // rename will update all references across the project!
        if (name !== newName) {
          typeAlias.rename(newName);
        }

        typeAlias.remove();
      }
            
            varDecl.getVariableStatement()!.remove();
    }
  }
}

console.log("Processing regular string union types...");
const typeAliases = project.getSourceFiles().flatMap(sf => sf.getTypeAliases());

for (const alias of typeAliases) {
  // Skip if we just processed it or if it's already an enum in enumsMap
  if (alias.wasForgotten()) {
    continue;
  }
    
  const typeNode = alias.getTypeNode();
  if (typeNode && typeNode.getKind() === SyntaxKind.UnionType) {
    const union = typeNode as UnionTypeNode;
    const types = union.getTypeNodes();
    if (types.length >= 2 && types.every(t => t.getKind() === SyntaxKind.LiteralType && (t as LiteralTypeNode).getLiteral().getKind() === SyntaxKind.StringLiteral)) {
      const name = alias.getName();
      let newName = name;
      if (!newName.endsWith("Type")) {
        newName += "Type";
      }
            
      const values = types.map(t => ((t as LiteralTypeNode).getLiteral() as StringLiteral).getLiteralValue());
      const mapping: Record<string, string> = {};
      const members = values.map(v => {
        const memberName = toEnumMemberName(v);
        mapping[v] = memberName;

        return { name: memberName, value: v };
      });
            
      enumsMap.set(newName, { enumName: newName, mapping });
            
      const sf = alias.getSourceFile();
      sf.insertEnum(alias.getChildIndex(), {
        name: newName,
        isExported: alias.isExported(),
        members
      });
            
      if (name !== newName) {
        alias.rename(newName);
      }

      alias.remove();
    }
  }
}

console.log("Saving type conversions...");
project.saveSync();

console.log("Fixing string literal usages...");
const sourceFiles = project.getSourceFiles();

let fixedCount = 0;

for (const sf of sourceFiles) {
  // Find all string literals
  const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
  let modifiedFile = false;
    
  for (const lit of stringLiterals) {
    if (lit.wasForgotten()) {
      continue;
    }
        
    const type = lit.getContextualType();
    if (type) {
      const symbol = type.getSymbol();
      if (symbol) {
        const typeName = symbol.getName();
        const mappingInfo = enumsMap.get(typeName);
                
        if (mappingInfo) {
          const val = lit.getLiteralValue();
          if (mappingInfo.mapping[val]) {
            const memberName = mappingInfo.mapping[val];
                        
            // Check imports
            let isImportedOrLocal = !!sf.getEnum(typeName);
            if (!isImportedOrLocal) {
              for (const imp of sf.getImportDeclarations()) {
                if (imp.getNamedImports().some(ni => ni.getName() === typeName)) {
                  isImportedOrLocal = true;
                  break;
                }
              }
            }
                        
            if (!isImportedOrLocal) {
              const exportDecl = project.getSourceFiles().find(f => f.getEnum(typeName));
              if (exportDecl) {
                const moduleSpecifier = sf.getRelativePathAsModuleSpecifierTo(exportDecl);
                sf.addImportDeclaration({
                  namedImports: [typeName],
                  moduleSpecifier
                });
              }
            }
                        
            const parent = lit.getParent();
            if (parent && parent.getKind() === SyntaxKind.JsxAttribute) {
              lit.replaceWithText(`{${typeName}.${memberName}}`);
            } else {
              lit.replaceWithText(`${typeName}.${memberName}`);
            }
                        
            modifiedFile = true;
            fixedCount++;
          }
        }
      }
    }
  }
    
  if (modifiedFile) {
    sf.saveSync();
  }
}

console.log(`Fixed ${fixedCount} string literals. Done.`);
