# Genericization Targets (S41)

Project-specific identifiers detected across `spec/` that block blind-AI portability.

## Top tokens
| Token | Replacement placeholder | Occurrences |
|---|---|---|
| `RiseupAsiaMacroExt` | `<NAMESPACE>` | 220 |
| `Riseup Asia LLC` | `<VENDOR>` | retain in `mem://branding/author-identity` only |
| `riseupasia.com` URLs | `<VENDOR_URL>` | check `spec/00-glossary.md` |
| `marco-*` DOM IDs | `<ID_PREFIX>-*` | scoped to `src/` (do not rewrite) |

## Policy
- **Spec text** → use placeholders, map in `spec/00-glossary.md`.
- **Source code (`src/**`)** → keep real identifiers; runtime relies on them.
- **Memory files** → keep real identifiers; they are project-scoped by design.

See `spec/00-glossary.md` for the canonical mapping table.
