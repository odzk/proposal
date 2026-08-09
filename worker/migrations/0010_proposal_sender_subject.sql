-- Adds the email subject line column for the wizard's Sender step (Step 5) to
-- the already-deployed proposals table. Paired with the same column added to
-- worker/schema.sql (see that file's comment on proposals.sender_subject),
-- per this project's convention of shipping a numbered one-time migration
-- alongside every schema.sql change so already-deployed databases can catch
-- up. NULL/empty falls back to the default "Your Nuvho Proposal — {hotel
-- name}" subject (see sendProposalEmail() in worker/src/routes/proposals.ts).
--
-- Run against production with:
--   wrangler d1 execute <db-name> --remote --file=worker/migrations/0010_proposal_sender_subject.sql

ALTER TABLE proposals ADD COLUMN sender_subject TEXT;
