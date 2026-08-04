-- Adds the proposal_attachments table for the wizard's Sender step (Step 5)
-- attachment feature. This is a brand-new table (not an ALTER on an existing
-- one), so CREATE TABLE IF NOT EXISTS is itself safe to run directly against
-- the already-deployed database — paired here as a numbered migration only
-- to follow this project's convention of shipping one alongside every
-- schema.sql change (see worker/schema.sql's matching comment).
--
-- Run against production with:
--   wrangler d1 execute <db-name> --remote --file=worker/migrations/0007_proposal_attachments.sql

CREATE TABLE IF NOT EXISTS proposal_attachments (
  id            TEXT PRIMARY KEY,
  proposal_id   TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  content_type  TEXT,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  r2_key        TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_proposal_attachments_proposal ON proposal_attachments(proposal_id, sort_order);
