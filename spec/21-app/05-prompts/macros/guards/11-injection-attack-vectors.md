# Injection Attack Vectors

Every vector below MUST be neutralized at the interpolator layer or earlier.

| # | Vector | Example | Defense |
|---:|---|---|---|
| 1 | Variable value contains `{{ ... }}` | `TargetFolder = "{{ ApiToken }}"` | Interpolator does ONE pass — no recursion. Substituted text is never re-scanned. |
| 2 | Variable value contains markdown injection | `Title = "# pwned\n```\nrm -rf /\n```"` | Render as plain text; LLM sees raw content. Audit-writer escapes inside fenced JSON. |
| 3 | Variable value contains prompt-injection ("ignore all previous…") | any user-supplied string | Out of scope at engine layer; documented in `macros/07-permissions-and-scope.md`. UI prompt-input warns when value > 500 chars. |
| 4 | Path traversal in `path`-typed variable | `Folder = "../../etc/passwd"` | `assertSafePath()` rejects `..` segments + roots outside allowed list. |
| 5 | Newline in variable value to break frame | `Name = "Alice\nScore: 100/100"` | Score parser uses anchored regex; multi-line still match-loops, but parsing happens AFTER LLM output, not on variable values directly. Author should declare `string` (single-line) for inputs. |
| 6 | Oversized value to exhaust quota | 10 MB string | Per-variable max 64 KB; total resolved prompt max 1 MB. Exceed → `Reason='VarTooLarge'`. |
| 7 | Sensitive value leaked into audit | `ApiToken` rendered in audit body | `maskForLog()` runs against audit output before write. |
| 8 | Unicode RTL/zero-width chars | `TargetFolder = "src\u202E/"` | Sanitizer strips `[\u202A-\u202E\u2066-\u2069\u200B-\u200F]` before substitution. |
| 9 | HTML-escaped tokens (`&#123;&#123;X&#125;&#125;`) | UI form input | Templates are markdown/plain; the UI does not HTML-decode before storing. |
| 10 | Race: variable changes between resolve and render | concurrent `set-var` | Resolver snapshots all variables at step start; later mutations apply only to subsequent steps. |
