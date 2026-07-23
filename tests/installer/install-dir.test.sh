#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Marco Extension — install.sh --install-dir CI test
#
# Runs scripts/install.sh against the local mock server with
# `--install-dir <tempdir>` and asserts the expected files (manifest.json
# and VERSION) land INSIDE that tempdir, not in $HOME or $(pwd).
#
# Covers:
#   • `--install-dir <path>`   long form (PowerShell parity — mirrors -InstallDir)
#   • `--install-dir=<path>`   `=`-joined form
#   • `--dir <path>`           legacy short-flag alias
#
# Also asserts:
#   • Nothing is written under $HOME/marco-extension (v3.68.0 regression)
#   • Nothing is written under $(pwd)/marco-extension when --install-dir points
#     somewhere else
#
# Spec: spec/14-update/01-generic-installer-behavior.md §2, §5
# ─────────────────────────────────────────────────────────────────────

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
INSTALLER="${REPO_ROOT}/scripts/install.sh"
START_MOCK="${SCRIPT_DIR}/fixtures/start-mock.sh"

if [ ! -f "${INSTALLER}" ]; then
    printf '\033[31m✗ Installer not found at %s\033[0m\n' "${INSTALLER}" >&2
    exit 2
fi
if [ ! -f "${START_MOCK}" ]; then
    printf '\033[31m✗ start-mock not found at %s\033[0m\n' "${START_MOCK}" >&2
    exit 2
fi
if ! command -v node >/dev/null 2>&1; then
    printf '\033[33m⚠ node not found — skipping --install-dir test\033[0m\n' >&2
    exit 0
fi
if ! command -v unzip >/dev/null 2>&1; then
    printf '\033[33m⚠ unzip not found — skipping --install-dir test\033[0m\n' >&2
    exit 0
fi

PASS_COUNT=0
FAIL_COUNT=0
FAIL_LINES=()
ACTIVE_PIDS=()
ACTIVE_DIRS=()

assert_eq() {
    local label="$1" expected="$2" actual="$3"
    if [ "${expected}" = "${actual}" ]; then
        printf '  \033[32m✓\033[0m %s\n' "${label}"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        printf '  \033[31m✗\033[0m %s\n' "${label}"
        printf '      expected: %q\n' "${expected}"
        printf '      actual:   %q\n' "${actual}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        FAIL_LINES+=("${label}")
    fi
}

assert_file_exists() {
    local label="$1" path="$2"
    if [ -f "${path}" ]; then
        printf '  \033[32m✓\033[0m %s\n' "${label}"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        printf '  \033[31m✗\033[0m %s (missing: %s)\n' "${label}" "${path}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        FAIL_LINES+=("${label}")
    fi
}

assert_not_exists() {
    local label="$1" path="$2"
    if [ ! -e "${path}" ]; then
        printf '  \033[32m✓\033[0m %s\n' "${label}"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        printf '  \033[31m✗\033[0m %s (unexpectedly present: %s)\n' "${label}" "${path}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        FAIL_LINES+=("${label}")
    fi
}

start_mock() {
    local env_vars="$1"
    local out
    if ! out="$(env ${env_vars} bash "${START_MOCK}")"; then
        printf '\033[31m✗ failed to start mock server\033[0m\n' >&2
        return 1
    fi
    eval "${out}"
    ACTIVE_PIDS+=("${MOCK_PID}")
    return 0
}

stop_all_mocks() {
    for pid in "${ACTIVE_PIDS[@]:-}"; do
        [ -n "${pid}" ] || continue
        kill "${pid}" 2>/dev/null || true
        wait "${pid}" 2>/dev/null || true
    done
    ACTIVE_PIDS=()
}

cleanup() {
    stop_all_mocks
    for dir in "${ACTIVE_DIRS[@]:-}"; do
        [ -n "${dir}" ] || continue
        rm -rf "${dir}" 2>/dev/null || true
    done
}
trap cleanup EXIT

