# SS-03: SQLite export and import

Parent: 12-prompts-import-export-menu
Slug: sqlite-export
Status: pending
Created: 2026-07-17

## Goal

Round-trip prompts to a single `.sqlite` file readable by DB Browser for SQLite.

## Do

1. Reuse the sqlite-wasm loader the extension already ships (see marco-sdk).
   Do not add a new sqlite dependency.
2. Schema:
   ```sql
   CREATE TABLE Meta (
     Key TEXT PRIMARY KEY,
     Value TEXT NOT NULL
   );
   CREATE TABLE Prompts (
     Slug TEXT PRIMARY KEY,
     Name TEXT NOT NULL,
     Category TEXT,
     Tags TEXT,               -- JSON array
     BodyMarkdown TEXT,
     BodyHtml TEXT,
     ReplaceKey TEXT,
     ExcludeFromExport INTEGER NOT NULL DEFAULT 0,
     UpdatedAt TEXT NOT NULL
   );
   ```
3. Meta rows: `SchemaVersion`, `ExportedAt`, `ExporterVersion`, `EntryCount`.
4. Exporter opens an in-memory DB, executes DDL, inserts rows, calls
   `db.export()` to get a `Uint8Array`, then triggers a Blob download.
5. Importer accepts a `File`, reads bytes, opens the DB, validates the two
   tables exist with the expected columns, hydrates entries into the
   envelope shape.

## Done when

- Round-trip test in parent step 25 passes for SQLite.
- DB Browser for SQLite opens the file and shows both tables.
