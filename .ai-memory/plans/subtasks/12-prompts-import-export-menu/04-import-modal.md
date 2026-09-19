# SS-04: Import modal UX

Parent: 12-prompts-import-export-menu
Slug: import-modal
Status: pending
Created: 2026-07-17

## Goal

One modal, three formats, clear preview, no silent failures.

## Layout

```
+----------------------------------------------------+
| Import Prompts                                  ×  |
+----------------------------------------------------+
| [ Drop a .json, .zip, or .sqlite file here    ]    |
| [ or click to choose a file                   ]    |
|                                                    |
| Detected format: <badge>                           |
| Source: <filename>  Size: <n> KB                   |
|                                                    |
| Preview (X entries)                                |
| | # | Slug | Name | Conflict | Action    |        |
| |...|      |      |          | [select]  |        |
|                                                    |
| Bulk: [ Keep incoming ] [ Keep existing ] [ Rename ]|
|                                                    |
|                          [ Cancel ]  [ Import N ]  |
+----------------------------------------------------+
```

## Stages

1. Idle: drop zone visible, nothing else.
2. Parsing: spinner + filename.
3. Preview: table + bulk controls + Import enabled.
4. Committing: progress bar, disabled buttons.
5. Done: success toast, modal closes, dropdown refreshes.
6. Error: red error panel, copy-to-clipboard button, retry link.

## Done when

- All six stages are reachable in E2E (parent step 27).
- Every error path renders stage 6 rather than a silent close.