mktemp_install_dir() {
    local d
    d="$(mktemp -d -t marco-install-dir.XXXXXX)"
    ACTIVE_DIRS+=("${d}")
    rm -rf "${d}"   # let install.sh create it fresh
    echo "${d}"
}

run_case() {
    local label="$1" tag="$2" flag_form="$3" install_dir="$4"

    printf '\n\033[36m▸ %s\033[0m\n' "${label}"

    start_mock "MOCK_LATEST_TAG=${tag}" || return 1

    # Run install.sh from a scratch working directory so any accidental
    # `$(pwd)/marco-extension` fallback would land in an isolated place
    # we can inspect (and negatively assert against).
    local run_cwd
    run_cwd="$(mktemp -d -t marco-cwd.XXXXXX)"
    ACTIVE_DIRS+=("${run_cwd}")

    local out rc
    # shellcheck disable=SC2086  # ${flag_form} is deliberately unquoted so
    # "--install-dir <path>" splits into two args while
    # "--install-dir=<path>" stays as one.
    out="$(cd "${run_cwd}" && \
        MARCO_API_BASE="${MOCK_BASE}" MARCO_DOWNLOAD_BASE="${MOCK_BASE}" \
        bash "${INSTALLER}" --version "${tag}" ${flag_form} 2>&1)"
    rc=$?

    assert_eq       "${label}: exit code"            "0"       "${rc}"
    assert_file_exists "${label}: manifest.json inside --install-dir" "${install_dir}/manifest.json"
    assert_file_exists "${label}: VERSION file inside --install-dir"  "${install_dir}/VERSION"

    if [ -f "${install_dir}/VERSION" ]; then
        local pinned
        pinned="$(cat "${install_dir}/VERSION")"
        assert_eq   "${label}: VERSION pinned to ${tag}" "${tag}" "${pinned}"
    fi

    # Regression guards.
    assert_not_exists "${label}: no accidental HOME/marco-extension" "${HOME}/marco-extension"
    assert_not_exists "${label}: no accidental cwd/marco-extension"  "${run_cwd}/marco-extension"

    # Log echo confirms install.sh actually resolved our path.
    if [[ "${out}" == *"${install_dir}"* ]]; then
        printf '  \033[32m✓\033[0m %s: installer log references target dir\n' "${label}"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        printf '  \033[31m✗\033[0m %s: installer log did not mention %s\n' "${label}" "${install_dir}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        FAIL_LINES+=("${label}: installer log references target dir")
    fi

    stop_all_mocks
}

# run_case_args: like run_case, but passes flag tokens as an explicit
# argv array so paths containing spaces (or other shell-meta) survive
# unmangled. Use this for equals-form vs space-form vs quoted-space
# permutations. Args after the 4th are appended verbatim to install.sh.
run_case_args() {
    local label="$1" tag="$2" install_dir="$3"
    shift 3
    local -a flag_args=("$@")

    printf '\n\033[36m▸ %s\033[0m\n' "${label}"

    start_mock "MOCK_LATEST_TAG=${tag}" || return 1

    local run_cwd
    run_cwd="$(mktemp -d -t marco-cwd.XXXXXX)"
    ACTIVE_DIRS+=("${run_cwd}")

    local out rc
    out="$(cd "${run_cwd}" && \
        MARCO_API_BASE="${MOCK_BASE}" MARCO_DOWNLOAD_BASE="${MOCK_BASE}" \
        bash "${INSTALLER}" --version "${tag}" "${flag_args[@]}" 2>&1)"
    rc=$?

    assert_eq       "${label}: exit code"                                "0"       "${rc}"
    assert_file_exists "${label}: manifest.json inside --install-dir"    "${install_dir}/manifest.json"
    assert_file_exists "${label}: VERSION file inside --install-dir"     "${install_dir}/VERSION"

    if [ -f "${install_dir}/VERSION" ]; then
        local pinned
        pinned="$(cat "${install_dir}/VERSION")"
        assert_eq   "${label}: VERSION pinned to ${tag}" "${tag}" "${pinned}"
    fi

    assert_not_exists "${label}: no accidental HOME/marco-extension" "${HOME}/marco-extension"
    assert_not_exists "${label}: no accidental cwd/marco-extension"  "${run_cwd}/marco-extension"

    if [[ "${out}" == *"${install_dir}"* ]]; then
        printf '  \033[32m✓\033[0m %s: installer log references target dir\n' "${label}"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        printf '  \033[31m✗\033[0m %s: installer log did not mention %s\n' "${label}" "${install_dir}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        FAIL_LINES+=("${label}: installer log references target dir")
    fi

    stop_all_mocks
}

