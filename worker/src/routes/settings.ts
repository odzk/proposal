import type { Env, EntitySettingsRow, ServiceCategoryRow, Session } from '../types'
import { ok, err } from '../lib/response'
import { listEntities, RegistryError } from '../lib/registry'

const REGION_ORDER = ['au', 'uk', 'ie'] as const
const REGION_FALLBACK_CURRENCY: Record<string, string> = { au: 'AUD', uk: 'GBP', ie: 'EUR' }

function operatingEntityCodeForRegion(region: string): string {
  return `NVH-${region.toUpperCase()}-OPS`
}

/* ─── Get all entities, merged with this app's own settings (Settings →
 * Entities) ──────────────────────────────────────────────────────────────
 * Legal identity (legal_name/jurisdiction/role/is_active/is_data_controller)
 * is read live from the Nuvho Master Registry — the source of truth for
 * which legal entities exist; this app never stores or edits that. Address/
 * about/footer/currency/T&Cs are this app's own data (entity_settings),
 * merged in here by entity_code. Every active entity the registry returns
 * is included, not just the 3 client-facing "operating" ones.
 */
export async function getEntitySettings(env: Env, session: Session): Promise<Response> {
  let entities
  try {
    entities = await listEntities(env)
  } catch (e) {
    if (e instanceof RegistryError) return err(e.message, e.status)
    return err(e instanceof Error ? e.message : 'Registry lookup failed', 502)
  }

  const { results } = await env.DB.prepare('SELECT * FROM entity_settings').all<EntitySettingsRow>()
  const byCode = new Map(results.map(r => [r.entity_code, r]))

  const data = entities.map(e => {
    const row = byCode.get(e.entity_code)
    return {
      entityCode:       e.entity_code,
      legalName:        e.legal_name,
      jurisdiction:     e.jurisdiction,
      role:             e.role,
      isDataController: e.is_data_controller,
      isActive:         e.is_active,
      address:          row?.address ?? '',
      aboutNuvho:       row?.about_nuvho ?? '',
      footerText:       row?.footer_text ?? '',
      currency:         row?.currency ?? 'AUD',
      clauses:          JSON.parse(row?.clauses_json || '[]'),
    }
  })

  return ok(data)
}

/* ─── Update one entity's settings (address/about/footer/currency/T&Cs) ───
 * entity_code isn't re-validated against the live registry here — the
 * Settings → Entities UI only ever submits an entity_code it just fetched
 * from GET /settings/entities, so an extra round-trip per save would be
 * pure overhead. */
export async function updateEntitySettings(
  entityCode: string, request: Request, env: Env, session: Session
): Promise<Response> {
  if (!entityCode) return err('entity_code is required', 404)

  const body = await request.json() as {
    address?:    string
    aboutNuvho?: string
    footerText?: string
    currency?:   string
    clauses?:    { id: string; heading: string; text: string; enabled: boolean }[]
  }

  await env.DB.prepare(`
    INSERT INTO entity_settings (entity_code, address, about_nuvho, footer_text, currency, clauses_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(entity_code) DO UPDATE SET
      address      = excluded.address,
      about_nuvho  = excluded.about_nuvho,
      footer_text  = excluded.footer_text,
      currency     = excluded.currency,
      clauses_json = excluded.clauses_json,
      updated_at   = datetime('now')
  `).bind(
    entityCode,
    body.address ?? '',
    body.aboutNuvho ?? '',
    body.footerText ?? '',
    body.currency ?? 'AUD',
    JSON.stringify(body.clauses ?? []),
  ).run()

  return ok({ updated: true })
}

/* ─── Region settings — computed, read-only feed for the proposal wizard ───
 * Settings → Region Settings no longer exists as an editable page (see
 * Settings → Entities instead) — this endpoint is kept ONLY so the wizard's
 * Hotel Details step (Step1HotelDetails / applyRegionSettings in
 * frontend/app/(app)/proposals/new/page.tsx) keeps working completely
 * unchanged. For each region it resolves that region's client-facing
 * operating entity (NVH-{GEO}-OPS), pulls that entity's settings from
 * entity_settings, and its legal name live from the registry — exactly the
 * entity a hotel group in that geo is actually contracted under.
 */
