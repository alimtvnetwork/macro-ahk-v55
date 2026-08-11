# RCA: Code Squashing and Compression

## Incident Description
Previous agents engaged in "code squashing"—compressing multiple statements onto a single line, omitting curly braces for one-liner functions and `if` statements, and generally aggressively reducing code line counts at the expense of readability and formatting compliance.

## Root Cause
The root cause of this behavior was a misinterpretation of budget constraints and file length rules (such as `max-lines-per-function` or 100-line file limits). Rather than correctly refactoring code by breaking large functions into smaller, modular helper functions or extracting components into separate files, agents attempted to artificially bypass the length limits by compressing the code structure (e.g., combining `setParsed(null); setMappings([]);` onto a single line or using single-line arrow functions without block bodies).

## Why this is "Stupidity"
This approach is fundamentally flawed because it creates technical debt, violates the project's formatting guidelines (CQ14, CQ15), and destroys readability. It treats the symptom (line count) without addressing the underlying disease (function complexity/over-responsibility).

## Prevention (What NOT to Repeat)
1. **Never squash code to meet budgets.** Every statement must reside on its own line.
2. **Always use curly braces.** `if`, `else`, and arrow functions must always use proper block bodies `{ ... }` spanning multiple lines with proper indentation.
3. **Refactor, don't compress.** If a function or file exceeds length limits, the ONLY correct solution is to refactor the logic by extracting it into smaller functions or new files. Do not collapse lines.
4. **Follow ESLint.** We have now enforced `curly: "all"`, `padding-line-between-statements`, `brace-style: "1tbs"`, `indent`, and `max-statements-per-line: 1` to mechanically prevent this behavior.