mktemp_install_dir_with_spaces() {
    # macOS/BSD mktemp does not accept "-t <tmpl>" style prefixes with
    # embedded spaces; create a plain temp dir then rename to add spaces.
    local base
    base="$(mktemp -d -t marco-space.XXXXXX)"
    local d="${base}/marco install with spaces"
    ACTIVE_DIRS+=("${base}")
    mkdir -p "${d%/*}"
    # install.sh will create the leaf itself when missing.
    echo "${d}"
}

# ── Case 1: --install-dir <path> (PowerShell -InstallDir parity) ─────
INSTALL_DIR_1="$(mktemp_install_dir)"
run_case "--install-dir <path>" "v2.600.0" \
    "--install-dir ${INSTALL_DIR_1}" \
    "${INSTALL_DIR_1}"

# ── Case 2: --install-dir=<path> (equals-joined form) ────────────────
INSTALL_DIR_2="$(mktemp_install_dir)"
run_case "--install-dir=<path>" "v2.600.1" \
    "--install-dir=${INSTALL_DIR_2}" \
    "${INSTALL_DIR_2}"

# ── Case 3: --dir <path> (legacy short-flag alias) ───────────────────
INSTALL_DIR_3="$(mktemp_install_dir)"
run_case "--dir <path> (legacy alias)" "v2.600.2" \
    "--dir ${INSTALL_DIR_3}" \
    "${INSTALL_DIR_3}"

# ── Case 4: -d <path> (short single-letter alias) ────────────────────
INSTALL_DIR_4="$(mktemp_install_dir)"
run_case_args "-d <path> (short alias)" "v2.600.3" "${INSTALL_DIR_4}" \
    -d "${INSTALL_DIR_4}"

# ── Case 5: --dir=<path> (equals-form alias) ─────────────────────────
INSTALL_DIR_5="$(mktemp_install_dir)"
run_case_args "--dir=<path> (equals alias)" "v2.600.4" "${INSTALL_DIR_5}" \
    "--dir=${INSTALL_DIR_5}"

# ── Case 6: --install-dir <path with spaces> (quoted, space-separated form)
INSTALL_DIR_6="$(mktemp_install_dir_with_spaces)"
run_case_args "--install-dir <path with spaces>" "v2.600.5" "${INSTALL_DIR_6}" \
    --install-dir "${INSTALL_DIR_6}"

# ── Case 7: --install-dir=<path with spaces> (equals-joined, quoted)
INSTALL_DIR_7="$(mktemp_install_dir_with_spaces)"
run_case_args "--install-dir=<path with spaces>" "v2.600.6" "${INSTALL_DIR_7}" \
    "--install-dir=${INSTALL_DIR_7}"

# ── Summary ──────────────────────────────────────────────────────────

printf '\n'
if [ "${FAIL_COUNT}" -eq 0 ]; then
    printf '\033[32m✓ %d checks passed\033[0m\n' "${PASS_COUNT}"
    exit 0
else
    printf '\033[31m✗ %d checks failed (%d passed)\033[0m\n' "${FAIL_COUNT}" "${PASS_COUNT}"
    for line in "${FAIL_LINES[@]}"; do
        printf '  - %s\n' "${line}"
    done
    exit 1
fi
