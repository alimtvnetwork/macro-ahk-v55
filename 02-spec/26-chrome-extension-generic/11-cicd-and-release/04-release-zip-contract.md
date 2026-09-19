# Release ZIP Contract

**Version:** 1.1.2000-05-22
**Status:** Active
**AI Confidence:** Medium

> *Generic blueprint — no project-specific identifiers. If you find one, file an issue.*

---

## Intent

Define the contract for the released ZIP and all accompanying release artifacts: required top-level files, folder layout, max size budget, version.txt presence, no source maps in production, SHA-256 checksums, optional minisign signatures, and SLSA build-provenance attestations.

---

## 1. Release artifacts

| Artifact | Required | Description |
|----------|----------|-------------|
| `{project}-{VER}.zip` | MUST | Main deliverable(s) |
| `VERSION.txt` | MUST | Plain-text version identifier |
| `checksums.txt` | MUST | SHA-256 of every artifact |
| `checksums.txt.minisig` | MAY | Minisign signature for checksums.txt (opt-in v0.3) |
| `changelog.md` | MUST | Human-readable release notes |
| `install.sh` / `install.ps1` | MUST | Unified installers |

## 2. Build provenance (SLSA)

The release pipeline MUST generate a **SLSA build-provenance attestation** for every artifact using GitHub Attestations (`actions/attest-build-provenance`). Consumers verify with:

```bash
gh attestation verify {artifact}.zip --repo {owner}/{repo}
```

This attestation is independent of minisign signing and serves as a machine-verifiable guarantee that the artifact was built by the project's CI/CD pipeline.

## 3. Checksums

Format: `<hex>  <filename>` (GNU sha256sum). The checksums.txt file itself is attested but NOT checksummed internally (to avoid circularity).

## 4. Common pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Forgetting `id-token: write` permission | Attestation step fails silently or with OIDC error |
| Missing `attestations: write` permission | Attestation creation returns 403 |
| Attesting non-build artifacts (e.g. RELEASE_NOTES.md) | Wastes attestation quota; limit to deliverables |

## 5. VERIFY checklist

- [ ] `sha256sum -- * > checksums.txt` runs in the release-assets directory
- [ ] `actions/attest-build-provenance@v1` step exists after asset verification
- [ ] Workflow permissions include `id-token: write` and `attestations: write`
- [ ] `gh attestation verify` succeeds on a downloaded artifact

---

## Cross-References

| Reference | Location |
|-----------|----------|
| Folder structure rules | `../../01-spec-authoring-guide/01-folder-structure.md` |
| Required files | `../../01-spec-authoring-guide/03-required-files.md` |
| Generic installer behavior | `../../../14-update/01-generic-installer-behavior.md` |
