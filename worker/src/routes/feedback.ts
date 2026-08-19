import type { Env, Session } from '../types'
import { ok, err } from '../lib/response'
import { sendMailViaGraph } from '../lib/graph'

const FEEDBACK_TO = 'odysseus.ambut@nuvho.com'
const FEEDBACK_CC = 'jude.bolger@nuvho.com'

// Feedback attachments are inlined straight into the Graph sendMail payload
// (no R2 storage — a feedback submission isn't a persisted record like a
// proposal, just a one-off email), so the limits here are deliberately
// tighter than the proposal attachment limits (10MB/file, 5 files in
// routes/proposals.ts): Graph's sendMail has a practical ~4MB total request
// ceiling (see lib/graph.ts), and base64 inflates raw bytes by ~33%, so
// this leaves real headroom for the HTML body itself.
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024   // 3MB per file
const MAX_ATTACHMENTS      = 3                 // per feedback submission
const MAX_TOTAL_BYTES      = 8 * 1024 * 1024   // 8MB combined, pre-base64

/* Base64-encodes an ArrayBuffer in fixed-size chunks — a separate copy of
   the same helper in routes/proposals.ts (spreading a whole large
   Uint8Array into String.fromCharCode(...) at once can blow the call
   stack); kept local here rather than shared/exported to avoid touching
   that file for an unrelated feature. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

// The message comes from a plain <textarea> (not the RichTextEditor the
// proposal Sender step uses for its HTML personal message), so unlike
// proposal.sender_message elsewhere in this codebase it is NOT already
// HTML — it needs escaping before landing inside the email's HTML body,
// otherwise stray <, >, & typed by accident would either break the layout
// or render as unintended markup.
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

/* ─── Submit platform feedback ───────────────────────────────
 * Sends a one-off email via the same Microsoft Graph app-only sendMail
 * path proposals use (see lib/graph.ts / routes/proposals.ts
 * sendProposalEmail) — NOT Resend, which was retired org-wide (NUVCL-79:
 * Resend sends were silently failing with a 401, this account never had
 * a working Resend API key/domain setup). The sender is picked from the
 * same M365 staff list the proposal wizard's "Sending on behalf of"
 * dropdown uses (GET /staff), and the email goes out FROM that staff
 * member's own @nuvho.com mailbox with reply-to set the same way, to
 * odysseus.ambut@nuvho.com with jude.bolger@nuvho.com cc'd. Nothing is
 * persisted to D1 — this is a fire-and-forget notification, not a
 * tracked feedback-ticket system; revisit if that's needed later. */
export async function submitFeedback(request: Request, env: Env, session: Session): Promise<Response> {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return err('Expected multipart/form-data')
  }

  const staffId = String(form.get('staffId') || '')
  const subject = String(form.get('subject') || '').trim()
  const message = String(form.get('message') || '').trim()
  if (!staffId) return err('Please select who this feedback is from')
  if (!message) return err('Please describe the issue or feedback')

  const sender = await env.DB.prepare('SELECT name, email FROM staff WHERE id = ?')
    .bind(staffId).first<{ name: string; email: string }>()
  if (!sender?.email) return err('Selected sender has no email on file', 400)

  // Multiple files arrive under the same "attachments" field name —
  // FormData.getAll() is how the Fetch API surfaces repeated multipart
  // fields; a single .get() would only ever see the first one.
  const fileEntries = form.getAll('attachments')
  const attachments: { filename: string; contentType: string; contentBase64: string }[] = []
  let totalBytes = 0
  for (const entry of fileEntries) {
    // @cloudflare/workers-types declares FormDataEntryValue's File branch as
    // an interface, not a constructable class, so `instanceof File` fails
    // to typecheck under this project's DOM-less tsconfig — duck-type it
    // instead, matching the pattern in routes/proposals.ts uploadAttachment.
    const file = entry as { name?: string; size?: number; type?: string; arrayBuffer?: () => Promise<ArrayBuffer> } | null
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function' || typeof file.size !== 'number') continue
    if (attachments.length >= MAX_ATTACHMENTS) {
      return err(`Maximum ${MAX_ATTACHMENTS} attachments per submission`, 413)
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return err(`"${file.name}" is too large — ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB limit per file`, 413)
    }
    totalBytes += file.size
    if (totalBytes > MAX_TOTAL_BYTES) {
      return err(`Attachments are too large combined — ${MAX_TOTAL_BYTES / 1024 / 1024}MB limit per submission`, 413)
    }
    attachments.push({
      filename:      file.name || 'attachment',
      contentType:   file.type || 'application/octet-stream',
      contentBase64: arrayBufferToBase64(await file.arrayBuffer()),
    })
  }

  const emailSubject = subject
    ? `[Nuvho Proposal System Feedback] ${subject}`
    : `[Nuvho Proposal System Feedback] from ${sender.name}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #28687F; padding: 24px; text-align: center;">
        <h1 style="color: white; font-size: 22px; margin: 0;">Nuvho — Smart Hoteliers</h1>
      </div>
      <div style="padding: 32px 24px;">
        <p style="font-size: 12px; color: #5E6B6C; margin-top: 0;">
          Platform feedback submitted via the Proposal System
        </p>
        ${subject ? `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ''}
        <p><strong>From:</strong> ${sender.name} (${sender.email})</p>
        <div style="white-space: pre-wrap; border-left: 3px solid #28687F; padding-left: 16px; margin-top: 16px;">${escapeHtml(message)}</div>
      </div>
      <div style="background: #28687F; padding: 16px; text-align: center;">
        <p style="color: rgba(255,255,255,0.6); font-size: 11px; margin: 0;">
          © Nuvho Systems Pty Ltd
        </p>
      </div>
    </div>
  `

  try {
    await sendMailViaGraph(env, sender.email, {
      subject: emailSubject,
      html,
      to: [FEEDBACK_TO],
      cc: [FEEDBACK_CC],
      replyTo: sender.email,
      ...(attachments.length ? { attachments } : {}),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown email error'
    return err(`Failed to send feedback: ${message}`, 502)
  }

  return ok({ sent: true })
}
