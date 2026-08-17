import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const results = JSON.parse(fs.readFileSync(path.join(rootDir, 'scratch/audit-results.json'), 'utf8'));

// Filter out already processed files from Plan 37 (background handlers) to avoid duplicate work
const filteredResults = results.filter(r => !r.file.includes('src/background/handlers/'));

const pick = (type, count) => filteredResults.filter(r => r.type === type).slice(0, count);

const tasks = [
    ...pick('any-type', 40),
    ...pick('inverted-boolean', 40),
    ...pick('swallowed-error', 40),
    ...pick('nested-if', 40),
    ...pick('restricted-identifier', 40)
];

const causeAnalysis = {
    'any-type': {
        cause: 'Developer bypassed strict typing for convenience or lacked a proper interface definition.',
        fallout: 'May break compilation if the newly narrowed type exposes property access errors elsewhere. CI/CD will fail on `tsc` if the new type is incompatible.'
    },
    'inverted-boolean': {
        cause: 'Negative framing was used during initial implementation without refactoring to a positive state.',
        fallout: 'Changes require flipping the boolean logic at all call sites. If a site is missed, runtime logic will invert, potentially breaking E2E tests.'
    },
    'swallowed-error': {
        cause: 'Empty catch block or bare console.error used instead of the mandated RiseupAsiaMacroExt.Logger.error.',
        fallout: 'Missing diagnostic logs in production. CI script `audit-error-swallow.mjs` fails. Fixing it requires injecting Logger context which might be missing.'
    },
    'nested-if': {
        cause: 'Incremental feature additions led to deeper nesting instead of early returns (guard clauses).',
        fallout: 'Refactoring to early returns could accidentally alter execution order if side effects exist. Requires careful mapping of all branches.'
    },
    'restricted-identifier': {
        cause: 'Developer used shorthand (e.g. `cb`, `arr`, `el`) instead of descriptive domain names.',
        fallout: 'Renaming identifiers might cause reference errors if shadowed variables exist. Safe rename (F2) equivalent required.'
    }
};

let planMd = `# Plan: Coding Guideline Enforcement (v3)

## Goal
Resolve 200 concrete coding guideline violations across the codebase, specifically targeting \`any-type\`, \`inverted-boolean\`, \`swallowed-error\`, \`nested-if\`, and \`restricted-identifier\`.

## Root Cause & Fallout Analysis

### 1. \`any\` Type Usage
- **Root Cause**: ${causeAnalysis['any-type'].cause}
- **Fallout Radius**: ${causeAnalysis['any-type'].fallout}

### 2. Inverted Booleans
- **Root Cause**: ${causeAnalysis['inverted-boolean'].cause}
- **Fallout Radius**: ${causeAnalysis['inverted-boolean'].fallout}

### 3. Swallowed Errors
- **Root Cause**: ${causeAnalysis['swallowed-error'].cause}
- **Fallout Radius**: ${causeAnalysis['swallowed-error'].fallout}

### 4. Nested If Statements
- **Root Cause**: ${causeAnalysis['nested-if'].cause}
- **Fallout Radius**: ${causeAnalysis['nested-if'].fallout}

### 5. Restricted Identifiers
- **Root Cause**: ${causeAnalysis['restricted-identifier'].cause}
- **Fallout Radius**: ${causeAnalysis['restricted-identifier'].fallout}

## Execution Strategy
- Tasks are enqueued in \`.lovable/spec/tasks/38-coding-guideline-fixes-v3.md\`.
- 3 sub-agents will be spawned to process these sequentially in batches.

`;

let tasksMd = `# Explicit Spec Tasks: Coding Guideline Fixes v3

These 200 tasks are queued for execution by concurrent sub-agents. 
Each agent must pick an uncompleted task, apply the fix, run \`pnpm run lint\`, and commit with \`fix(guidelines): ...\`.

`;

tasks.forEach((t, i) => {
    const num = String(i + 1).padStart(3, '0');
    let fixInstruction = '';
    
    switch (t.type) {
        case 'any-type':
            fixInstruction = `Replace \`any\` with a narrow type (e.g., \`unknown\`, or a specific \`interface\`).`;
            break;
        case 'inverted-boolean':
            const boolName = t.message.replace('Inverted boolean: !', '');
            fixInstruction = `Extract to a positively named boolean (e.g. \`const isMissing = !${boolName};\`) or invert the source variable.`;
            break;
        case 'swallowed-error':
            fixInstruction = `Add \`RiseupAsiaMacroExt.Logger.error('NAMESPACE', 'Operation failed', { error });\` and optionally rethrow.`;
            break;
        case 'nested-if':
            fixInstruction = `Flatten the nested if using an early return or guard clause.`;
            break;
        case 'restricted-identifier':
            const ident = t.message.split(': ')[1];
            fixInstruction = `Rename \`${ident}\` to a descriptive word (e.g. \`callback\`, \`items\`, \`element\`).`;
            break;
    }

    tasksMd += `## Task ${num}: [${t.type}] in \`${t.file}\`
- **File**: \`${t.file}\`
- **Line**: ${t.line}
- **Violation**: ${t.message}
- **Action**: ${fixInstruction}

`;
});

fs.mkdirSync(path.join(rootDir, '.lovable/spec/tasks'), { recursive: true });
fs.mkdirSync(path.join(rootDir, '.lovable/plans/pending'), { recursive: true });

fs.writeFileSync(path.join(rootDir, '.lovable/plans/pending/38-coding-guideline-fixes-v3.md'), planMd);
fs.writeFileSync(path.join(rootDir, '.lovable/spec/tasks/38-coding-guideline-fixes-v3.md'), tasksMd);

console.log('Successfully wrote plan and tasks for 200 items.');
