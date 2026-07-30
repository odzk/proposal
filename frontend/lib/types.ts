// ─── Proposal System Types ───────────────────────────────────────────────────

export type ProposalStatus = 'draft' | 'generated' | 'sent' | 'signed' | 'expired' | 'fully_signed'
// Was a fixed 4-value union ('RM'|'SM'|'MK'|'CR'). Widened to `string` because
// service-line categories are now managed from Settings → Service Lines
// (fully staff-editable — add/rename/delete), so the set of valid codes is no
// longer known at compile time. String-literal codes like 'RM' still satisfy
// this type unchanged; see ServiceCategory below and lib/serviceCatalog.ts's
// getServiceEntry/getServiceLabel/getServiceColor for the safe-lookup pattern
// now required anywhere a code might not have a hardcoded catalog entry.
export type ServiceCode     = string
export type Region          = 'au' | 'uk' | 'ie'

export interface ServiceLine {
  id: string
  code: ServiceCode
  label: string
  description: string
  monthlyFee: number
  setupFee: number
  termMonths: number
  selected: boolean
}

export interface Proposal {
  id: string                   // NP-AU-260610-X7K2M9
  hgidStructural: string       // HG-AU-0004
  hgidDisplay: string          // HG-AU-HRBT
  pidStructural: string
  pidDisplay: string
  slug: string
  hotelName: string
  clientName: string
  clientEmail: string
  clientPhone?: string
  senderId: string
  senderName: string
  senderTitle: string
  bdOwnerStfId?: string
  accountManagerStfId?: string
  regionId: Region
  entityCode: string
  hubspotDealId?: string
  status: ProposalStatus
  services: ServiceLine[]
  createdAt: string
  firstViewedAt?: string
  lastViewedAt?: string
  viewCount: number
  expiryDate: string
  coverImageR2Key?: string
  coverOverlayOpacity: number
  parentProposalId?: string
}

export interface ProposalSummary {
  id: string
  hotelName: string
  clientName: string
  clientEmail: string
  status: ProposalStatus
  regionId: Region
  totalMonthlyValue: number
  servicesCount: number
  createdAt: string
  firstViewedAt?: string
  expiryDate: string
  viewCount: number
}

export interface Staff {
  id: string
  name: string
  email: string
  title: string
  role: 'owner' | 'admin' | 'staff' | 'read_only'
  roleType: 'exec' | 'bd' | 'account_manager' | 'delivery' | 'ops' | 'support'
  bdFacing: boolean
  isSignatory: boolean
  hubspotOwnerId?: string
  asanaGid?: string
  m365UserId?: string
  m365Upn?: string
  timezone: string
  active: boolean
}

// Fee-row type used by the per-service Pricing editor
export type FeeType = 'monthly' | 'setup' | 'fixed' | 'daily' | 'hourly' | 'commission' | 'custom'

// One ordered/toggleable scope-of-work line item, grouped under a section heading
export interface ScopeItem {
  id:             string
  sectionHeading: string
  text:           string
  enabled:        boolean
  isCustom?:      boolean
}

// One editable, reorderable pricing row within a service line
export interface FeeRow {
  id:        string
  component: string
  feeType:   FeeType
  fee:       number | ''
  term:      number | ''
  note:      string
}

// One editable, reorderable footnote / small-print line under a service's pricing table
export interface PricingFootnote {
  id:   string
  text: string
}

// Simplified service line used inside the proposal wizard
export interface DraftServiceLine {
  code:        ServiceCode
  // Flat summary fields — derived from feeRows (kept for backward-compat with
  // the worker's proposal_services columns and existing total/summary calcs)
  monthlyFee:  number
  setupFee:    number
  term:        number
  // Scope of work — ordered, toggleable, inline-editable per service line
  scopeItems:  ScopeItem[]
  // Flexible pricing — draggable fee rows + footnotes per service line
  feeRows:     FeeRow[]
  footnotes:   PricingFootnote[]
}

// One editable, reorderable Terms & Conditions clause
export interface TermsClause {
  id:      string
  heading: string
  text:    string
  enabled: boolean
}

