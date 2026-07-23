# Glossary — Placeholder ↔ Real Mapping

This project's spec uses generic placeholders so any AI can implement it on any
Chrome-extension codebase. Resolve placeholders to the values below when
implementing in *this* repo.

| Placeholder | This project | Meaning |
|---|---|---|
| `<NAMESPACE>` | `RiseupAsiaMacroExt` | Global MAIN-world SDK namespace |
| `<VENDOR>` | `Riseup Asia LLC` | Project author / publisher |
| `<VENDOR_URL>` | `https://stackoverflow.com/users/...` | Author identity URL |
| `<ID_PREFIX>` | `marco` | DOM id prefix for injected elements |
| `<EXT_NAME>` | `Macro Controller` | User-facing extension name |
| `<STORAGE_BUCKET>` | `chrome.storage.local` | Persistent key-value store |
| `<LOGGER>` | `<NAMESPACE>.Logger.error` | Mandatory error logger |
| `<BEARER>` | `getBearerToken()` | Single auth contract |

## Reading rules
- When a spec file shows `<NAMESPACE>.Logger.error(...)`, read as
  `RiseupAsiaMacroExt.Logger.error(...)` in this repo.
- When porting to a new project, substitute your own namespace once at the
  top of the glossary and the rest of the spec works unchanged.
