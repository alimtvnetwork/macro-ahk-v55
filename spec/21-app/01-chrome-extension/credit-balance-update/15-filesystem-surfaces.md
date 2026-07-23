# 15 — File-System / Storage Surfaces

| Surface              | Key / Path                                                  | Purpose                  |
|----------------------|-------------------------------------------------------------|--------------------------|
| `chrome.storage.local` | `Settings.CreditFetchDelayMs`                             | persisted slider value   |
| IndexedDB DB         | `marco_pro_zero_credit_balance`                             | reused (no new DB)       |
| IndexedDB store      | `entries_v2_ktlo_free_cancelled`                            | per-workspace cache      |
| SQLite kv            | n/a (this feature does not persist to SQLite — read-only consumer) | —                |
| Log namespace        | `CreditBalanceUpdate.*`                                     | namespace logger entries |
| Spec root            | `spec/21-app/01-chrome-extension/credit-balance-update/`    | this folder              |

Failure-log file path is captured by the existing log-diagnostics export bundle
(memory `mem://features/log-diagnostics-export`).
