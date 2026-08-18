-- Adds CC/BCC recipient columns for the wizard's Sender step (Step 5) to the
-- already-deployed proposals table. Paired with the same columns added to
-- worker/schema.sql (see that file's comment on proposals.sender_cc /
-- sender_bcc), per this project's convention of shipping a numbered one-time
-- migration alongside every schema.sql change so already-deployed databases
-- can catch up.
--
-- Run against production with:
--   wrangler d1 execute <db-name> --remote --file=worker/migrations/0006_proposal_sender_cc_bcc.sql

ALTER TABLE proposals ADD COLUMN sender_cc TEXT;
ALTER TABLE proposals ADD COLUMN sender_bcc TEXT;
