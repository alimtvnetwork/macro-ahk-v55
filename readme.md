<div align="center">

<img src="docs/assets/marco-logo.gif" alt="Marco Extension animated logo" width="160" height="160" />

# <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/windows8/windows8-original.svg" alt="Windows" width="28" height="28" align="center" /> Marco Chrome Extension

> **Browser automation for workspace management, credit monitoring, and AI-driven macro execution** — built as a Manifest V3 Chrome extension with a modular standalone script architecture.

&#x200B;<!-- Build & Release --> [![CI](https://img.shields.io/github/actions/workflow/status/alimtvnetwork/macro-ahk-v55/ci.yml.svg?branch=main&label=CI&logo=github&style=flat-square)](https://github.com/alimtvnetwork/macro-ahk-v55/actions/workflows/ci.yml) <!-- Repo activity --> [![Issues](https://img.shields.io/github/issues/alimtvnetwork/macro-ahk-v55.svg?label=Issues&style=flat-square&logo=github)](https://github.com/alimtvnetwork/macro-ahk-v55/issues) [![Pull Requests](https://img.shields.io/github/issues-pr/alimtvnetwork/macro-ahk-v55.svg?label=Pull%20Requests&style=flat-square&logo=github)](https://github.com/alimtvnetwork/macro-ahk-v55/pulls) [![Repo Size](https://img.shields.io/github/repo-size/alimtvnetwork/macro-ahk-v55.svg?label=Repo%20Size&style=flat-square&logo=github)](https://github.com/alimtvnetwork/macro-ahk-v55)
&#x200B;<!-- Community --> <!-- (intentionally empty, see mem://constraints/no-static-mockup-badges) --> <!-- Code-quality --> [![Security Issues](https://img.shields.io/github/issues-search/alimtvnetwork/macro-ahk-v55.svg?query=is%3Aissue%20label%3Asecurity&label=Security%20Issues&style=flat-square&logo=github)](https://github.com/alimtvnetwork/macro-ahk-v55/issues?q=is%3Aissue+label%3Asecurity) [![Dependency PRs](https://img.shields.io/github/issues-pr-raw/alimtvnetwork/macro-ahk-v55.svg?label=Dependency%20PRs&style=flat-square&logo=dependabot)](https://github.com/alimtvnetwork/macro-ahk-v55/pulls?q=is%3Apr+label%3Adependencies) <!-- Stack & standards --> [![License](https://img.shields.io/github/license/alimtvnetwork/macro-ahk-v55.svg?label=License&style=flat-square)](#license)

<img src="docs/assets/marco-extension-hero.png" alt="Marco Chrome Extension — Projects view inside the options page" width="820" />

</div>

<div align="center">