// Per-region defaults edited from Settings → Region Settings and applied onto
// the wizard draft when Hotel Details' region is selected — Nuvho's own
// entity address (letterhead), the legal footer (company registration small
// print), the operating currency, and the default Terms & Conditions clauses
// for that jurisdiction.
export interface RegionSettings {
  region:      Region
  address:     string
  companyName: string   // legal entity name shown as the section heading — e.g. "Nuvho Pty Ltd" (AU); differs per region
  aboutNuvho:  string   // about-us paragraph under that heading — wording can differ per region too
  footerText:  string
  currency:    string   // ISO 4217 code, e.g. 'AUD' | 'GBP' | 'EUR'
  clauses:     TermsClause[]
}

// One default Scope-of-Work bullet within a section, as configured on a
// ServiceCategory in Settings → Service Lines. Mirrors the worker's
// service_categories.default_scope_json column shape.
export interface ServiceCategoryScopeItem {
  id:   string
  text: string
}

// One default Scope-of-Work section (heading + bullets) as configured on a
// ServiceCategory in Settings → Service Lines. Fully staff-editable — add/
// edit/remove/reorder both sections and items within a section.
export interface ServiceCategoryScopeSection {
  id:      string
  heading: string
  items:   ServiceCategoryScopeItem[]
}

// A main service-line category managed from Settings → Service Lines — the
// list Step 2 (Services) of the proposal wizard offers to select from. Fully
// staff-editable (add/rename/reorder/deactivate/delete); `code` is stable
// once created (stored on proposal_services.code) even though the category
// itself can later be deleted or renamed. `defaultScope` is the default
// Scope of Work (sections + bullets) copied into a new proposal's Step 3
// when this category is added on Step 2 — editing it here only affects
// proposals created afterward (see the "Settings are a template, not a live
// link" pattern used elsewhere, e.g. RegionSettings clauses).
export interface ServiceCategory {
  code:         string
  label:        string
  description:  string
  sortOrder:    number
  active:       boolean
  defaultScope: ServiceCategoryScopeSection[]
}

export type SignatureMethod = 'type' | 'draw'

export interface ProposalTerms {
  clauses:           TermsClause[]
  validityDays:      number
  signatureRequired: boolean
  // How the signatory provides their signature — typed (rendered in a script
  // font) or hand-drawn on a canvas. `signatoryName` doubles as the printed
  // name under the mark either way; `signatureDataUrl` holds the drawn PNG.
  signatureMethod:   SignatureMethod
  signatoryName:     string
  signatoryTitle:    string
  signatureDataUrl:  string
}

// Proposal generator wizard state (nested per-step structure)
export interface ProposalDraft {
  step: number

  // Step 1 — Hotel & Contact
  hotel: {
    name:            string
    region:          Region
    hgid:            string   // Nuvho Master Registry Hotel Group id (HG-{GEO}-{SEQ4}) — set via typeahead
    pid:             string   // Nuvho Master Registry Property id (PRP-{GEO}-{SEQ4}) — resolved/created alongside hgid
    entityCode:      string   // registry entity_code resolved from the selected hotel group
    contactName:     string
    contactEmail:    string
    contactPhone:    string
    contactTitle:    string
    propertyAddress: string
    hubspotDealId:   string
    hubspotCompanyId?: string   // HubSpot Company id — resolved via /hubspot/search or created via /hubspot/clients
    hubspotContactId?: string   // HubSpot Contact id — resolved via /hubspot/search or created via /hubspot/clients
  }

  // Region settings snapshot — applied automatically from Settings → Region
  // Settings when hotel.region is selected (see applyRegionSettings() in the
  // wizard). Sent to the worker at create/update time and stored on the
  // proposal row so historical proposals keep the address/footer/currency
  // that applied when they were generated, even if Settings are edited later.
  regionSettings: {
    address:     string
    companyName: string
    aboutNuvho:  string
    footerText:  string
    currency:    string
  }

  // Step 2 — Service Lines
  services: DraftServiceLine[]

  // Step 5 — Sender
  sender: {
    staffId: string
    accountManagerId: string
    message: string
  }

  // Step 6 — Cover
  cover: {
    coverUrl: string
  }

  // Step 7 — Terms & Conditions
  terms: ProposalTerms

  // Step 8 — Preview
  preview: {
    recipientEmail: string
  }

  // Set after successful generation
  proposalId?: string
  proposalUrl?: string
}

export interface DashboardStats {
  totalProposals:      number
  sentThisMonth:       number
  signedThisMonth:     number
  conversionRate:      number
  totalMonthlyRevenue: number
  pendingFollowups:    number
  avgResponseDays:     number
  pendingSignature:    number
  totalRevenuePending: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
