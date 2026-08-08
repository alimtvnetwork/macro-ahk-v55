import { Project, SyntaxKind, TypeNode, UnionTypeNode, LiteralTypeNode } from 'ts-morph';
import * as fs from 'fs';

const project = new Project({
    tsConfigFilePath: "d:/work/macro-ahk/tsconfig.json",
});

// We should scan both src/ and standalone-scripts/
project.addSourceFilesAtPaths("d:/work/macro-ahk/src/**/*.ts");
project.addSourceFilesAtPaths("d:/work/macro-ahk/src/**/*.tsx");
project.addSourceFilesAtPaths("d:/work/macro-ahk/standalone-scripts/macro-controller/src/**/*.ts");
project.addSourceFilesAtPaths("d:/work/macro-ahk/standalone-scripts/macro-controller/src/**/*.tsx");

let unionOccurrences = [];

function isStringLiteralUnion(node) {
    if (node.getKind() !== SyntaxKind.UnionType) return false;
    const types = node.getTypeNodes();
    if (types.length === 0) return false;
    for (const t of types) {
        if (t.getKind() !== SyntaxKind.LiteralType) return false;
        if (t.getLiteral().getKind() !== SyntaxKind.StringLiteral) return false;
    }
    return true;
}

for (const sourceFile of project.getSourceFiles()) {
    // Exclude node_modules just in case
    if (sourceFile.getFilePath().includes('node_modules')) continue;

    const unions = sourceFile.getDescendantsOfKind(SyntaxKind.UnionType);
    for (const union of unions) {
        if (isStringLiteralUnion(union)) {
            unionOccurrences.push({
                file: sourceFile.getFilePath(),
                line: union.getStartLineNumber(),
                text: union.getText()
            });
        }
    }
}

// Group by exact text
let groups = {};
for (const occ of unionOccurrences) {
    if (!groups[occ.text]) {
        groups[occ.text] = [];
    }
    groups[occ.text].push(occ);
}

const report = {
    totalOccurrences: unionOccurrences.length,
    uniqueUnions: Object.keys(groups).length,
    groups: groups
};

fs.writeFileSync("d:/work/macro-ahk/scratch/union-report.json", JSON.stringify(report, null, 2));
console.log(`Found ${report.totalOccurrences} occurrences across ${report.uniqueUnions} unique string unions.`);