Built and maintained by **[Md. Alim Ul Karim](https://alimkarim.com)** · **[Riseup Asia LLC](https://riseup-asia.com)** · **[xProduct](https://the-xproduct.com)** (home of the **xProgramming** language).

</div>

---

## Install

Marco is a **Windows-first** project. For quick local testing, start with the extension ZIP download. The installer one-liners are listed after it.

### 📦 Download-only (unpack into current folder)

For quick local testing — downloads the release ZIP **into the current folder as a backup** and extracts it as a flat folder (no `v`, no version suffix). The ZIP is kept next to the extracted folder so you can re-extract or archive it; only the extracted folder is overwritten on re-run. No `$HOME` install, no profile changes, no auto-update wiring.

**Windows · PowerShell — latest into `.\marco-extension`:**

```powershell
irm https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/download-extension.ps1 | iex
```

**Windows · PowerShell — pin a version + custom folder name (env-var form, works with `irm | iex`):**

```powershell
$env:MARCO_DL_VERSION='v5.9.0'; $env:MARCO_DL_FOLDER='marco'; irm https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/download-extension.ps1 | iex
```

**Windows · PowerShell — run a local clone with explicit flags:**

```powershell
.\scripts\download-extension.ps1 -Version v5.9.0 -FolderName marco-extension
```

**Windows · PowerShell — source checkout without full-history clone:**

```powershell
irm https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/clone-repo.ps1 | iex
```

After it finishes, load the resulting folder via `chrome://extensions → Load unpacked`. The `marco-extension-v5.9.0.zip` backup sits next to it.

### 🪟 Windows · PowerShell installer (latest)

```powershell
irm https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/install.ps1 | iex
```

### 🐧 macOS · Linux · Bash installer (latest)

```bash
curl -fsSL https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/install.sh | bash
```

### 📌 Pinned version (`v5.9.0`)

```powershell
# Windows · PowerShell
irm https://github.com/alimtvnetwork/macro-ahk-v55/releases/download/v5.9.0/install.ps1 | iex


```

```bash
# macOS · Linux · Bash
curl -fsSL https://github.com/alimtvnetwork/macro-ahk-v55/releases/download/v5.9.0/install.sh | bash


```

**Pinned version:** `v5.9.0` &nbsp;•&nbsp; **Macro Controller:** `v5.9.0`

> **v2.243.0 release-asset fix (historical):** the previous release pipeline pointed at a legacy `chrome-extension/dist/` subfolder that no longer exists (the unpacked extension is built into `chrome-extension/` itself — see `vite.config.extension.ts` and `powershell.json → distDir`). That mismatch caused `marco-extension-{VER}.zip` to be silently absent from the GitHub Releases page. The workflow now zips `chrome-extension/` directly and fails fast if the extension zip is missing or `< 10 KiB`. RCA: [`mem://constraints/chrome-extension-dist-path`](.lovable/memory/constraints/chrome-extension-dist-path.md).

> Jump straight to your platform: **[🪟 Install on Windows (PowerShell)](#-install-on-windows-powershell)** &nbsp;•&nbsp; **[🐧 Install on Linux / macOS (Bash)](#-install-on-linux--macos-bash)** &nbsp;•&nbsp; **[Full Quick Start](#quick-start)**

---

## About Marco

Marco started as a small itch. **Alim** wanted to automate a few repetitive things on Chrome using **AutoHotkey** — just keystrokes and clicks at first. One script led to another, and soon he was recording flows, parameterizing them, and wiring them into proper programs. What began as a Windows-only AHK helper grew into a full browser-side automation runtime: a Manifest V3 Chrome extension with a modular standalone-script architecture, deterministic XPath replay, credit-aware loop control, and an AutoHotkey sidecar that still drives the Windows side.

In short: Marco is the project that came out of taking "let me just automate this one thing" seriously.

Marco is one of several operational systems that share the **xProduct** runtime philosophy: modular infrastructure, typed declarative flows (**xProgramming**), and edge-ready execution.

---

## Quick Start

Pick your platform — each section is a self-contained install path with the recommended one-liner, flags, and a link to the deeper reference.

### 🪟 Install on Windows (PowerShell)

**Recommended path.** Open **PowerShell** (Win + X → "Windows PowerShell" or "Terminal") and run:

```powershell
irm https://github.com/alimtvnetwork/macro-ahk-v55/releases/download/v5.9.0/install.ps1 | iex


```

- 🔒 Pinned to `v5.9.0` — see [Pinned to a specific release](#-pinned-to-a-specific-release) to change versions
- 🌊 Want auto-update? Use the [latest channel](#-latest-channel-auto-update) one-liner
- 📁 Custom install folder? See [Custom Directory Install](#custom-directory-install)
- 🚩 Full flag list, exit codes, checksum behavior → [Installer Options](#installer-options)

### 🐧 Install on Linux / macOS (Bash)

Open your terminal and run:

```bash
curl -fsSL https://github.com/alimtvnetwork/macro-ahk-v55/releases/download/v5.9.0/install.sh | bash


```

- 🔒 Pinned to `v5.9.0` — see [Pinned to a specific release](#-pinned-to-a-specific-release) for other tags
- 🌊 Auto-update channel → [latest channel](#-latest-channel-auto-update)
- 📁 Custom install folder? See [Custom Directory Install](#custom-directory-install)
- 🚩 Full flag list, exit codes, checksum behavior → [Installer Options](#installer-options)

---

### One-Liner Install (all variants)

The unified installer auto-derives the pinned version from its download URL. Use a **release-asset URL** to pin to that exact release, or use **`raw.githubusercontent.com/.../main/`** for the auto-update channel.

#### 🔒 Pinned to a specific release

```powershell
# PowerShell (Windows) — replace v4.109.0 with any released tag
irm https://github.com/alimtvnetwork/macro-ahk-v55/releases/download/v5.9.0/install.ps1 | iex
```

```bash
# Bash (Linux / macOS)
curl -fsSL https://github.com/alimtvnetwork/macro-ahk-v55/releases/download/v5.9.0/install.sh | bash
```

#### 🌊 Latest channel (auto-update)

```powershell
irm https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/install.ps1 | iex
```

```bash
curl -fsSL https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/install.sh | bash
```

#### 📁 Latest into the current folder (one-liner, no version)

Since **v4.154.0** the Bash installer defaults its target to `$(pwd)/marco-extension` — the plain curl-pipe one-liner drops the extension into whatever directory you ran it from, never into `$HOME`. PowerShell has the same behavior via `-InstallDir (Join-Path $PWD 'marco-extension')`.

```bash
# Bash (Linux / macOS) — installs to ./marco-extension under the CURRENT directory
cd ~/projects/my-workspace
curl -fsSL https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/install.sh | sh
# → ~/projects/my-workspace/marco-extension/
```

```powershell
# PowerShell (Windows) — installs to .\marco-extension under the current folder
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/install.ps1))) -InstallDir (Join-Path $PWD 'marco-extension')
```

To target a different folder from the pipe, pass `--install-dir` (PowerShell parity flag, since v4.158.0). `--dir` and `-d` remain as aliases.

```bash
curl -fsSL https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/install.sh | sh -s -- --install-dir "$PWD/tools/marco"
```

#### Override the resolved version

```powershell
& { $Version = "v2.220.0"; irm https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/install.ps1 | iex }
```

```bash
curl -fsSL https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/install.sh | sh -s -- --version v2.220.0
```

### Custom Directory Install

**Windows (PowerShell):**

```powershell
.\install.ps1 -InstallDir "D:\marco-extension"
```

**Linux / macOS — `scripts/install.sh --install-dir` examples:**

All four spellings are equivalent. Pick whichever reads best in your shell; the canonical flag is `--install-dir`.

```bash
# Canonical, space-separated
./install.sh --install-dir ~/marco-extension

# Canonical, equals-joined (useful in pipelines / CI vars)
./install.sh --install-dir=/opt/marco-extension

# Path containing spaces — quote it (either form works)
./install.sh --install-dir "$HOME/Marco Tools/marco-extension"
./install.sh --install-dir="$HOME/Marco Tools/marco-extension"

# Short aliases (identical behavior)
./install.sh --dir ./tmp/marco-extension
./install.sh -d /var/tmp/marco-extension

# Pipe form — pass flags after `bash -s --`
curl -fsSL https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/install.sh \
  | bash -s -- --install-dir "$HOME/marco-extension"
```

Precedence: **CLI flag > default (`$(pwd)/marco-extension`)**. Relative paths resolve against `$PWD` at mkdir time; trailing slashes are accepted. Missing target directories are created automatically.




### Installer Options

> 📘 **Full reference:** [`docs/installer-guide.md`](docs/installer-guide.md) — CLI flags, exit codes, checksum behavior, warnings glossary, and troubleshooting.

The installers (`install.ps1`, `install.sh`) conform to the [Generic Installer Behavior spec](spec/14-update/01-generic-installer-behavior.md). Behavior is determined by **how the installer was invoked**, not by build-time stamping. Both installers read shared defaults from [`scripts/installer-contract.json`](scripts/installer-contract.json) (CI-enforced — they cannot drift).

#### Strict mode vs Discovery mode

| Mode | Triggered when | Banner shown | API call? | Sibling discovery? |
|------|----------------|--------------|-----------|--------------------|
| 🔒 **Strict** | The script was downloaded from a `releases/download/vX.Y.Z/` URL **OR** invoked with `--version vX.Y.Z` (any explicit semver) | `🔒 Strict mode — pinned to vX.Y.Z` | No — installs that exact version, never falls back | **Never** (locked out by spec §4 rule 6) |
| 🌊 **Discovery** | No version override **and** no release-asset URL hint, **OR** `--version latest` | `🌊 Discovery mode — resolved vX.Y.Z` | Yes — `GET /repos/{owner}/{repo}/releases/latest` | Optional, off by default — opt in via config (see below) |

**Strict mode is fail-fast.** If the pinned release ZIP is missing, the installer exits 4 — it will *not* silently fall back to a different version, the main branch, or a sibling repo. Discovery mode tolerates more (latest API + optional sibling probing + main-branch fallback once §4 lands).

#### Common flags

**Windows (PowerShell — `install.ps1`):**

| Flag | Description | Example |
|------|-------------|---------|
| `-Version` | Pin a specific release (`vX.Y.Z[-pre]`) or `latest` | `-Version v5.9.0` |
| `-InstallDir` | Custom install directory | `-InstallDir D:\marco-extension\v3.6.1` |
| `-Repo` | Override GitHub `owner/repo` | `-Repo alimtvnetwork/macro-ahk-v55` |
| `-Help` | Print usage and exit 0 | `-Help` |

**Linux / macOS (Bash — `install.sh`):**

| Flag | Short | Description | Example |
|------|-------|-------------|---------|
| `--version <ver>` | `-v` | Force a specific version (`vX.Y.Z[-pre]`) or `latest`. Anything else exits 3. | `--version v4.109.0` |
| `--install-dir <path>` | `--dir`, `-d` | Target directory. **Default since v4.154.0: `$(pwd)/marco-extension`** (was `~/marco-extension`). `--install-dir` matches PowerShell's `-InstallDir`. | `--install-dir ~/marco-extension/v4.109.0` |
| `--repo <o/r>` | `-r` | Override GitHub `owner/repo` | `--repo alimtvnetwork/macro-ahk-v55` |
| `--dry-run` | — | Resolve the install plan, print it, exit 0 — **nothing is downloaded or extracted**. Useful for CI smoke tests and debugging. | `--dry-run --version v4.109.0` |
| `--no-sibling-discovery` | — | Disable §4 sibling-repo probing for this run (overrides `install.config.sh`). Strict mode would skip it anyway. | `--no-sibling-discovery` |
| `--enable-sibling-discovery` | — | Force-enable sibling probing for this run. **Still blocked by strict mode** (spec §4 rule 6). | `--enable-sibling-discovery` |
| `--help` | `-h` | Print full usage with the spec link, then exit 0 | `--help` |

#### Exit codes

The installer follows a fixed exit-code contract (see [spec §3](spec/14-update/01-generic-installer-behavior.md) and [`installer-contract.json`](scripts/installer-contract.json)):

| Code | Meaning | When it fires |
|------|---------|---------------|
| `0` | Success | Install completed, or `--dry-run` / `--help` finished cleanly |
| `1` | Preflight failure | OS detection failed, missing required tools (e.g. `unzip`), or unhandled error |
| `3` | Invalid `--version` argument | Anything that doesn't match `vX.Y.Z[-prerelease]` or the literal `latest` |
| `4` | Targeted release asset missing (strict mode only) | The pinned ZIP returns 404. Installer **never** falls back. |
| `5` | Network or tooling error | API unreachable in discovery mode, or neither `curl` nor `wget` is on `PATH` |
| `6` | Invalid archive or **checksum mismatch** | ZIP extracted to no files, `manifest.json` missing, or SHA-256 doesn't match `checksums.txt` |

Code `2` is reserved for future use. CI scripts can rely on these — they're covered by [`tests/installer/resolver.test.sh`](tests/installer/resolver.test.sh) (46 cases) and [`tests/installer/mock-server.test.sh`](tests/installer/mock-server.test.sh) (62 cases). Drift between the two installers is prevented by [`scripts/check-installer-contract.mjs`](scripts/check-installer-contract.mjs).

#### Checksum verification (since v2.227.0)

Every release ships a `checksums.txt` file. The installer fetches it from the same release, computes SHA-256 of the downloaded zip, and aborts on mismatch with **exit 6**.

| Outcome | What you see | Action |
|---|---|---|
| ✅ Match | `✓ checksum OK (sha256=…)` | Install continues |
| ❌ Mismatch | `✗ checksum MISMATCH — expected …, got …` | **Exit 6.** Re-download — do not retry blindly. |
| ⚠️ Missing `checksums.txt` | `⚠ checksums.txt not found — skipping integrity check` | Continues (back-compat with pre-v2.227.0 releases) |
| ⚠️ No SHA tool (Bash only) | `⚠ no sha256sum/shasum/openssl available — skipping` | Continues. Install `coreutils` to enable. |

Bash uses `sha256sum` → `shasum -a 256` → `openssl dgst -sha256` (first available wins). PowerShell uses the built-in `Get-FileHash`. See [`docs/installer-guide.md` §5](docs/installer-guide.md#5-checksum-verification-sha-256) for the full rundown.

#### Main-branch fallback (since v2.226.0)

In **discovery mode**, if the GitHub API responds `200 OK` with zero releases (or `404 Not Found` for `/releases/latest`), the installer falls back to `archive/refs/heads/<MAIN_BRANCH>.tar.gz` and records the version as `<branch>@HEAD`. You'll see the `🌿 Discovery mode — main branch (no releases found)` banner. **Network failures (5xx, DNS error) still exit 5** — the installer never silently falls through to `main` if the user might have wanted a real release.

#### Sibling-repo discovery (advanced)

When the project ships successive major rewrites in sibling repos (e.g. `macro-ahk-v55` → `macro-ahk-v55` → `macro-ahk-v55`), discovery mode can optionally probe ahead and pick the newest. Defaults live in [`scripts/install.config.sh`](scripts/install.config.sh) and are **off by default**:

```bash
SIBLING_DISCOVERY_ENABLED=0          # opt-in
SIBLING_NAME_PATTERN="macro-ahk-v{N}"
SIBLING_PROBE_DEPTH=20
SIBLING_PARALLELISM=8
SIBLING_PROBE_TIMEOUT_SECS=5
```

Override priority (lowest → highest):

1. Built-in defaults (off)
2. `scripts/install.config.sh` next to the installer (or `$MARCO_INSTALLER_CONFIG`)
3. Environment variables of the same name
4. `--enable-sibling-discovery` CLI flag
5. `--no-sibling-discovery` CLI flag
6. **Strict-mode lockout — beats everything** (spec §4 rule 6)

Use `--dry-run` to inspect the resolved decision without installing — the plan prints `Sibling discovery: <state> — <reason>`.

#### Examples

```bash
# Preview what would happen with the latest release — no network writes:
curl -fsSL https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/install.sh \
  | bash -s -- --dry-run

# Pin a specific version into a custom directory:
./install.sh --version v4.109.0 --dir ~/marco-extension/v4.109.0

# Force-enable sibling-repo discovery for this one run:
./install.sh --enable-sibling-discovery

# Print full usage and the spec link:
./install.sh --help
```

### Manual Install

1. Download `marco-extension-v{VERSION}.zip` from [Releases](https://github.com/alimtvnetwork/macro-ahk-v55/releases)

2. Extract to a folder (e.g., `D:\marco-extension\v4.109.0`)
3. Open `chrome://extensions` (or `edge://extensions`)
4. Enable **Developer mode** (toggle in top-right)
5. Click **Load unpacked** and select the extracted folder

Works in **Chrome**, **Edge**, **Brave**, **Arc**, and other Chromium browsers.

---

## Companion Repositories

Marco ships alongside an AutoHotkey sidecar that drives keyboard/mouse automation on Windows. Clone it next to this repo:

```bash
git clone --depth=1 --single-branch --filter=blob:none --no-tags https://github.com/alimtvnetwork/macro-ahk-v55.git "macro-ahk"
```

Or use the package.json script:

```bash
pnpm clone:ahk
```

This creates a `macro-ahk/` folder containing the AHK v2 scripts that pair with the Chrome extension's macro controller. The package script also rewrites the stale `alimtvnetwork/macro-ahk-v55` owner to `alimtvnetwork/macro-ahk-v55` before cloning.

If a full repository checkout is needed on Windows and GitHub resets the clone, use the guarded source helper instead of raw `git clone`:

```powershell
irm https://raw.githubusercontent.com/alimtvnetwork/macro-ahk-v55/main/scripts/clone-repo.ps1 | iex
```

See `docs/extension-architecture.md` §11 "Companion repositories" for integration details, version coupling, and required folder layout.

---

## What It Does

Marco is a Chrome extension that automates workspace management workflows through injectable scripts. It operates by injecting standalone JavaScript modules into web pages, controlled by a popup UI and a background service worker.

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Script Injection Engine** | Injects IIFE-compiled scripts into page context (MAIN world) with dependency resolution and load ordering |
| **Macro Controller** | Core automation controller — XPath utilities, auth panel, token resolution, UI overlays |
| **Credit Monitoring** | Real-time credit balance checking with workspace-level tracking and retry-on-refresh policy |
| **Workspace Management** | Automated workspace switching, transfer dialogs, and multi-workspace operations |
| **Loop Engine** | Configurable automation loops with delay, retry, and condition-based stopping |
| **AI Prompt System** | Dual-cache prompt management with IndexedDB storage, manual-load model, and normalization |
| **Auth Bridge** | Zero-network JWT resolution waterfall with 2-step recovery and token caching |
| **Session Logging** | Dual-layer logging to SQLite + Origin Private File System with diagnostics export |
| **Self-Healing Storage** | Two-stage builtin script guard that detects and repairs corrupted script storage |
| **Build-Aware Cache** | Injection cache invalidation tied to build version, preventing runtime drift |

### Script Architecture

The extension uses a **declarative, instruction-driven** architecture. Each standalone script defines its own `instruction.ts` manifest that declares:

- Script metadata (name, version, description)
- Dependencies and load order
- CSS, templates, and configuration files
- Injection world (MAIN or ISOLATED)

Scripts are compiled to **IIFE bundles** (no module imports at runtime) and injected in dependency order: CSS → configs → templates → JS.

### Default Scripts

| Script | Purpose | Default |
|--------|---------|---------|
| **Marco SDK** | Shared SDK providing `require()`, messaging, and utility functions | Always loaded |
| **XPath** | XPath query utilities for DOM element selection | Enabled |
| **Macro Controller** | Core controller — auth, UI, credit checking, workspace automation | Enabled |

---

## Features In Detail

### 📖 Chat History (per-project transcript)

Marco captures every chat submission you make into a Lovable project (paste, Repeat loop iteration, Next chip staging, Plan chip staging) and stores it locally so you can review, export, and prune your prompt history.

**Where to find it:** Menu → `📖 Chat History`.

**What it shows:** The most recent submissions for the current project — source (`paste` / `repeat` / `next-chip` / `plan-chip`), character count, timestamp in your local timezone, and a 240-char body preview.

**Actions:**
- **Copy JSON** — clipboard-copies a schema-versioned envelope: `{ schemaVersion: 1, projectId, exportedAt, entryCount, entries[] }`. Safe to paste into a gist or an issue for support.
- **Delete** — removes the SQLite row and the OPFS blob atomically (OPFS-first so an interrupted delete never leaves an orphan blob).
- **Refresh** — re-reads the store.

**Storage model:**
- **SQLite** (`ProjectChatSubmit` table): one metadata row per submission — `Id`, `ProjectId`, `ProjectName`, `Source`, `FileId`, `CharCount`, `CreatedAt`, `MetaJson`.
- **OPFS** (`chat-submits/<projectId>/<fileId>.txt`): the raw submission text. Kept out of SQLite so the DB bundle stays lean.

**Retention:** A rolling window of 300 submissions per project (default). Excess oldest rows and their OPFS blobs are pruned automatically on every capture. Override per-project by setting `Project.ChatSubmitCap.<projectId>` (integer between 10 and 5000) in `chrome.storage.local`.

**Verbose gate:** When per-project **verbose logging** is OFF (the default), the OPFS body is stored as `[redacted]` — but `CharCount` remains true so analytics stay honest. Enable verbose logging in Options → Debugging Switch to capture full text.

**Rename backfill:** When Lovable renames a project, `ProjectName` back-fills across every historical row for that project on the next submission — no stale names in your history.

---



### Popup UI

The popup provides real-time control over script injection and diagnostics:

| Control | What It Does |
|---------|--------------|
| **Run** | Clears DOM markers, injects all enabled scripts from the active project |
| **Toggle** | Enables/disables the active project (persists across sessions) |
| **Per-Script Toggle** | Enable/disable individual scripts — state persists across restarts |
| **Re-inject** | Clears existing injections, re-injects all enabled scripts fresh |
| **Logs** | Copies session logs + errors as JSON to clipboard |
| **Export** | Downloads ZIP with logs, errors, and SQLite database |
| **Auth Diagnostics** | Real-time token status with contextual help tooltips |

### Options Page

Full-featured settings UI with:

- Hash-based deep linking (e.g., `#activity`)
- Direction-aware slide-and-fade view transitions
- Activity log viewer with filtering
- Script configuration management
- Advanced automation (chains & scheduling)

### Injection Diagnostics

Granular visual feedback per script:

| Badge | Meaning |
|-------|---------|
| Disabled | Script toggled off by user |
| Missing | Script file not found in storage |
| Injected | Successfully injected into page |
| Failed | Injection error (check debug panel) |

### Authentication

- **Zero-network resolution** — JWTs resolved from local storage waterfall before any network calls
- **2-step recovery** — Auth Bridge attempts cached token, then page extraction
- **Extension context invalidation** — Detected and explained via help tooltips when extension reloads

### Logging & Export

- **SQLite persistence** — Unlimited storage with structured queries
- **OPFS fallback** — Origin Private File System for crash-resilient writes
- **Diagnostics ZIP** — Human-readable `logs.txt` + raw data for debugging
- **Error synchronization** — Error counts broadcast across extension contexts in real-time

---

## Architecture

### Extension Lifecycle (6 Phases)

```
1. Install + Bootstrap     → Manifest loading, SQLite init
2. Seeding                 → seed-manifest.json → chrome.storage.local
3. Script Pre-caching      → Parallelized fetch of all script files
4. Injection               → Dependency resolution → CSS → configs → templates → JS
5. Runtime                 → Auth bridge, credit monitoring, loop engine
6. Export / Cleanup        → Diagnostics ZIP, session teardown
```

### Message Relay (3-Tier)

```
Page Scripts (MAIN world)
    ↕ window.postMessage
Content Scripts (ISOLATED world)
    ↕ chrome.runtime.sendMessage
Background Service Worker
    ↕ chrome.storage.local
Popup / Options UI
```

### Storage Layers

| Layer | Capacity | Purpose |
|-------|----------|---------|
| SQLite (Extension) | Unlimited | Persistent logs, diagnostics |
| chrome.storage.local | 10 MB | Script metadata, settings, state |
| IndexedDB | Unlimited | Prompt cache (dual JSON/text) |
| OPFS | Unlimited | Crash-resilient log writes |

#### Storage Migration Policy

> ⛔ **Phase 2c-storage v2 is permanently banned.** Rewriting `StoredProject` keys in `chrome.storage.local` from camelCase to PascalCase would break ~50+ downstream consumers and is blocked at three layers.

**Banned behavior** (never ship):
- Renaming/rewriting persisted `StoredProject` keys (e.g. `name` → `Name`, `urlPatterns` → `UrlPatterns`).
- Any migration with `version > MAX_ALLOWED_STORAGE_SCHEMA_VERSION` (currently `1`).
- Helpers named `renameStorageKey`, `migrateStoredProjectKeys`, `pascalCaseStoredProject`, or equivalents.
- `chrome.storage.local.set({ PascalKey: ... })` writes against project payloads.

**Enforcement layers:**
1. **Runtime guard** — `assertNoPascalCaseStorageMigration()` in `src/background/storage-migration.ts` throws before any out-of-range migration executes.
2. **CI check** — `pnpm run check:no-storage-pascalcase-rewrite` (wired into `build` + `build:dev`) scans `src/` and `standalone-scripts/` for violations.
3. **Memory rule** — `mem://constraints/no-storage-pascalcase-migration` blocks the agent from re-proposing it.

**Permitted migration behavior:**
- Additive, backward-compatible changes only (new optional fields, new top-level keys).
- Bump `CURRENT_STORAGE_SCHEMA_VERSION` **and** `MAX_ALLOWED_STORAGE_SCHEMA_VERSION` together when adding a new migration.
- Identity-only PascalCase compat snapshots emitted *in-memory* (e.g. `compile-instruction` dual-emit) are fine — the persisted shape must remain camelCase.
- Read-side normalization (accept both shapes, write camelCase) is fine.
- Deletions/renames of persisted keys require a written RFC and explicit user sign-off.

### Performance Optimizations

- **DomCache** with TTL for repeated DOM queries
- **Merged MutationObservers** — single observer, multiple handlers
- **API call deduplication** via `CreditAsyncState`
- **Dirty-flag UI updates** — `updateUILight()` skips unchanged elements
- **Batched localStorage writes** via `LogFlushState`

---

## Build Pipeline

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+

### Development

```bash
pnpm install
pnpm run dev
```

Load `chrome-extension/` (at the repo root, **not** `dist/`) as an unpacked extension in Developer mode.

### Production Build (Full Pipeline)

```bash
pnpm run build:sdk              # 1. Marco SDK (IIFE)
pnpm run build:xpath            # 2. XPath utility
pnpm run build:macro-controller # 3. Macro Controller (includes LESS, templates, prompts)
pnpm run build:extension        # 4. Chrome extension (copies all artifacts)
```

### Build Commands

| Command | What It Does |
|---------|-------------|
| `pnpm run build:sdk` | Compile Marco SDK → IIFE bundle + `.d.ts` |
| `pnpm run build:xpath` | Compile XPath utility → IIFE bundle |
| `pnpm run build:macro-controller` | Compile Macro Controller → IIFE + CSS + templates + prompts |
| `pnpm run build:extension` | Build Chrome extension (validates + copies all standalone scripts) |
| `pnpm run check:manifest` | Validate **source** `manifest.json` (version sync, permissions, CSP must allow Wasm) |
| `pnpm run check:built-csp` | Validate **built** `chrome-extension/manifest.json` CSP + print reload checklist |
| `pnpm run build:prompts` | Aggregate prompt `.md` files → `macro-prompts.json` |
| `pnpm run build:macro-less` | Compile LESS → CSS |
| `pnpm run build:macro-templates` | Compile HTML templates → `templates.json` |
| `pnpm run test` | Run test suite (Vitest) |
| `pnpm run lint` | ESLint with SonarJS (zero warnings enforced) |

### Build via PowerShell (Windows)

```powershell
.\run.ps1 -d     # Full deploy pipeline: build all + deploy to Chrome profile
.\run.ps1         # Production build (no source maps)
```

The `run.ps1` orchestrator is modular — 8 dot-sourced modules in `build/ps-modules/`:

| Module | Purpose |
|--------|---------|
| `utils.ps1` | Version parsing, pnpm helpers |
| `preflight.ps1` | Dynamic import/require scanning |
| `standalone-build.ps1` | Parallel standalone builds via `Start-Job` |
| `extension-build.ps1` | Extension build + manifest validation |
| `browser.ps1` | Profile detection, extension deployment |
| `watch.ps1` | FileSystemWatcher with debounce |

### Built Extension Layout (`chrome-extension/`)

The build pipeline emits the load-unpacked artifact directly to `./chrome-extension/` at the repo root (per `powershell.json → distDir = "chrome-extension"`). This is the folder you point Chrome's **Load unpacked** at — *not* `dist/`, which is reserved for the Lovable preview / web-app build.

```
chrome-extension/
├── projects/
│   ├── scripts/
│   │   ├── marco-sdk/
│   │   │   ├── marco-sdk.js
│   │   │   └── instruction.json
│   │   ├── xpath/
│   │   │   ├── xpath.js
│   │   │   └── instruction.json
│   │   └── macro-controller/
│   │       ├── macro-looping.js
│   │       ├── macro-looping.css
│   │       ├── macro-looping-config.json
│   │       ├── macro-theme.json
│   │       ├── templates.json
│   │       └── instruction.json
│   └── seed-manifest.json
├── prompts/
│   └── macro-prompts.json
├── manifest.json                 # Built MV3 manifest (CSP-validated post-build)
├── readme.md
├── VERSION
└── ...
```

---

## MV3 CSP & sql.js (`'wasm-unsafe-eval'`)

The extension uses **sql.js** (a WebAssembly build of SQLite) as its
session/log store. Under Manifest V3 the default Content Security Policy
applied to `extension_pages` is:

```
script-src 'self'; object-src 'self'
```

That default **forbids `WebAssembly.instantiate()`** — the browser will
fetch `sql-wasm.wasm` successfully (HTTP 200, correct byte length) and
then refuse to compile it with:

```
CompileError: WebAssembly.instantiate(): Compiling or instantiating
WebAssembly module violates the following Content Security policy
directive ... "script-src 'self'".
```

Symptoms: the popup boots into the `BootFailureBanner` with
`Failed step: db-init` and a misleading "WASM is corrupted" hint, even
though the WASM is fine.

The fix is one line in `manifest.json` — add `'wasm-unsafe-eval'` to the
`script-src` directive of `extension_pages`:

```json
"content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
}
```

This is the modern (Chrome 95+) MV3-blessed directive specifically for
Wasm; **do not** use `'unsafe-eval'` (rejected by Web Store review) or
the legacy `'wasm-eval'` (Chrome-only, undocumented).

### Verifying after each manifest change

Two independent guards live in this repo and run on every build, and you
can also run them by hand any time you touch `manifest.json`:

```bash
# 1. Source-manifest preflight — runs BEFORE Vite, fails the build if
#    the source manifest's CSP is missing or doesn't allow Wasm.
pnpm run check:manifest

# 2. Build the extension. The pipeline ends with check:built-csp, which
#    re-validates chrome-extension/manifest.json AFTER Vite has rewritten
#    path fields, then prints a 4-step reload-and-verify checklist.
pnpm run build:extension

# 3. Manual re-validation against the built artifact.
pnpm run check:built-csp
```

Both checks emit a CODE RED block (exact path, what's missing, why) and
exit 1 on failure. CI also runs the dedicated
`verify-built-manifest-csp` job against the uploaded
`chrome-extension/` artifact, with a `grep` fallback so the regression
is caught even if the Node validator itself is broken. Any future
browser-based smoke test must declare `needs: verify-built-manifest-csp`
so we never burn browser-runner minutes on a build that can't boot.

### One-time browser confirmation

After running `pnpm run build:extension`, follow the printed checklist:

1. Open `chrome://extensions`
2. Find **Marco Macro Extension** vX.Y.Z, click the reload icon
3. Open the extension popup (toolbar icon)
4. Confirm the `BootFailureBanner` is **gone** — no `WASM load (wasm)`
   failure, no CSP `CompileError`. If the banner is still there, open
   *Inspect views → service worker → Console* on `chrome://extensions`
   for the actual error.

---

## Adding a New Script

1. Create `standalone-scripts/{name}/src/index.ts` and `src/instruction.ts`
2. Add `build:{name}` script in root `package.json`
3. Add TypeScript config (`tsconfig.{name}.json`)
4. Add Vite config (`vite.config.{name}.ts`)
5. The build pipeline auto-discovers and deploys it

The `instruction.ts` is the **sole manifest** — no separate configuration files needed. It declares script metadata, dependencies, files, and injection behavior in a single TypeScript file that compiles to `instruction.json`.

### Dynamic Script Loading

At runtime, scripts can load other scripts dynamically:

```typescript
await RiseupAsiaMacroExt.require("Project.Script");
```

---

 ## CI/CD Release Pipeline

Pushing a `v*` tag triggers release mode and:

1. Installs dependencies with pnpm; if `pnpm-lock.yaml` is absent it falls back to `pnpm install --no-frozen-lockfile --lockfile=false`
2. Runs root ESLint and `chrome-extension` ESLint
3. Runs the full test suite
4. Builds standalone scripts (SDK → XPath → Macro Controller)
5. Builds the Chrome extension
6. Copies `readme.md`, `VERSION`, and `changelog.md` into the release asset set
7. Zips `chrome-extension/` into `marco-extension-v{VERSION}.zip`
8. Generates categorized release notes from commit history with Bash + PowerShell install commands
9. Creates or updates the GitHub Release page with all assets attached

**No email or notification is sent** — check the [Releases page](https://github.com/alimtvnetwork/macro-ahk-v55/releases) for status.

**For maintainers:** the canonical release procedure (tag-push ritual, recovery via `workflow_dispatch`, forbidden paths) is documented in [`spec/21-app/02-features/chrome-extension/release-procedure.md`](spec/21-app/02-features/chrome-extension/release-procedure.md).

### Re-running CI lint

If the **`Preflight · ESLint (Standalone Scripts)`** job fails or shows
stale warnings, follow the step-by-step guide:
[`docs/ci/rerun-standalone-lint.md`](docs/ci/rerun-standalone-lint.md).
It covers re-running the job on the latest commit, verifying the SHA
via the diagnostics step, reproducing the lint locally, and clearing
the GitHub Actions cache (UI + `gh` CLI) when warnings persist.

### How to release

`version.json` is the single source of truth. Cutting a release is one version edit, plus an optional matching Git tag when publishing is needed.

1. Bump `version.json` (`X.Y.Z` to `X.(Y+1).0` for a MINOR).
2. Create the matching `v<version>` tag only when publishing is needed.

The `v*` tag triggers `.github/workflows/release.yml`, which reads `version.json` and builds the assets. Do not hand-edit downstream version pins, and do not re-add stale-version, release-readiness, version-propagation, or release-asset-manifest CI gates. Full canonical flow: `.lovable/memory/workflow/release-ceremony.md`.

### Release Assets

| Asset | Description |
|-------|-------------|
| `marco-extension-v{VER}.zip` | Chrome extension — load unpacked in `chrome://extensions` |
| `macro-controller-v{VER}.zip` | Standalone macro controller scripts |
| `marco-sdk-v{VER}.zip` | Marco SDK |
| `xpath-v{VER}.zip` | XPath utility scripts |
| `install.ps1` | PowerShell installer (Windows) |
| `install.sh` | Bash installer (Linux/macOS) |
| `VERSION.txt` | Version identifier |
| `changelog.md` | Full project changelog |

### Release Install Commands

**Windows (PowerShell)**

```powershell
irm https://github.com/alimtvnetwork/macro-ahk-v55/releases/download/v{VER}/install.ps1 | iex
```

**Linux / macOS**

```bash
curl -fsSL https://github.com/alimtvnetwork/macro-ahk-v55/releases/download/v{VER}/install.sh | bash
```

---

## Project Structure

A monorepo with three primary trees: **runtime code** (extension + standalone scripts), **specifications** (`spec/` — v3.5.0 layout), and **build/CI tooling**.

```
.
├── src/                            # Chrome extension source (popup, options, background, content scripts)
│   ├── background/                 # MV3 service worker, seeder, injection diagnostics
│   ├── content/                    # Content-script injection pipeline (ISOLATED world)
│   ├── pages/                      # React popup + options UI (shadcn/ui)
│   ├── components/                 # Shared UI components
│   ├── lib/                        # Platform adapter, auth bridge, utilities
│   ├── shared/                     # Cross-context constants (incl. EXTENSION_VERSION)
│   └── test/                       # Unit + regression tests (Vitest)
│
├── chrome-extension/               # Built MV3 extension — load unpacked from here
│   └── (generated by `pnpm run build:extension`; git-ignored output)
│
├── standalone-scripts/             # Injectable IIFE bundles, each with its own instruction.ts
│   ├── marco-sdk/                  # Shared SDK (require, messaging, utilities)
│   ├── xpath/                      # XPath query utilities
│   ├── macro-controller/           # Core automation controller (largest module)
│   │   ├── src/                    # TypeScript source (class-based modules)
│   │   ├── less/                   # LESS stylesheets → CSS
│   │   ├── templates/              # HTML templates → templates.json
│   │   └── dist/                   # Compiled IIFE + assets + instruction.json
│   └── prompts/                    # AI prompt markdown files
│
├── spec/                           # 📚 Specification tree — Spec Authoring Guide v3.5.0 layout
│   ├── 00-overview.md              # Master index of the entire spec tree
│   ├── 01-spec-authoring-guide/    # ───── FOUNDATIONS (slots 01–20, universal) ─────
│   ├── 02-coding-guidelines/       # 26 engineering rules (TS, Go, PHP, Rust, C#, AI-opt, CI/CD)
│   ├── 03-error-manage/            # Error management patterns + AppError package
│   ├── 04-database-conventions/    # Schema patterns
│   ├── 05-split-db-architecture/   # SQLite organization
│   ├── 06-seedable-config-architecture/
│   ├── 07-design-system/           # Design tokens, UI standards
│   ├── 08-docs-viewer-ui/          # 🟡 stub
│   ├── 09-code-block-system/       # 🟡 stub
│   ├── 10-research/                # 🟡 stub
│   ├── 11-powershell-integration/  # PowerShell installer + integration specs
│   ├── 12-cicd-pipeline-workflows/ # CI/CD specs (incl. repo-rename script)
│   ├── 14-update/                  # 🟡 stub — update mechanism
│   ├── 17-consolidated-guidelines/ # 🟡 stub
│   │   #  Slots 13, 15, 16, 18, 19, 20 reserved for future foundations.
│   │
│   ├── 21-app/                     # ─────────── APP TIER (slots 21+) ───────────
│   │   ├── 00-overview.md          #   App-tree master index
│   │   ├── 01-chrome-extension/    #   Chrome extension specs (architecture, build, messaging)
│   │   ├── 02-features/            #   Other app features
│   │   │   ├── devtools-and-injection/
│   │   │   └── misc-features/
│   │   ├── 03-data-and-api/        #   Data schemas, API samples, DB join specs
│   │   ├── 04-design-diagrams/     #   Mermaid diagrams, visual design
│   │   ├── 05-prompts/             #   AI prompt samples & folder structure
│   │   └── 06-tasks/               #   Roadmap, task breakdowns
│   │
│   ├── 22-app-issues/              # Bug reports, RCAs (103 entries, 0 numbering collisions ✅)
│   ├── 26-macro-controller/        # Macro Controller specs (promoted to top-level)
│   │
│   ├── 99-archive/                 # ─────────── ARCHIVE (frozen historical) ───────────
│   │   ├── governance-history/     #   Original spec-index, reorganization plans
│   │   ├── duplicates/             #   Stale duplicate folders preserved for traceability
│   │   ├── imported-error-management/
│   │   ├── imported-misc/
│   │   ├── imported-powershell-integration/
│   │   ├── wordpress/
│   │   └── 01-overview-legacy/
│   │
│   ├── validation-reports/         # Time-stamped audits (e.g., reorganization-audit, deepdive)
│   ├── .spec-folder-registry.json  # Authoritative folder list — protects sparse dirs from auto-cleanup
│   └── 99-consistency-report.md    # Root-level structural health report
│
├── scripts/                        # 🛠️  Build helpers, validators & install scripts
│   ├── install.ps1 / install.sh    # Unified installer (auto-derives version from URL)
│   ├── compile-instruction.mjs     # instruction.ts → instruction.json
│   ├── aggregate-prompts.mjs       # Prompt .md → macro-prompts.json
│   ├── check-axios-version.mjs     # Pin axios to safe-list versions
│   ├── check-no-pnpm-dlx-less.mjs  # CI preflight (blocks the broken pnpm-dlx-less invocation) <!-- preflight-allow-line -->
│   ├── spec-folder-guard.mjs       # Spec auto-cleanup safeguard (npm: check:spec-folders)
│   └── ... (validators, repo-rename, etc.)
│
├── build/
│   └── ps-modules/                 # PowerShell build modules (utils, preflight, build, browser, watch)
│
├── pipeline/                       # Build & validation pipeline documentation (overview, scripts, gotchas)
├── memory/                         # In-extension memory/context utilities
├── .lovable/                       # Lovable AI memory & plan
│   ├── README.md                   #   Primary AI entry point (read first)
│   ├── MAP.md                      #   Path -> purpose index
│   ├── rules.md                    #   Hard prohibitions
│   ├── memory/                     #   Persistent project memory (index + per-topic files, core.md)
│   ├── plan.md                     #   Authoritative roadmap / backlog
│   └── memory/suggestions/         #   Suggestions tracker (00-current + historical)
│
├── docs/                           # Long-form architecture docs (extension-architecture.md, etc.)
├── tests/                          # Top-level integration / Playwright E2E
├── public/                         # Static assets served by the Lovable preview
├── changelog.md                    # Project changelog (per-version entries)
├── readme.md                       # This file
├── manifest.json                   # MV3 source manifest
├── package.json                    # Workspace scripts (build:*, check:*, test, lint)
├── run.ps1                         # PowerShell orchestrator (-d = full deploy)
└── .github/workflows/              # CI/CD pipelines (release.yml, ci.yml)
```

> **Spec-tree layout authority:** `spec/01-spec-authoring-guide/` is the source of truth. Slots **01–20 are reserved for foundations only** (no app-specific content). App content lives at slot **21+**. The `.spec-folder-registry.json` + `pnpm run check:spec-folders` guards against auto-cleanup pruning sparse folders. Validation reports under `spec/validation-reports/` document migrations and audits.

### `spec/2026-spec/` audit verification

The generated Blind-AI audit under [`spec/2026-spec/_audit-2026-06-05/`](spec/2026-spec/_audit-2026-06-05/) is locked at **100 / 100** across **230 / 230** markdown files. Every source file is at 100, every file is ≥90, and all wired CI gates are green.

```bash
node scripts/audit/render-reports.mjs
python3 scripts/audit/audit-scan.py spec/2026-spec --output=/tmp/scores.json
node scripts/audit/check-acceptance.mjs
node scripts/audit/check-dangling-links.mjs
node scripts/audit/check-constant-divergence.mjs
node scripts/audit/check-must-constants.mjs
node scripts/audit/check-must-memory-refs.mjs
node scripts/audit/check-cross-folder-owners.mjs
node scripts/audit/check-quarantine.mjs
node scripts/audit/check-pitfalls.mjs
node scripts/audit/check-score-floor.mjs
node scripts/audit/check-score-snapshot.mjs
node scripts/lint/no-bare-fetch.mjs
node scripts/audit/check-footer-lint.mjs
sha256sum spec/2026-spec/_audit-2026-06-05/scores.snapshot.json
```

Snapshot hash: `b79ef8f879b41da70a4d78b4b34bc558f843656a2c6fd7466d6098daf2b52c03`

---

## For AI Agents — What To Read First

> Onboarding map for any AI session (including the next instance of yourself).
> Primary entry point: [`.lovable/README.md`](./.lovable/README.md).
> Machine-friendly path index: [`.lovable/MAP.md`](./.lovable/MAP.md).
>
> Together they cover folder structure, JSON contracts, and the full workflows
> for adding a prompt, config key, standalone script, unit test, feature, or spec.

**Minimum reading order on a fresh session:**

1. [`.lovable/README.md`](./.lovable/README.md) - primary AI entry point
2. [`.lovable/MAP.md`](./.lovable/MAP.md) - path -> purpose index
3. [`.lovable/rules.md`](./.lovable/rules.md) - hard prohibitions
4. [`.lovable/memory/core.md`](./.lovable/memory/core.md) + [`.lovable/memory/index.md`](./.lovable/memory/index.md) - always-loaded rules + topic index
5. [`.lovable/coding-guidelines.md`](./.lovable/coding-guidelines.md) - engineering rules
6. [`.lovable/plan.md`](./.lovable/plan.md) - active prioritized backlog
7. `spec/00-overview.md` - spec-tree master index
8. `spec/26-macro-controller/` - Macro Controller architecture + JSON contracts
9. `readme.md` § Project Structure (above) - folder layout

**What the onboarding map covers (so you don't have to re-derive it):**

- §1 — Project orientation reading order
- §2 — Canonical JSON contracts (config, prompts, theme, instruction, templates) + their generators and CI guards
- §3 — Adding a new prompt (slug folder + `info.json` + aggregator)
- §4 — Adding a new config key (validator + seeded JSON + test + version bump)
- §5 — Adding a new standalone script (scaffold + injection + spec + memory)
- §6 — Where tests live + how to add them next to a new feature/fix
- §6.1 — Unit test template (Vitest, RTL, chrome-API mocking)
- §6.2 — End-to-end feature workflow (spec → plan → code → test → memory → version)
- §6.3 — Adding a new spec (slot picker + authoring-guide template + CI guard)
- §7 — Folder cheat-sheet
- §8 — Hard rules when touching JSON / generated files



### Canonical JSON contracts (Macro Controller)

All runtime JSON is **generated from source** — edit the source, not the JSON.

| JSON (output) | Source of truth | Generator |
|---------------|-----------------|-----------|
| `standalone-scripts/macro-controller/02-macro-controller-config.json` | `standalone-scripts/macro-controller/src/config-validator.ts` + `src/instruction.ts` | `scripts/compile-instruction.mjs` |
| `standalone-scripts/macro-controller/03-macro-prompts.json` | `standalone-scripts/prompts/<NN-slug>/prompt.md` + `info.json` | `scripts/aggregate-prompts.mjs` |
| `standalone-scripts/macro-controller/04-macro-theme.json` | `standalone-scripts/macro-controller/less/` + `config-validator.ts` defaults | build pipeline |
| `standalone-scripts/<script>/dist/instruction.json` | `standalone-scripts/<script>/src/instruction.ts` | `scripts/compile-instruction.mjs` |
| `standalone-scripts/macro-controller/dist/templates.json` | `standalone-scripts/macro-controller/templates/*.html` | `scripts/compile-templates.mjs` |

CI guards: `check-prompt-info-casing.mjs`, `check-instruction-json-casing.mjs`,
`check-pascalcase-instruction-migration.mjs`, `validate-instruction-schema.mjs`.

### Adding a new prompt (a.k.a. "slug")

1. Create `standalone-scripts/prompts/<NN-slug>/` (next free numeric prefix).
2. Add **two** files:
   - `prompt.md` — full prompt body
   - `info.json` — `{ name, slug, id: "default-<slug>", version, order, isDefault, category }`
3. Run `node scripts/aggregate-prompts.mjs` (also wired into the build).
4. Bump the patch version across **all five** pinning points (`manifest.json`,
   `src/shared/constants.ts`, `standalone-scripts/macro-controller/src/instruction.ts`,
   `standalone-scripts/macro-controller/src/shared-state.ts`, `readme.md`).
5. Add a `changelog.md` + `standalone-scripts/macro-controller/changelog.md` entry.

### Adding a new config key

1. Add typed default in `standalone-scripts/macro-controller/src/config-validator.ts`.
2. Update seeded `02-macro-controller-config.json`.
3. Document under `spec/26-macro-controller/` and
   `spec/06-seedable-config-architecture/`.
4. Add a unit test under
   `standalone-scripts/macro-controller/src/__tests__/`.
5. Version bump + changelog entry.

> Full details, hard-rules, and the standalone-script scaffolding flow live in
> [`.lovable/what-to-read.md`](./.lovable/what-to-read.md) (canonical pointer) and its detailed map [`.lovable/memory/what-to-read.md`](./.lovable/memory/what-to-read.md).

---


### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Extension UI** | React 18, TypeScript 5, Tailwind CSS v3, shadcn/ui |
| **Build System** | Vite 5, LESS, PowerShell (Windows orchestration) |
| **Standalone Scripts** | TypeScript → IIFE bundles (ES2020 target) |
| **Storage** | SQLite (sql.js), IndexedDB, chrome.storage.local, OPFS |
| **Testing** | Vitest, Playwright (E2E) |
| **Linting** | ESLint + SonarJS (zero warnings enforced) |
| **CI/CD** | GitHub Actions |
| **Spec governance** | Authoring Guide v3.5.0, folder-guard safeguard, time-stamped validation reports |

---

## Engineering Standards

The project enforces strict engineering standards (26 rules documented in `spec/02-coding-guidelines/engineering-standards.md`):

- **Zero ESLint warnings/errors** — SonarJS plugin enforced across all code
- **All errors include exact file path, missing item, and reasoning** — optimized for AI-assisted diagnosis
- **Unified versioning** — manifest, `constants.ts`, and standalone scripts always in sync
- **ASCII-safe console output** — no Unicode symbols in build output
- **Dark-only theme** — no light mode, no toggle
- **Constant naming convention** — `ID_`, `SEL_`, `CLS_`, `MSG_` prefixes in SCREAMING_SNAKE_CASE

---

## Troubleshooting

### `vite:load-fallback` ENOENT — module cannot be loaded

**Symptom.** A development build fails partway through with output similar to:

```
[plugin vite:load-fallback]
ENOENT: no such file or directory, open
  '.../src/background/recorder/step-library/result-webhook.ts'
    at async Object.load (vite/dist/node/chunks/dep-*.js:...)
    at async PluginDriver.hookFirstAndGetPlugin (rollup/...)
error during build
error: script "build:dev" exited with code 1
```

`vite:load-fallback` is the **last-resort** plugin in Vite's pipeline that
reads a source file from disk after every other resolver has run. An ENOENT
here means Rollup *thinks* the file should exist (because some module
imported it) but the actual disk read failed. There are exactly three causes
worth checking, in order:

| # | Root cause | How to confirm | Fix |
|---|------------|----------------|-----|
| 1 | **The file really is missing** (deleted, renamed, never committed) | `ls src/background/recorder/step-library/result-webhook.ts` | Restore from git history, or update the importer if the rename was intentional. |
| 2 | **An importer points at a stale path** (typo, wrong alias, drift after refactor) | `rg "result-webhook" src` and inspect every match | Correct the import specifier; prefer the `@/…` alias form. |
| 3 | **Stale Vite/TS cache** holding a fingerprint of an old file location while the file on disk is fine | The file exists on disk and the importer paths look correct, but the build still fails | Run the cache-clear step below. |

### Built-in guards (run automatically before every build)

Both `pnpm run build` and `pnpm run build:dev` are wired through two
fail-fast guards so the failure surface is clear *before* Vite starts:

1. **`scripts/prebuild-clean-and-verify.mjs`**
   - Deletes `node_modules/.vite`, `node_modules/.vite-temp`,
     `node_modules/.cache`, and any `*.tsbuildinfo` files.
   - Verifies every expected file in
     `src/background/recorder/step-library/` is present and non-empty.
   - Exits non-zero with **exact path · missing item · reason** if anything
     is wrong.
2. **`scripts/check-result-webhook.mjs`**
   - Confirms `result-webhook.ts` exists, is non-empty, and exposes its
     required named exports (`dispatchWebhook`).
   - Confirms every known importer of the module still exists.

### Manual cache clear (when to run it)

You should not normally need to clear caches by hand — the prebuild guard
does it for you. Run a manual clear only when:

- You **switched git branches** with very different dependency or source
  trees and the next build fails with an ENOENT against a file that
  obviously exists on disk.
- You **renamed or moved a file** that other modules import, and a
  subsequent build still references the old path.
- You **interrupted a previous build** (Ctrl+C, crashed terminal) and the
  partial cache may now be inconsistent.
- A teammate reports the same ENOENT that you cannot reproduce — clearing
  ensures both of you are starting from the same state.

Manual command:

```bash
rm -rf node_modules/.vite node_modules/.vite-temp node_modules/.cache \
       tsconfig*.tsbuildinfo dist
pnpm run build:dev
```

### Reproduction helper

If the ENOENT recurs, use the bundled repro entry point — it prints the
resolved path for `result-webhook` *before* invoking the same dev build:

```bash
pnpm run repro:build
# → scripts/repro-build-error.mjs
```

The same helper is exposed as a **"Reproduce build error"** button in the
extension's *Diagnostics* view, which copies the command to your clipboard
and displays the resolved import path.

### When to escalate

If all three of the following are true, treat it as a real bug rather than
a cache issue and open an issue:

- `pnpm run prebuild:clean-verify` succeeds.
- `pnpm run check:result-webhook` succeeds.
- `pnpm run repro:build` still fails with `vite:load-fallback` ENOENT.

Attach the full output of `repro:build` (it includes the resolved absolute
path, file size, mtime, and importer presence checks) to the issue.


---

## Diagnostic error codes (Plan 26)

Every user-facing error surfaced by the Marco extension carries a unique code of
the form `<AREA>_<ACTION>_E<NNN>` (for example `PROMPT_VALIDATE_E001`,
`REPAIR_RUN_E001`, `HISTORY_RESOLVE_E001`). The code appears in three places:

1. The **toast footer** shown in the extension UI (`code=<CODE>`).
2. The **browser console** log line, alongside a structured context object
   (`{ role, slug, expected, actual, ... }`).
3. The **diagnostics ZIP** export (`Export diagnostics` in the extension menu),
   in `error-code-index.json` and `errors.md`.

The complete registry lives at
`standalone-scripts/macro-controller/src/errors/error-codes.ts` and is validated
in CI by `scripts/check-error-codes-unique.mjs` plus the Vitest suites under
`standalone-scripts/macro-controller/src/errors/__tests__/`.

### How to report a bug

When something goes wrong, please include the following in the report. This
turns a 20-minute triage into a 2-minute fix:

1. The **error code** from the toast footer (for example `PROMPT_VALIDATE_E001`).
2. The **context object** from the browser console (right-click the log line,
   `Copy object`).
3. The **button or action** you clicked immediately before the error.
4. A **diagnostics ZIP** (extension menu → `Export diagnostics`) if the error is
   reproducible.

Do NOT retype the human message. The code + context are what the maintainers
grep for; the human message is a rendering of them.

### Registry (52 codes, 10 areas)

Codes are frozen once shipped. New codes are appended; codes are never
renumbered. Deprecated entries keep their number and set `replacedBy`.


### DB

| Code | Severity | What it means | Next fix |
|---|---|---|---|
| `DB_WRITE_E001` | error | Database write failed on {table}.{op} (pkey={pkey}): {sqliteCode}. | Reload the extension; if it persists, export diagnostics and report. |
| `DB_WRITE_E002` | error | Prompt upsert failed for role={role} slug={slug}: {reason}. | Retry the save; if it persists, export diagnostics and report. |
| `DB_WRITE_E003` | error | Could not flag prompt id={promptId} as default for role={role}: {reason}. | Reopen the row and click "Set as default" from the gear menu. |
| `DB_READ_E001` | error | listPromptsByRole failed for role={role}: {reason}. | Reload the extension; if it persists, export diagnostics. |
| `DB_WRITE_E004` | error | Delete failed for prompt id={promptId} name="{name}": {reason}. | Reopen the row and retry, or use History to restore. |
| `DB_ROLE_ENFORCE_E001` | error | enforceSingleDefaultPerRole failed (role={role}, keepId={keepId}, stage={stage}): {reason}. | Run More > Repair prompts, then retry the save. |
| `DB_PROMPT_E001` | error | Prompt CRUD failed at {where}: {reason}. | Reopen the editor and retry; if it persists, run Repair prompts. |
| `DB_PROMPT_REVISION_SNAPSHOT_E001` | warn | Revision snapshot on upsert failed for slug={slug}: {reason}. The save itself succeeded; only history is missing. | No user action required; check Export diagnostics if this recurs. |
| `DB_REVISION_E001` | error | PromptRevision {where} failed (slug={slug}): {reason}. | Retry from the History panel; export diagnostics if it persists. |
| `DB_REVISION_TRIM_E001` | warn | PromptRevision trim after {stage} failed for slug={slug}: {reason}. History over cap; not fatal. | No user action required; over-cap rows will be trimmed on next write. |
| `DB_MACRO_INIT_E001` | error | Macro DB init failed at stage={stage}: {reason}. | Reload the tab; if it persists, reinstall the extension. |
| `DB_MACRO_MIGRATION_E001` | error | Prompt column migration failed for column={column}: {reason}. | Export diagnostics; the column will be retried on next boot. |
| `DB_MACRO_WRITE_E001` | error | {op} failed: {reason}. | Retry the action; if it persists, export diagnostics. |
| `DB_MACRO_READ_E001` | error | {op} failed: {reason}. | Reload the tab; if it persists, export diagnostics. |
| `DB_MACRO_EXPORT_E001` | error | Database dump export failed: {reason}. | Retry export; if it persists, reload the extension and try again. |
| `DB_CHAT_SUBMIT_E001` | error | ProjectChatSubmit {op} failed (kind={kind}): {reason}. | Retry the submit capture; if it persists, export diagnostics. |

### HEALTH

| Code | Severity | What it means | Next fix |
|---|---|---|---|
| `HEALTH_CHECK_E001` | warn | Prompt health check found issues for {role}: {issueCount} issue(s) — {issueSummary}. | Run Repair prompts to auto-fix, or edit the row manually. |
| `HEALTH_AUTO_REPAIR_E001` | error | Prompt auto-repair failed at stage={stage}: {reason}. | Open the ⚙ gear on the affected chip and run "🩹 Repair prompts". |

### HISTORY

| Code | Severity | What it means | Next fix |
|---|---|---|---|
| `HISTORY_RESOLVE_E001` | error | Could not resolve prompt slug "{requestedSlug}" for history (role={role}); tried: {fallbackChain}. | Reopen the prompt from the gear menu so the slug can be re-bound. |
| `HISTORY_LIST_E001` | error | Could not load revision history for slug="{slug}" role={role}: {reason}. | Reload the tab and reopen History; if it persists, export diagnostics. |
| `HISTORY_RESTORE_E001` | error | Restore failed for slug="{slug}" (revisionId={revisionId}) at phase={phase}: {reason}. | Reopen History and try a different revision, or Repair prompts first. |
| `HISTORY_UNDO_E001` | error | Undo of {undoKind} failed for slug="{slug}": {reason}. | Open History and restore the intended revision manually. |
| `HISTORY_EXPORT_E001` | error | Revision export failed for slug="{slug}" role={role}: {reason}. | Retry the export; if it persists, reload the tab. |
| `HISTORY_IMPORT_E001` | error | Revision import rejected for slug="{slug}" role={role} at stage={stage}: {reason}. | Pick a valid .json history archive exported from the same slug and try again. |
| `HISTORY_IMPORT_E002` | error | Revision import DB write failed for slug="{slug}": {reason}. | Retry the import; if it persists, export diagnostics and report. |
| `HISTORY_INTERNAL_E001` | warn | History panel internal warning at stage={stage}: {reason}. | Non-fatal; captured for telemetry. |

### HTTP

| Code | Severity | What it means | Next fix |
|---|---|---|---|
| `HTTP_REQUEST_E001` | error | Request failed for {op}: HTTP {status} at {url}. | Check network + auth token; retry the action. |

### PROMPT

| Code | Severity | What it means | Next fix |
|---|---|---|---|
| `PROMPT_VALIDATE_E001` | error | Cannot save {role} prompt "{slug}": expected {expected} {{n}} token(s), found {actual}. | Add the missing {{n}} token(s) in the editor and save again. |
| `PROMPT_EDIT_E001` | error | Cannot open the {role} prompt editor for "{slug}": {reason}. | Try Repair prompts from the gear menu, then reopen the editor. |
| `PROMPT_EDIT_E002` | error | Cannot open prompt editor for role={role}: dropdown context is not registered yet. | Open the Prompts dropdown once, then retry the edit. |
| `PROMPT_EDIT_E003` | error | Prompt editor failed to open for role={role} (action={action}): {reason}. | Reload the tab; if it persists, run Repair prompts from the gear menu. |
| `PROMPT_EDIT_E004` | warn | Editor state drift detected for role={role} slug={slug} (id={promptId}): bodyMatches={bodyMatches}, nameMatches={nameMatches}. | Save the row again to re-align the editable projection with the DB. |
| `PROMPT_EDIT_E005` | error | Default prompt lookup failed for role={role}: {reason}. | Run More > Re-seed defaults, then reopen the editor. |
| `PROMPT_EDIT_E006` | error | No default prompt row exists for role={role} and no seed row is registered. | Add a Plan/Next prompt via the "+ New" gear item; it will be promoted to default. |
| `PROMPT_EDIT_E007` | error | Prompt id={promptId} not found in role={role}. | The row was deleted or renamed; reopen the list and pick another row. |
| `PROMPT_VALIDATE_E002` | error | Cannot save {role} prompt "{slug}": {missingCount} required token(s) missing ({missingTokens}). | Re-insert the listed {{...}} token(s) in the editor and save again. |
| `PROMPT_VALIDATE_E003` | error | Save failed for {role} prompt "{slug}" ({ruleId}): {reason}. | Retry the save; if it persists, export diagnostics and report. |
| `PROMPT_UNDO_E001` | error | Undo of the last save failed for slug="{slug}": {reason}. | Open History and restore the previous revision manually. |

### PROMPT_IO

| Code | Severity | What it means | Next fix |
|---|---|---|---|
| `PROMPT_IO_E001` | error | Prompt Library modal could not open: {reason} (op={op}). | Reload the tab; if it persists, reinstall the extension. |

### REPAIR

| Code | Severity | What it means | Next fix |
|---|---|---|---|
| `REPAIR_RUN_E001` | error | Repair prompts could not fully restore {role}: {fixed} fixed, {stillBroken} still broken. | Open the editor via the gear menu and inspect the flagged rows. |
| `REPAIR_RESEED_E001` | error | Repair reseed failed after {initialCount} initial issue(s): {reason}. | Reload the tab and rerun "🩹 Repair prompts"; export diagnostics if it persists. |
| `REPAIR_RESIDUAL_E001` | warn | Repair finished with {finalCount} unresolved issue(s) (fixed={fixedCount}, stillBroken={stillBrokenCount}, newlyFlagged={newlyFlaggedCount}). | Open the repair report, copy it, and file the failing slug(s) for triage. |
| `REPAIR_COPY_E001` | warn | Copy repair report to clipboard failed: {reason}. | Select the report text manually and copy with Ctrl/Cmd+C. |

### SDK

| Code | Severity | What it means | Next fix |
|---|---|---|---|
| `SDK_NOT_READY_E001` | error | Marco SDK is not ready yet for {op}: {missingApi} is undefined (readiness stage: {readinessStage}). | Reload the tab; if the error persists, reinstall the extension. |

### SEED

| Code | Severity | What it means | Next fix |
|---|---|---|---|
| `SEED_INSERT_E001` | error | Default prompt seeding failed for {role}: {reason}. | Run Repair prompts from the gear menu. |
| `SEED_INSERT_E002` | warn | Preflight seeding failed for role={role}: {reason}. | Editor will fall back to static template; run Repair prompts to persist. |
| `SEED_RESEED_E001` | error | Re-seed defaults failed (force={force}): {reason}. | Retry from the gear menu; if it persists, run Repair prompts. |
| `SEED_PROMOTE_E001` | error | Could not promote seed row "{slug}" to default for role={role}: {reason}. | Run Repair prompts from the gear menu, then reopen the editor. |
| `SEED_LEGACY_UPGRADE_E001` | error | Legacy default body upgrade failed for role={role} slug="{slug}": {reason}. | Retry the boot; if it persists, run More > Re-seed defaults (force). |
| `SEED_AUDIT_E001` | warn | PromptSeedAudit row write failed: {reason}. | Non-fatal; seed still applied. Check DB schema drift. |
| `SEED_TELEMETRY_E001` | warn | Seed telemetry persistence failed: {reason}. | Non-fatal; localStorage may be full or blocked. |

### UI

| Code | Severity | What it means | Next fix |
|---|---|---|---|
| `UI_ACTION_E001` | error | Chip gear action "{actionName}" failed for role={role}: {reason}. | Retry the action; if it persists, reload the tab. |


---

## Author


<div align="center">

### [Md. Alim Ul Karim](https://www.google.com/search?q=alim+ul+karim)

**[Creator & Lead Architect](https://alimkarim.com)** | [Chief Software Engineer](https://www.google.com/search?q=alim+ul+karim), [Riseup Asia LLC](https://riseup-asia.com)

</div>

A system architect with **20+ years** of professional software engineering experience across enterprise, fintech, and distributed systems. His technology stack spans **.NET/C# (18+ years)**, **JavaScript (10+ years)**, **TypeScript (6+ years)**, and **Golang (4+ years)**.

Recognized as a **top 1% talent at Crossover** and one of the top software architects globally. He is also the **Chief Software Engineer of [Riseup Asia LLC](https://riseup-asia.com/)** and maintains an active presence on **[Stack Overflow](https://stackoverflow.com/users/361646/alim-ul-karim)** (2,452+ reputation, member since 2010) and **LinkedIn** (12,500+ followers).

|  |  |
|---|---|
| **Website** | [alimkarim.com](https://alimkarim.com/) · [my.alimkarim.com](https://my.alimkarim.com/) |
| **LinkedIn** | [linkedin.com/in/alimkarim](https://linkedin.com/in/alimkarim) |
| **Stack Overflow** | [stackoverflow.com/users/361646/alim-ul-karim](https://stackoverflow.com/users/361646/alim-ul-karim) |
| **Google** | [Alim Ul Karim](https://www.google.com/search?q=Alim+Ul+Karim) |
| **Role** | Chief Software Engineer, [Riseup Asia LLC](https://riseup-asia.com) |

### Riseup Asia LLC

[Top Leading Software Company in WY (2026)](https://riseup-asia.com)

|  |  |
|---|---|
| **Website** | [riseup-asia.com](https://riseup-asia.com/) |
| **Facebook** | [riseupasia.talent](https://www.facebook.com/riseupasia.talent/) |
| **LinkedIn** | [Riseup Asia](https://www.linkedin.com/company/105304484/) |
| **YouTube** | [@riseup-asia](https://www.youtube.com/@riseup-asia) |

---

## License

This project is proprietary software owned by Riseup Asia LLC. All rights reserved.
