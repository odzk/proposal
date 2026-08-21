-- NUVCL-117: per-user signature, set once in Settings and used to pre-fill
-- the proposal wizard's Signature step (still overridable per proposal).
-- Paired with the same columns added to worker/schema.sql's staff table,
-- per this project's convention of shipping a numbered one-time migration
-- alongside every schema.sql change so already-deployed databases can catch
-- up. Deliberately no separate "signatory name" column — a typed signature
-- always uses the staff member's own `name`.
--
-- Run against production with:
--   wrangler d1 execute <db-name> --remote --file=worker/migrations/0012_staff_signature.sql

ALTER TABLE staff ADD COLUMN signature_method TEXT;    -- 'type' | 'draw' | NULL (not set)
ALTER TABLE staff ADD COLUMN signature_data_url TEXT;  -- drawn signature, base64 PNG data URL
