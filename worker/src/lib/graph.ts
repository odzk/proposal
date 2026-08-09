import type { Env } from '../types'

/**
 * App-only (client-credentials) Microsoft Graph token.
 * Distinct from the delegated user login flow in lib/auth.ts —
 * this requires the Azure AD app registration (AZURE_CLIENT_ID) to have
 * an ADMIN-CONSENTED APPLICATION permission (e.g. User.Read.All or
 * Directory.Read.All) under Graph API permissions. Without that consent,
 * the token call below will succeed but the /users Graph call will 403.
 */
export async function getAppOnlyGraphToken(env: Env): Promise<string> {
  const params = new URLSearchParams({
    client_id:     env.AZURE_CLIENT_ID,
    client_secret: env.AZURE_CLIENT_SECRET,
    grant_type:    'client_credentials',
    scope:         'https://graph.microsoft.com/.default',
  })

  const res = await fetch(
    `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  const data = await res.json() as any
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Failed to get Graph app token')
  }
  return data.access_token as string
}

/**
 * Sends an email via Microsoft Graph's app-only sendMail action — the
 * Microsoft-recommended replacement for SMTP AUTH (which Microsoft is
 * deprecating for Exchange Online) and the mechanism this codebase now uses
 * instead of the Resend transactional-email API.
 *
 * Requires the SAME Azure AD app registration as getAppOnlyGraphToken(),
 * but with the Mail.Send APPLICATION permission granted and admin-consented
 * in Entra ID — Mail.Send is a separate permission from User.Read.All /
 * Directory.Read.All (used for tenant user sync), so this will 403 with
 * "Insufficient privileges" until that specific permission is added.
 *
 * `fromMailbox` must be a real mailbox in the tenant. An app-only Mail.Send
 * token can, by default, send as ANY mailbox in the tenant — if that's
 * broader than desired, restrict it tenant-side with an Exchange Online
 * ApplicationAccessPolicy scoped to this app's client ID.
 *
 * Note: Graph's simple JSON sendMail payload has a practical message-size
 * ceiling (attachments are base64-inlined in the request body — Microsoft
 * recommends keeping the total request under ~4MB; large attachments need
 * the separate upload-session API instead). Callers with big attachments
 * should account for this rather than assume sendMail always succeeds.
 */
export async function sendMailViaGraph(
  env: Env,
  fromMailbox: string,
  mail: {
    subject: string
    html: string
    to: string[]
    cc?: string[]
    bcc?: string[]
    replyTo?: string
    attachments?: { filename: string; contentType: string; contentBase64: string }[]
  }
): Promise<void> {
  const accessToken = await getAppOnlyGraphToken(env)

  const asRecipient = (address: string) => ({ emailAddress: { address } })

  const message: Record<string, unknown> = {
    subject: mail.subject,
    body: { contentType: 'HTML', content: mail.html },
    toRecipients: mail.to.map(asRecipient),
  }
  if (mail.cc?.length)  message.ccRecipients  = mail.cc.map(asRecipient)
  if (mail.bcc?.length) message.bccRecipients = mail.bcc.map(asRecipient)
  if (mail.replyTo)     message.replyTo = [asRecipient(mail.replyTo)]
  if (mail.attachments?.length) {
    message.attachments = mail.attachments.map(a => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name:          a.filename,
      contentType:   a.contentType || 'application/octet-stream',
      contentBytes:  a.contentBase64,
    }))
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromMailbox)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    }
  )

  // Graph returns 202 Accepted with an empty body on success — there is no
  // JSON to parse either way, so only branch on status for the error path.
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Graph sendMail error ${res.status}: ${detail || 'no detail'}`)
  }
}

export interface GraphUser {
  id:                string
  displayName:       string
  mail:              string | null
  userPrincipalName: string
  jobTitle:          string | null
  accountEnabled:    boolean
}

/**
 * Fetch every user in the tenant (paginated via @odata.nextLink),
 * restricted to enabled @nuvho.com accounts.
 */
export async function listAllTenantUsers(accessToken: string): Promise<GraphUser[]> {
  const users: GraphUser[] = []
  let url: string | null =
    'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,jobTitle,accountEnabled&$top=999'

  while (url) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    const data = await res.json() as any
    if (!res.ok) {
      throw new Error(data.error?.message || `Graph /users request failed (${res.status})`)
    }
    for (const u of data.value || []) {
      const upn = (u.userPrincipalName || '').toLowerCase()
      if (u.accountEnabled && upn.endsWith('@nuvho.com')) {
        users.push({
          id:                u.id,
          displayName:       u.displayName,
          mail:              u.mail,
          userPrincipalName: upn,
          jobTitle:          u.jobTitle,
          accountEnabled:    u.accountEnabled,
        })
      }
    }
    url = data['@odata.nextLink'] || null
  }

  return users
}
