// The catalog's shape.
//
// Versioned, because the platform's memory outlives any one build of it: a schema bump is a migration, and a
// database written by a newer version is refused in words rather than half-read.
//
// One table per idea — see `docs/platform-design.md`, "The catalog". Nothing here is derived at read time from
// the network: a row is written by a scan and read by a view.

export const SCHEMA_VERSION = 4;

/**
 * Every statement is `IF NOT EXISTS`, so applying the schema is idempotent — it is how an older database is
 * brought forward, not only how a new one is created.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Where content comes from: a git remote at a chosen branch, a local folder, or a read-only archive.
CREATE TABLE IF NOT EXISTS sources (
  id             INTEGER PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('git', 'folder', 'archive')),
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  remote_url     TEXT,
  path           TEXT,
  default_branch TEXT,
  branch         TEXT,
  registry_path  TEXT,
  docs_root      TEXT,
  pages          INTEGER,
  state          TEXT,
  last_read      TEXT,
  last_read_mode TEXT,
  last_commit    TEXT,
  last_commit_at TEXT,
  added_at       TEXT NOT NULL
);

-- What a person creates and versions: the unit of management, not a repository.
-- "origin" is how the project began — blank, template, folder, repository or import — and it is written once:
-- editing a project never re-answers where it came from. "template" names the starter it was written from.
CREATE TABLE IF NOT EXISTS documents (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  version    TEXT,
  audience   TEXT,
  owner      TEXT,
  origin     TEXT NOT NULL DEFAULT 'blank',
  template   TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- A document cites sources, each with its own branch and role. Many-to-many, on purpose.
CREATE TABLE IF NOT EXISTS doc_sources (
  document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  source_id    INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  branch       TEXT,
  include_glob TEXT,
  role         TEXT NOT NULL DEFAULT 'primary',
  PRIMARY KEY (document_id, source_id)
);

-- How a document is built. One row per document: the engine, its config, and the outputs it must produce.
CREATE TABLE IF NOT EXISTS recipes (
  document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  engine      TEXT NOT NULL,
  config_path TEXT,
  script      TEXT,
  outputs     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS builds (
  id          INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT NOT NULL,
  revision    TEXT,
  log_path    TEXT
);

-- What a build left behind. Success is an artifact that did not exist before, never an exit code.
CREATE TABLE IF NOT EXISTS artifacts (
  id          INTEGER PRIMARY KEY,
  build_id    INTEGER REFERENCES builds(id) ON DELETE SET NULL,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  path        TEXT NOT NULL,
  bytes       INTEGER,
  sha256      TEXT,
  built_at    TEXT NOT NULL
);

-- Summarised once, readable offline: the model and the time are recorded so a summary is never recomputed.
CREATE TABLE IF NOT EXISTS commits (
  sha           TEXT NOT NULL,
  source_id     INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  at            TEXT,
  author        TEXT,
  subject       TEXT,
  summary       TEXT,
  summary_model TEXT,
  summarised_at TEXT,
  PRIMARY KEY (sha, source_id)
);

CREATE TABLE IF NOT EXISTS commit_pages (
  sha     TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  page_id TEXT NOT NULL,
  how     TEXT NOT NULL CHECK (how IN ('code-glob', 'path', 'terms')),
  PRIMARY KEY (sha, source_id, page_id)
);

CREATE TABLE IF NOT EXISTS pages (
  id          TEXT NOT NULL,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  source_id   INTEGER REFERENCES sources(id) ON DELETE CASCADE,
  path        TEXT,
  title       TEXT,
  owner       TEXT,
  reviewed_at TEXT,
  stale       INTEGER,
  counts      TEXT,
  PRIMARY KEY (id, document_id)
);

CREATE TABLE IF NOT EXISTS scans (
  id        INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  at        TEXT NOT NULL,
  mode      TEXT NOT NULL,
  revision  TEXT,
  counts    TEXT
);

-- What the platform noticed, and whether it has been shown. seen_at is what stops a fact being announced twice.
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY,
  at           TEXT NOT NULL,
  kind         TEXT NOT NULL,
  subject_kind TEXT,
  subject_id   INTEGER,
  detail       TEXT,
  seen_at      TEXT
);

-- A body that was drafted but not written. The text lives here, not in a file, because a draft is a proposal:
-- accepting it writes the page and marks the row accepted, rejecting it marks it discarded, and neither is undo-able
-- in the documentation itself. page_id is the id the page will have (area/chapter/slug); it is what makes two
-- drafts for one page recognisable.
CREATE TABLE IF NOT EXISTS drafts (
  id            INTEGER PRIMARY KEY,
  document_slug TEXT NOT NULL,
  source        TEXT,
  page_id       TEXT NOT NULL,
  title         TEXT NOT NULL,
  kind          TEXT,
  body          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'draft'
);

CREATE INDEX IF NOT EXISTS drafts_by_document ON drafts (document_slug, state, created_at DESC);

-- A release is a build that was handed to a reader: the artifacts it carries, where they were put, and when.
-- The files are not copied into the database — a release row is the decision plus the destination it points at,
-- which is what makes republishing a new version a new row rather than an edit of an old one.
CREATE TABLE IF NOT EXISTS releases (
  id           INTEGER PRIMARY KEY,
  document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  build_id     INTEGER REFERENCES builds(id) ON DELETE SET NULL,
  version      TEXT NOT NULL,
  destination  TEXT NOT NULL,
  files        INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS releases_by_document ON releases (document_id, published_at DESC);

CREATE INDEX IF NOT EXISTS events_unseen ON events (seen_at, at DESC);
CREATE INDEX IF NOT EXISTS commits_by_source ON commits (source_id, at DESC);
CREATE INDEX IF NOT EXISTS artifacts_by_document ON artifacts (document_id, built_at DESC);
CREATE INDEX IF NOT EXISTS builds_by_document ON builds (document_id, started_at DESC);
`;

/**
 * What a database written by an earlier schema needs before this build can read it.
 *
 * `CREATE TABLE IF NOT EXISTS` above does nothing to a table that is already there, so a new column is an
 * `ALTER TABLE` applied once per version step, in order, by `Catalog.open`. Keyed by the version the step leads
 * to: `MIGRATIONS[4]` is what a schema 3 file needs to become a schema 4 file.
 */
export const MIGRATIONS: Readonly<Record<number, readonly string[]>> = {
  4: [
    "ALTER TABLE documents ADD COLUMN origin TEXT NOT NULL DEFAULT 'blank'",
    'ALTER TABLE documents ADD COLUMN template TEXT',
  ],
};
