-- Adds the Governing Entity field (Step 7 of the proposal wizard) to an
-- already-deployed database. New columns default to NULL/blank until a user
-- picks an entity on Step 7; see worker/schema.sql for the canonical
-- definition used by fresh databases.
ALTER TABLE proposal_terms ADD COLUMN governing_entity_code TEXT;
