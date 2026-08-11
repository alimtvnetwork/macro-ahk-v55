import { Project, SyntaxKind, VariableDeclaration } from "ts-morph";

function getDescriptiveName(name: string, values: string[]): string {
  if (name.startsWith("SemanticSemantic") && name.length > 20) {
    // likely a hash
    const parts = values.slice(0, 2).map(v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase().replace(/[^a-zA-Z0-9]/g, ''));

    return parts.join("") + "Type";
  }

  return name;
}

const specificWeirdNames: Record<string, string> = {
  "SemanticSemanticToneEnum1": "SemanticToneExtendedType",
  "SemanticSemanticKindEnum1": "SemanticKindExtendedType",
  "ApplyQuotaResultResult": "ApplyQuotaResultType",
  "ApplyErrorRateResultResult": "ApplyErrorRateResultType"
};

function getNewName(oldName: string, values: string[]): string {
  if (oldName.endsWith("Type")) {
    return oldName;
  }
    
  let baseName = oldName;
    
  if (specificWeirdNames[baseName]) {
    return specificWeirdNames[baseName];
  }
    
  baseName = getDescriptiveName(baseName, values);
    
  if (baseName.startsWith("SemanticSemantic")) {
    baseName = baseName.replace("SemanticSemantic", "Semantic");
  }
    
  if (baseName.endsWith("Enum")) {
    baseName = baseName.slice(0, -4);
  } else if (baseName.endsWith("ResultResult")) {
    baseName = baseName.slice(0, -12) + "Result";
  }
    
  if (!baseName.endsWith("Type")) {
    baseName += "Type";
  }

  return baseName;
}

const project = new Project({
  tsConfigFilePath: "d:/work/macro-ahk/tsconfig.json",
});
project.addSourceFilesAtPaths("d:/work/macro-ahk/src/**/*.ts");
project.addSourceFilesAtPaths("d:/work/macro-ahk/standalone-scripts/macro-controller/**/*.ts");

const filesToProcess = [
  "d:/work/macro-ahk/src/types/enums.ts",
  "d:/work/macro-ahk/standalone-scripts/macro-controller/src/types/enums.ts"
];

const renames = new Map<string, string>();

for (const filePath of filesToProcess) {
  const file = project.getSourceFile(filePath);
  if (!file) {
    console.log("ERROR: Could not find", filePath);
    continue;
  }
    
  const variableDeclarations = file.getVariableDeclarations();
  for (const varDecl of variableDeclarations) {
    const name = varDecl.getName();
    const initializer = varDecl.getInitializerIfKind(SyntaxKind.AsExpression)?.getExpressionIfKind(SyntaxKind.ObjectLiteralExpression);
    if (initializer) {
      const properties = initializer.getProperties();
      const values: string[] = [];
      for (const prop of properties) {
        if (prop.getKind() === SyntaxKind.PropertyAssignment) {
          const init = prop.asKind(SyntaxKind.PropertyAssignment)?.getInitializerIfKind(SyntaxKind.StringLiteral);
          if (init) {
            values.push(init.getLiteralValue());
          }
        }
      }
            
      const newName = getNewName(name, values);
      if (newName !== name) {
        renames.set(name, newName);
        // Also rename the type alias if it exists
        const typeAlias = file.getTypeAlias(name);
        if (typeAlias) {
          typeAlias.rename(newName);
        }

        varDecl.rename(newName);
      }
    }
  }
}

console.log(`Renaming ${renames.size} enums...`);
for (const [oldName, newName] of renames.entries()) {
  console.log(` - ${oldName} -> ${newName}`);
}

project.saveSync();
console.log("Save complete.");
