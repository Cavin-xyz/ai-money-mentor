-- Persistent user memory + knowledge keyword index. SQLite file: data/mentor.db (stays on this laptop).

CREATE TABLE IF NOT EXISTS user_profile (
    id TEXT PRIMARY KEY,
    name TEXT,
    data_json TEXT NOT NULL DEFAULT '{}',
    remember_numbers INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_goal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    years INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interaction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    module TEXT NOT NULL,
    summary TEXT,
    input_json TEXT,
    result_json TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interaction_profile ON interaction(profile_id, created_at);

CREATE TABLE IF NOT EXISTS user_pref (
    profile_id TEXT PRIMARY KEY,
    language TEXT NOT NULL DEFAULT 'en',
    investment_style TEXT NOT NULL DEFAULT 'balanced',
    notifications INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ingested_doc (
    hash TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT,
    authority TEXT,
    tax_year TEXT,
    url TEXT,
    verified_on TEXT,
    chunks INTEGER NOT NULL,
    ingested_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
    chunk_id UNINDEXED,
    text,
    title,
    authority UNINDEXED,
    section UNINDEXED,
    section_old UNINDEXED,
    tax_year UNINDEXED,
    url UNINDEXED,
    doc_hash UNINDEXED,
    tokenize = 'porter unicode61'
);

-- ── Accounts and sessions ───────────────────────────────────────────
-- One account owns exactly one profile. Passphrases are stored only as a PBKDF2 hash,
-- session tokens only as a SHA-256 hash, so the database never holds a usable secret.

CREATE TABLE IF NOT EXISTS user_account (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    profile_id TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_login_at TEXT,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT
);

CREATE TABLE IF NOT EXISTS auth_session (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_account ON auth_session(account_id);
