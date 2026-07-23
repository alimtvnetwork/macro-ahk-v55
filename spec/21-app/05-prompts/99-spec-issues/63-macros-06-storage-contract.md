# Audit — macros/06-storage-contract.md
**Audited:** 2026-06-02  · 65 lines
## Findings
- **C1** Missing metadata header.
- **C15 Bare fences:** 0 — clean.
- **C8** **MUST** `Mirrors: mem://constraints/no-storage-pascalcase-migration` AND `mem://architecture/data-storage-layers`. Currently absent — high drift hazard given the Phase 2c ban.
- **C27** Key naming conventions referenced; should explicitly enumerate every `chrome.storage.local` key the macro engine reads/writes.
- **C26** Overlaps `engine/` storage references; needs `Supersedes:` direction.
## Severity
**Critical.** Phase 2c PascalCase migration is BANNED by Core memory; any drift here re-introduces the banned rewrite.
## Fix order
1. Add bold callout: "STORED KEYS ARE FROZEN — see `mem://constraints/no-storage-pascalcase-migration`."
2. `Mirrors:` both memories.
3. Enumerate full key list.
