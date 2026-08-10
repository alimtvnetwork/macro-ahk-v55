import { Project, SyntaxKind, TypeFormatFlags } from 'ts-morph';
import * as path from 'path';

const project = new Project({
    tsConfigFilePath: "d:/work/macro-ahk/tsconfig.json",
});

project.addSourceFilesAtPaths("d:/work/macro-ahk/**/*.ts");
project.addSourceFilesAtPaths("d:/work/macro-ahk/**/*.tsx");

const modifiedFiles = new Set<string>();
const wrapperTypes = new Set(['ServiceResult', 'SqlBridgeResp', 'ApiResponse', 'MarcoSDKApiResponse']);

for (const sourceFile of project.getSourceFiles()) {
    // Skip node_modules or dist
    if (sourceFile.getFilePath().includes('node_modules')) continue;
    if (sourceFile.getFilePath().includes('dist')) continue;

    let modified = false;

    // We are looking for property accesses .ok or .isSuccess
    const propAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
    for (const access of propAccesses) {
        const propName = access.getName();
        if (propName === 'ok' || propName === 'isSuccess') {
            const parent = access.getParent();
            
            // Is it negated? i.e. !x.ok or x.isFail
            if (parent && parent.getKind() === SyntaxKind.PrefixUnaryExpression && parent.getOperatorToken() === SyntaxKind.ExclamationToken) {
                // Let's get the type of the expression `x`
                const expression = access.getExpression();
                const type = expression.getType();
                const typeText = type.getText(undefined, TypeFormatFlags.NoTruncation | TypeFormatFlags.RemoveComments);
                
                // TypeText might be complex, e.g. `import("...").SqlBridgeResp` or `Promise<ApiResponse>`
                // We just check if it contains one of our wrapper names
                const isWrapper = Array.from(wrapperTypes).some(wt => typeText.includes(wt));
                
                if (isWrapper) {
                    console.log(`Replacing !${expression.getText()}.${propName} -> ${expression.getText()}.isFail in ${sourceFile.getBaseName()}`);
                    parent.replaceWithText(`${expression.getText()}.isFail`);
                    modified = true;
                } else if (propName === 'isSuccess') {
                    // if it's already named isSuccess on some other object, the user wants us to change x.isFail to x.isFail?
                    // wait, the user's rule: "Always use explicit boolean state checks like response.isFail rather than response.isFail."
                    // Let's just blindly replace x.isFail with x.isFail for ANY type since it's a structural rule, 
                    // BUT only if that type actually HAS an isFail property! Or we can assume it will be added. 
                    // Let's be safe and check if it's a known wrapper.
                }
            } else if (propName === 'ok') {
                // If it's x.ok (not negated), we can replace it with x.isSuccess for our wrappers
                const expression = access.getExpression();
                const type = expression.getType();
                const typeText = type.getText(undefined, TypeFormatFlags.NoTruncation | TypeFormatFlags.RemoveComments);
                const isWrapper = Array.from(wrapperTypes).some(wt => typeText.includes(wt));
                
                if (isWrapper) {
                    // Only if it's actually read, not part of a type definition or assignment (though ok is readonly)
                    if (parent && parent.getKind() === SyntaxKind.PropertySignature) continue;
                    
                    // console.log(`Replacing ${expression.getText()}.ok -> ${expression.getText()}.isSuccess in ${sourceFile.getBaseName()}`);
                    // Actually, the user specifically mentioned !isSuccess -> isFail. 
                    // Did they ask to rename .ok to .isSuccess? 
                    // Yes, they said "the result should have its own, like, is success, is failure". 
                    // Let's just leave .ok alone for now if it's not negated, to avoid unnecessary churn, 
                    // OR we can change it. Let's stick to the negated ones first.
                }
            }
        }
    }

    if (modified) {
        sourceFile.saveSync();
        modifiedFiles.add(sourceFile.getFilePath());
    }
}

console.log(`Updated ${modifiedFiles.size} files.`);
