-- Adds the Signature step's optional TinyMCE custom-message column to the
-- already-deployed proposal_terms table. Paired with the same column added
-- to worker/schema.sql (see that file's comment on proposal_terms), per this
-- project's convention of shipping a numbered one-time migration alongside
-- every schema.sql change so already-deployed databases can catch up.
--
-- Run against production with:
--   wrangler d1 execute <db-name> --remote --file=worker/migrations/0005_proposal_terms_signature_message.sql

ALTER TABLE proposal_terms ADD COLUMN signature_message TEXT;
