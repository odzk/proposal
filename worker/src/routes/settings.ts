import type { Env, RegionSettingsRow, ServiceCategoryRow, Session } from '../types'
import { ok, err } from '../lib/response'

const VALID_REGIONS = ['au', 'uk', 'ie']

/* ─── Get all region settings (Settings → Region Settings) ────
 * Always returns exactly the 3 seeded regions (au/uk/ie) — schema.sql /
 * migrations/0001_region_settings.sql seed them with INSERT OR IGNORE, so
 * this table should never be empty in practice, but we still guard against
 * a not-yet-migrated database returning nothing.
 */
export async function getRegionSettings(env: Env, session: Session): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM region_settings ORDER BY region'
  ).all<RegionSettingsRow>()

  const data = results.map(r => ({
    region:      r.region,
    address:     r.address,
    companyName: r.company_name,
    aboutNuvho:  r.about_nuvho,
    footerText:  r.footer_text,
    currency:    r.currency,
    clauses:     JSON.parse(r.clauses_json || '[]'),
  }))

  return ok(data)
}

/* ─── Update one region's settings ──────────────────────────── */
export async function updateRegionSettings(
  region: string, request: Request, env: Env, session: Session
): Promise<Response> {
  if (!VALID_REGIONS.includes(region)) return err('Unknown region', 404)

  const body = await request.json() as {
    address?:     string
    companyName?: string
    aboutNuvho?:  string
    footerText?:  string
    currency?:    string
    clauses?:     { id: string; heading: string; text: string; enabled: boolean }[]
  }

  await env.DB.prepare(`
    INSERT INTO region_settings (region, address, company_name, about_nuvho, footer_text, currency, clauses_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(region) DO UPDATE SET
      address      = excluded.address,
      company_name = excluded.company_name,
      about_nuvho  = excluded.about_nuvho,
      footer_text  = excluded.footer_text,
      currency     = excluded.currency,
      clauses_json = excluded.clauses_json,
      updated_at   = datetime('now')
  `).bind(
    region,
    body.address ?? '',
    body.companyName ?? '',
    body.aboutNuvho ?? '',
    body.footerText ?? '',
    body.currency ?? 'AUD',
    JSON.stringify(body.clauses ?? []),
  ).run()

  return ok({ updated: true })
}

/* ─── Service Categories (Settings → Service Lines) ─────────────
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
