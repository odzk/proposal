// ─── Proposal Document Model ─────────────────────────────────────────────────
// A normalized, presentation-ready shape that both the wizard's Preview & Send
// step (working from an in-progress ProposalDraft) and the Proposal Details
// page (working from a saved proposal fetched over the API) can build, so a
// single <ProposalDocument> component and a single DOCX/PDF export path can
// serve both places instead of duplicating the document layout twice.

import type { ProposalDraft, ScopeItem, FeeRow, PricingFootnote, TermsClause } from './types'
import { getServiceLabel, deriveFeeSummary, currencySymbol } from './serviceCatalog'

export const ROLE_LABELS: Record<string, string> = {
  exec: 'Executive', bd: 'Business Development', account_manager: 'Account Manager',
  delivery: 'Delivery', ops: 'Operations', support: 'Support',
}

export interface DocServiceGroup {
  code:       string
  label:      string
  scopeItems: ScopeItem[]
  feeRows:    FeeRow[]
  footnotes:  PricingFootnote[]
}

export interface ProposalDocModel {
  title:             string
  hotelName:         string
  contactName:       string
  propertyAddress:   string
  nuvhoAddress:      string   // Nuvho entity address for the proposal's region (Settings → Region Settings)
  companyName:       string   // legal entity name shown as the section heading — e.g. "Nuvho Pty Ltd" (AU); differs per region
  aboutNuvho:        string   // about-us paragraph under that heading — wording differs per region too
  footerText:        string   // legal footer / company-registration small print for that region
  currencySymbol:    string   // derived from the region's currency, used instead of a hardcoded '$'
  dateIssued:        string   // pre-formatted display date, e.g. "23 July 2026"
  coverUrl:          string
  introMessage:      string
  senderName:        string
  senderRoleLabel:   string
  senderEmail:       string
  services:          DocServiceGroup[]
  grandTotalMonthly: number
  footnotes:         PricingFootnote[]
  validityDays:      number
  signatureRequired: boolean
  signatureMethod:   'type' | 'draw'
  signatoryName:     string
  signatoryTitle:    string
  signatureDataUrl:  string
  // Optional rich-text (HTML, authored via TinyMCE on the wizard's Signature
  // step) message rendered above the signature block, in place of the
  // default "Should the terms of this proposal be acceptable…" sentence.
  signatureMessage:  string
  clauses:           TermsClause[]
}

// "Central Reservations" + "Marketing Services" → "Central Reservations & Marketing Services"
// (appends "Services" once at the end, not per-label, since some catalog labels already carry it)
export function proposalTitle(labels: string[]): string {
  if (labels.length === 0) return 'Services Proposal'
  const joined = labels.join(' & ')
  return /services$/i.test(joined) ? joined : `${joined} Services`
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface StaffLike { id: string; name: string; email: string; role_type: string }

/** Build the document model from the in-progress wizard draft (Preview & Send step). */
export function buildDocModelFromDraft(draft: ProposalDraft, staff: StaffLike[]): ProposalDocModel {
  const sender = staff.find(s => s.id === draft.sender.staffId)
  const services: DocServiceGroup[] = draft.services.map(s => ({
    code: s.code, label: getServiceLabel(s.code),
    scopeItems: s.scopeItems, feeRows: s.feeRows, footnotes: s.footnotes,
  }))
  const title = proposalTitle(services.map(s => s.label))

  return {
    title,
    hotelName:         draft.hotel.name,
    contactName:       draft.hotel.contactName,
    propertyAddress:   draft.hotel.propertyAddress,
    nuvhoAddress:      draft.regionSettings.address,
    companyName:       draft.regionSettings.companyName,
    aboutNuvho:        draft.regionSettings.aboutNuvho,
    footerText:        draft.regionSettings.footerText,
    currencySymbol:    currencySymbol(draft.regionSettings.currency),
    dateIssued:        formatToday(),
    coverUrl:          draft.cover.coverUrl,
    // sender.message is now authored via TinyMCE (Step 5) — always HTML.
    // The fallback default is wrapped in <p> so introMessage is always valid
    // HTML either way (see ProposalDocument.tsx / exportDocx.ts renderers).
    introMessage:      draft.sender.message || `<p>I am pleased to present this proposal to undertake ${title.toLowerCase()} for ${draft.hotel.name || 'your property'}. This document represents our commercial proposal, incorporating our recommended scope of works, fee structure and terms of engagement.</p>`,
    senderName:        sender?.name || '',
    senderRoleLabel:   sender ? (ROLE_LABELS[sender.role_type] || sender.role_type) : '',
    senderEmail:       sender?.email || '',
    services,
    grandTotalMonthly: services.reduce((sum, s) => sum + deriveFeeSummary(s.feeRows).monthlyFee, 0),
    footnotes:         services.flatMap(s => s.footnotes).filter(f => f.text.trim()),
    validityDays:      draft.terms.validityDays,
    signatureRequired: draft.terms.signatureRequired,
    signatureMethod:   draft.terms.signatureMethod,
    signatoryName:     draft.terms.signatoryName,
    signatoryTitle:    draft.terms.signatoryTitle,
    signatureDataUrl:  draft.terms.signatureDataUrl,
    signatureMessage:  draft.terms.signatureMessage || '',
    clauses:           draft.terms.clauses.filter(c => c.enabled),
  }
}

/** Build the document model from a saved proposal as returned by GET /proposals/:id. */
export function buildDocModelFromProposal(p: any): ProposalDocModel {
  const rawServices: any[] = p.services || []
  const services: DocServiceGroup[] = rawServices.map(s => ({
    code:       s.code,
    label:      getServiceLabel(s.code),
    scopeItems: s.scope_items || [],
    feeRows:    s.fee_rows || [],
    footnotes:  s.footnotes || [],
  }))
  const title  = proposalTitle(services.map(s => s.label))
  const terms  = p.terms || {}
  const sender = p.sender || null

  return {
    title,
    hotelName:         p.hotel_name || '',
    contactName:       p.contact_name || '',
    propertyAddress:   p.property_address || '',
    nuvhoAddress:      p.nuvho_address || '',
    companyName:       p.company_name || '',
    aboutNuvho:        p.about_nuvho || '',
    footerText:        p.footer_text || '',
    currencySymbol:    currencySymbol(p.currency || 'AUD'),
    dateIssued:        p.created_at ? new Date(p.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : formatToday(),
    coverUrl:          p.cover_url || '',
    introMessage:      p.sender_message || `<p>I am pleased to present this proposal to undertake ${title.toLowerCase()} for ${p.hotel_name || 'your property'}. This document represents our commercial proposal, incorporating our recommended scope of works, fee structure and terms of engagement.</p>`,
    senderName:        sender?.name || '',
    senderRoleLabel:   sender ? (ROLE_LABELS[sender.role_type] || sender.role_type) : '',
    senderEmail:       sender?.email || '',
    services,
    grandTotalMonthly: services.reduce((sum, s) => sum + deriveFeeSummary(s.feeRows).monthlyFee, 0),
    footnotes:         services.flatMap(s => s.footnotes).filter((f: PricingFootnote) => f.text.trim()),
    validityDays:      terms.validityDays ?? 30,
    signatureRequired: terms.signatureRequired ?? false,
    signatureMethod:   terms.signatureMethod === 'draw' ? 'draw' : 'type',
    signatoryName:     terms.signatoryName || '',
    signatoryTitle:    terms.signatoryTitle || '',
    signatureDataUrl:  terms.signatureDataUrl || '',
    signatureMessage:  terms.signatureMessage || '',
    clauses:           (terms.clauses || []).filter((c: TermsClause) => c.enabled),
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