export async function getRegionSettings(env: Env, session: Session): Promise<Response> {
  let entities: Awaited<ReturnType<typeof listEntities>> = []
  try {
    entities = await listEntities(env)
  } catch {
    // Wizard defaults degrade to blank company names rather than fail the
    // whole Hotel Details step if the registry is briefly unreachable.
  }
  const byCode = new Map(entities.map(e => [e.entity_code, e]))

  const { results } = await env.DB.prepare('SELECT * FROM entity_settings').all<EntitySettingsRow>()
  const settingsByCode = new Map(results.map(r => [r.entity_code, r]))

  const data = REGION_ORDER.map(region => {
    const entityCode = operatingEntityCodeForRegion(region)
    const entity = byCode.get(entityCode)
    const row = settingsByCode.get(entityCode)
    return {
      region,
      address:     row?.address ?? '',
      companyName: entity?.legal_name ?? '',
      aboutNuvho:  row?.about_nuvho ?? '',
      footerText:  row?.footer_text ?? '',
      currency:    row?.currency ?? REGION_FALLBACK_CURRENCY[region] ?? 'AUD',
      clauses:     JSON.parse(row?.clauses_json || '[]'),
    }
  })

  return ok(data)
}

/* ─── Service Categories (Settings → Body Configuration) ─────────────
 * Main service-line categories offered on Step 2 (Services) of the proposal
 * wizard. Fully staff-editable (add/rename/reorder/deactivate/delete) —
 * `code` is a stable identifier also stored on proposal_services.code, so
 * deleting a category here does not touch any proposal that already
 * referenced its code; it just stops being offered on new proposals.
 */
export async function getServiceCategories(env: Env, session: Session): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM service_categories ORDER BY sort_order, label'
  ).all<ServiceCategoryRow>()

  const data = results.map(r => ({
    code:         r.code,
    label:        r.label,
    description:  r.description,
    sortOrder:    r.sort_order,
    active:       !!r.active,
    defaultScope: JSON.parse(r.default_scope_json || '[]'),
  }))

  return ok(data)
}

function slugifyCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)
}

export async function createServiceCategory(request: Request, env: Env, session: Session): Promise<Response> {
  const body = await request.json() as {
    code?: string; label?: string; description?: string
    defaultScope?: { id: string; heading: string; items: { id: string; text: string }[] }[]
  }
  const label = (body.label ?? '').trim()
  if (!label) return err('Label is required.')

  const code = slugifyCode(body.code?.trim() || label)
  if (!code) return err('Could not derive a valid code from that label — try a simpler code.')

  const existing = await env.DB.prepare(
    'SELECT code FROM service_categories WHERE code = ?'
  ).bind(code).first()
  if (existing) return err(`A service category with code "${code}" already exists.`, 409)

  const { results } = await env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM service_categories'
  ).all<{ max_order: number }>()
  const nextOrder = (results[0]?.max_order ?? 0) + 1
  const defaultScope = body.defaultScope ?? []

  await env.DB.prepare(`
    INSERT INTO service_categories (code, label, description, sort_order, active, default_scope_json, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, datetime('now'))
  `).bind(code, label, body.description ?? '', nextOrder, JSON.stringify(defaultScope)).run()

  return ok({ code, label, description: body.description ?? '', sortOrder: nextOrder, active: true, defaultScope })
}

export async function updateServiceCategory(
  code: string, request: Request, env: Env, session: Session
): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT * FROM service_categories WHERE code = ?'
  ).bind(code).first<ServiceCategoryRow>()
  if (!existing) return err('Unknown service category.', 404)

  const body = await request.json() as {
    label?: string; description?: string; active?: boolean
    defaultScope?: { id: string; heading: string; items: { id: string; text: string }[] }[]
  }

  await env.DB.prepare(`
    UPDATE service_categories
    SET label = ?, description = ?, active = ?, default_scope_json = ?, updated_at = datetime('now')
    WHERE code = ?
  `).bind(
    body.label !== undefined ? body.label : existing.label,
    body.description !== undefined ? body.description : existing.description,
    body.active !== undefined ? (body.active ? 1 : 0) : existing.active,
    body.defaultScope !== undefined ? JSON.stringify(body.defaultScope) : existing.default_scope_json,
    code,
  ).run()

  return ok({ updated: true })
}

export async function deleteServiceCategory(code: string, env: Env, session: Session): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT code FROM service_categories WHERE code = ?'
  ).bind(code).first()
  if (!existing) return err('Unknown service category.', 404)

  await env.DB.prepare('DELETE FROM service_categories WHERE code = ?').bind(code).run()
  return ok({ deleted: true })
}

/* Bulk reorder — accepts the full ordered list of codes (as dragged/reordered
 * in the Settings UI) and rewrites sort_order to match array index. */
export async function reorderServiceCategories(request: Request, env: Env, session: Session): Promise<Response> {
  const body = await request.json() as { codes?: string[] }
  const codes = Array.isArray(body.codes) ? body.codes : []
  if (!codes.length) return err('codes array is required.')

  const stmts = codes.map((code, i) =>
    env.DB.prepare(`UPDATE service_categories SET sort_order = ?, updated_at = datetime('now') WHERE code = ?`)
      .bind(i + 1, code)
  )
  await env.DB.batch(stmts)

  return ok({ reordered: true })
}
