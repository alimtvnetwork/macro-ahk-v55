#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Marco Extension , install.sh + install.ps1 --install-dir parity test
#
# Exercises every accepted spelling of the install-dir flag against the
# Bash installer in --dry-run mode (no network, no filesystem writes),
# then greps the resolved "Install dir:" line and asserts it matches the
# expected absolute path. Also asserts the PowerShell installer exposes
# the equivalent -InstallDir parameter with matching semantics
# (default = <cwd>\marco-extension, relative paths resolve against cwd,
# trailing slashes accepted).
#
# Spellings covered (Bash):
#   --install-dir <path>       (canonical)
#   --install-dir=<path>
#   --dir <path>               (alias)
#   --dir=<path>               (alias)
#   -d <path>                  (alias)
#
# Edge cases:
#   • absolute path with trailing slash    (kept as-is, mkdir tolerates)
#   • relative path                        (kept as-is, resolves vs $PWD)
#   • path with spaces                     (quoted through arg parsing)
#
# PowerShell parity assertions (static grep, no pwsh required in CI):
#   • param block declares [string]$InstallDir with "" default
#   • Resolve-InstallDir returns "<cwd>\marco-extension" when unset
#   • help text (Show-Help) documents -InstallDir
#
# Spec: spec/14-update/01-generic-installer-behavior.md §2, §5
# ─────────────────────────────────────────────────────────────────────

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
INSTALLER_SH="${REPO_ROOT}/scripts/install.sh"
INSTALLER_PS1="${REPO_ROOT}/scripts/install.ps1"

PASS=0
FAIL=0

pass() { printf '\033[32m✓\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
fail() { printf '\033[31m✗\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }

# Run the installer in dry-run mode and extract the resolved install dir.
# Version is forced so it never touches the network; --repo is bogus but
# unused in dry-run because we exit before download.
run_dry() {
    # Args: expected_dir, then flags to pass to install.sh
    local expected="$1"; shift
    local label="$1"; shift
    # Force --version so resolve_version skips network 'latest' lookup.
    local output
    output="$(bash "${INSTALLER_SH}" --version v9.99.99 --dry-run "$@" 2>&1 || true)"
    local resolved
    # Match the "Install dir: <path>" line inside the "Dry run , plan:" block.
    # Multiple lines match ("Install dir:" appears twice: once in the pre-banner
    # source-annotated line, once in the dry-run plan). Take the plan line
    # (last occurrence) via tail -n1 and strip ANSI + prefix.
    resolved="$(printf '%s\n' "${output}" \
        | sed 's/\x1b\[[0-9;]*m//g' \
        | grep -E '^[[:space:]]*Install dir:' \
        | tail -n1 \
        | sed -E 's/^[[:space:]]*Install dir:[[:space:]]+//' \
        | sed -E 's/[[:space:]]+\(.*\)$//')"
    if [ "${resolved}" = "${expected}" ]; then
        pass "${label}: resolved -> ${resolved}"
    else
        fail "${label}: expected '${expected}', got '${resolved}'"
        printf '    ---- installer output ----\n%s\n    --------------------------\n' "${output}" >&2
    fi
}

echo "── Bash install.sh --install-dir parity ──────────────────────────"

# 1. Default: no flag -> $(pwd)/marco-extension
WORK="$(mktemp -d)"
( cd "${WORK}" && run_dry "${WORK}/marco-extension" "default (no flag)" )

# 2. Canonical --install-dir <path> (absolute)
run_dry "/tmp/marco-abs-canonical" "--install-dir <abs>" --install-dir /tmp/marco-abs-canonical

# 3. --install-dir=<path>
run_dry "/tmp/marco-abs-eq" "--install-dir=<abs>" --install-dir=/tmp/marco-abs-eq

# 4. --dir alias, space-separated
run_dry "/tmp/marco-alias-dir" "--dir <abs>" --dir /tmp/marco-alias-dir

# 5. --dir=<path> alias
run_dry "/tmp/marco-alias-dir-eq" "--dir=<abs>" --dir=/tmp/marco-alias-dir-eq

# 6. -d short alias
run_dry "/tmp/marco-alias-d" "-d <abs>" -d /tmp/marco-alias-d

# 7. Trailing slash preserved verbatim (mkdir/unzip both tolerate it,
#    matches PowerShell Join-Path behavior which also keeps the slash).
run_dry "/tmp/marco-trailing/" "--install-dir with trailing slash" --install-dir /tmp/marco-trailing/

# 8. Relative path is kept verbatim (resolves vs $PWD at mkdir time).
#    We assert the stored value equals the raw arg to prove parse_args
#    does not silently canonicalize.
run_dry "./relative-marco" "--install-dir with relative path" --install-dir ./relative-marco

# 9. Path with spaces (quoted through parsing).
run_dry "/tmp/marco with spaces" "--install-dir with spaces" --install-dir "/tmp/marco with spaces"

echo ""
echo "── PowerShell install.ps1 -InstallDir parity (static) ────────────"

if [ ! -f "${INSTALLER_PS1}" ]; then
    fail "install.ps1 not found at ${INSTALLER_PS1}"
else
    if grep -Eq '^\s*\[string\]\$InstallDir\s*=\s*""' "${INSTALLER_PS1}"; then
        pass "ps1 declares [string]\$InstallDir = \"\" (matches Bash default \"\")"
    else
        fail "ps1 does not declare [string]\$InstallDir = \"\""
    fi

    if grep -q 'function Resolve-InstallDir' "${INSTALLER_PS1}" \
       && grep -q 'Join-Path \$cwd "marco-extension"' "${INSTALLER_PS1}"; then
        pass "ps1 Resolve-InstallDir defaults to <cwd>\\marco-extension (parity with Bash \$(pwd)/marco-extension)"
    else
        fail "ps1 Resolve-InstallDir does not default to <cwd>\\marco-extension"
    fi

    if grep -q -- '-InstallDir <path>' "${INSTALLER_PS1}"; then
        pass "ps1 help documents -InstallDir <path>"
    else
        fail "ps1 help does not document -InstallDir <path>"
    fi
fi

echo ""
echo "── Bash --help documents aliases ─────────────────────────────────"
HELP_OUT="$(bash "${INSTALLER_SH}" --help 2>&1 || true)"
for token in '--install-dir <path>' '(Canonical)' '--dir <path>' '--dir=<path>' '-d   <path>' 'Relative paths' 'trailing slashes'; do
    if printf '%s' "${HELP_OUT}" | grep -q -- "${token}"; then
        pass "help mentions: ${token}"
    else
        fail "help missing: ${token}"
    fi
done

echo ""
printf '── Summary: \033[32m%d passed\033[0m, \033[31m%d failed\033[0m\n' "${PASS}" "${FAIL}"
if [ "${FAIL}" -gt 0 ]; then
    exit 1
fi
exit 0
