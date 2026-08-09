'use client'

import { useEffect, useState } from 'react'
import type { ServiceCategory, ServiceCategoryScopeSection } from '@/lib/types'
import { generateRowId } from '@/lib/serviceCatalog'

// Body Configuration — the main service-line categories (Sales, Marketing,
// Revenue Management, Central Reservations, Systems, Advisory, and any
// staff-added custom category) offered on Step 2 (Services) of the proposal
// wizard. Fully staff-editable: rename, reorder, deactivate, delete, or add
// new ones. `code` is a stable identifier (also stored on
// proposal_services.code) set once at creation and not editable afterwards
// — deleting or renaming a category later does not affect proposals that
// already used its code; see worker/src/routes/settings.ts.
export default function BodyConfigurationPage() {
  const [categories, setCategories] = useState<ServiceCategory[] | null>(null)
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState('')
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [rowError, setRowError]     = useState<Record<string, string>>({})

  const [newLabel, setNewLabel]     = useState('')
  const [newCode, setNewCode]       = useState('')
  const [newDesc, setNewDesc]       = useState('')
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState('')

  // Scope of Work editor — fully editable per category (add/edit/remove/
  // reorder both sections and the bullets within a section). Only one
  // category's editor is expanded at a time; `scopeDraft` holds the local
  // working copy for that category only, reset from the category's saved
  // `defaultScope` each time it's opened so an un-saved edit from a previous
  // visit never silently reappears. Persisted explicitly via "Save Scope of
  // Work" (not per-keystroke) given how deeply nested this data is.
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const [scopeDraft, setScopeDraft]     = useState<ServiceCategoryScopeSection[]>([])
  const [scopeSaving, setScopeSaving]   = useState(false)
  const [scopeError, setScopeError]     = useState('')
  const [scopeSaved, setScopeSaved]     = useState(false)

  function toggleScopeEditor(cat: ServiceCategory) {
    if (expandedCode === cat.code) { setExpandedCode(null); return }
    setExpandedCode(cat.code)
    setScopeDraft((cat.defaultScope || []).map(s => ({ ...s, items: s.items.map(i => ({ ...i })) })))
    setScopeError('')
    setScopeSaved(false)
  }

  function addScopeSection() {
    setScopeDraft(prev => [...prev, { id: generateRowId('sec'), heading: '', items: [] }])
    setScopeSaved(false)
  }

  function updateScopeSectionHeading(sectionId: string, heading: string) {
    setScopeDraft(prev => prev.map(s => s.id === sectionId ? { ...s, heading } : s))
    setScopeSaved(false)
  }

  function removeScopeSection(sectionId: string) {
    if (!window.confirm('Remove this section and all its bullets?')) return
    setScopeDraft(prev => prev.filter(s => s.id !== sectionId))
    setScopeSaved(false)
  }

  function moveScopeSection(index: number, dir: -1 | 1) {
    setScopeDraft(prev => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setScopeSaved(false)
  }

  function addScopeItem(sectionId: string) {
    setScopeDraft(prev => prev.map(s =>
      s.id === sectionId ? { ...s, items: [...s.items, { id: generateRowId('item'), text: '' }] } : s
    ))
    setScopeSaved(false)
  }

  function updateScopeItemText(sectionId: string, itemId: string, text: string) {
    setScopeDraft(prev => prev.map(s =>
      s.id === sectionId ? { ...s, items: s.items.map(i => i.id === itemId ? { ...i, text } : i) } : s
    ))
    setScopeSaved(false)
  }

  function removeScopeItem(sectionId: string, itemId: string) {
    setScopeDraft(prev => prev.map(s =>
      s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s
    ))
    setScopeSaved(false)
  }

  function moveScopeItem(sectionId: string, index: number, dir: -1 | 1) {
    setScopeDraft(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      const target = index + dir
      if (target < 0 || target >= s.items.length) return s
      const items = [...s.items]
      ;[items[index], items[target]] = [items[target], items[index]]
      return { ...s, items }
    }))
    setScopeSaved(false)
  }

  async function saveScope(code: string) {
    setScopeSaving(true)
    setScopeError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/settings/service-categories/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ defaultScope: scopeDraft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save scope of work')
      updateLocal(code, { defaultScope: scopeDraft })
      setScopeSaved(true)
    } catch (e: any) {
      setScopeError(e.message || 'Failed to save scope of work')
    } finally {
      setScopeSaving(false)
    }
  }

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/settings/service-categories`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load service lines')
      setCategories((data.data as ServiceCategory[]).sort((a, b) => a.sortOrder - b.sortOrder))
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load service lines')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function updateLocal(code: string, patch: Partial<ServiceCategory>) {
    setCategories(prev => prev ? prev.map(c => c.code === code ? { ...c, ...patch } : c) : prev)
  }

  async function saveRow(code: string, patch: { label?: string; description?: string; active?: boolean }) {
    setSavingCode(code)
    setRowError(e => ({ ...e, [code]: '' }))
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/settings/service-categories/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
    } catch (e: any) {
      setRowError(err => ({ ...err, [code]: e.message || 'Failed to save' }))
    } finally {
      setSavingCode(null)
    }
  }

  async function toggleActive(cat: ServiceCategory) {
    const active = !cat.active
    updateLocal(cat.code, { active })
    await saveRow(cat.code, { active })
  }

  async function deleteCategory(cat: ServiceCategory) {
    if (!window.confirm(
      `Delete "${cat.label}" (${cat.code})? Proposals that already used this service line keep it, but it will no longer be offered on new proposals.`
    )) return
    setSavingCode(cat.code)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/settings/service-categories/${cat.code}`, {
        method: 'DELETE', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      setCategories(prev => prev ? prev.filter(c => c.code !== cat.code) : prev)
    } catch (e: any) {
      setRowError(err => ({ ...err, [cat.code]: e.message || 'Failed to delete' }))
    } finally {
      setSavingCode(null)
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!categories) return
    const target = index + dir
    if (target < 0 || target >= categories.length) return
    const reordered = [...categories]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    const withOrder = reordered.map((c, i) => ({ ...c, sortOrder: i + 1 }))
    setCategories(withOrder)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/settings/service-categories/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ codes: withOrder.map(c => c.code) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reorder')
    } catch (e: any) {
      setLoadError(e.message || 'Failed to save new order')
    }
  }

  async function handleAdd() {
    const label = newLabel.trim()
    if (!label) { setAddError('Label is required.'); return }
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/settings/service-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label, code: newCode.trim() || undefined, description: newDesc.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add service line')
      setCategories(prev => [...(prev || []), data.data as ServiceCategory])
      setNewLabel(''); setNewCode(''); setNewDesc('')
    } catch (e: any) {
      setAddError(e.message || 'Failed to add service line')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="nv-card bc-card">
      <h2 className="sync-card__title">Body Configuration</h2>
      <p className="sync-card__desc">
        Configure the main service-line categories offered on Step 2 (Services) when creating a new
        proposal. Rename, reorder, deactivate, or delete a category — deactivated categories stop
        appearing as options on new proposals but existing proposals are unaffected.
      </p>

      {loading && <p className="sync-card__desc">Loading service lines…</p>}
      {loadError && <div className="sync-card__result sync-card__result--error">{loadError}</div>}

      {categories && (
        <div className="bc-list">
          {categories.length === 0 && <p className="bc-empty">No service lines configured yet.</p>}
          {categories.map((cat, i) => (
            <div key={cat.code} className="bc-row-group">
              <div className={`bc-row ${cat.active ? '' : 'bc-row--inactive'}`}>
                <div className="bc-row__order">
                  <button type="button" className="bc-order-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">▲</button>
                  <button type="button" className="bc-order-btn" disabled={i === categories.length - 1} onClick={() => move(i, 1)} aria-label="Move down">▼</button>
                </div>

                <span className="bc-row__code" title="Stable code — used internally, not editable">{cat.code}</span>

                <div className="bc-row__fields">
                  <input
                    className="nv-input bc-label-input"
                    value={cat.label}
                    onChange={e => updateLocal(cat.code, { label: e.target.value })}
                    onBlur={e => saveRow(cat.code, { label: e.target.value })}
                    placeholder="Label"
                  />
                  <input
                    className="nv-input bc-desc-input"
                    value={cat.description}
                    onChange={e => updateLocal(cat.code, { description: e.target.value })}
                    onBlur={e => saveRow(cat.code, { description: e.target.value })}
                    placeholder="Short description shown on the Services step (optional)"
                  />
                </div>

                <label className="bc-active-toggle">
                  <input type="checkbox" checked={cat.active} onChange={() => toggleActive(cat)} />
                  <span>Active</span>
                </label>

                <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm"
                  onClick={() => toggleScopeEditor(cat)}>
                  {expandedCode === cat.code ? 'Hide Scope of Work' : `Scope of Work (${cat.defaultScope?.length || 0})`}
                </button>

                <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm bc-delete"
                  onClick={() => deleteCategory(cat)} disabled={savingCode === cat.code}>
                  Delete
                </button>

                {rowError[cat.code] && <div className="bc-row__error">{rowError[cat.code]}</div>}
              </div>

              {expandedCode === cat.code && (
                <div className="scope-panel">
                  <p className="scope-panel__hint">
                    Default Scope of Work for <strong>{cat.label}</strong> — copied onto Step 3 (Scope) of a
                    new proposal whenever this service line is added on Step 2. Editing it here only affects
                    proposals created afterward.
                  </p>

                  {scopeDraft.length === 0 && (
                    <p className="scope-panel__empty">No sections yet — add one below.</p>
                  )}

                  {scopeDraft.map((section, si) => (
                    <div key={section.id} className="scope-section">
                      <div className="scope-section__header">
                        <div className="scope-order">
                          <button type="button" className="bc-order-btn" disabled={si === 0}
                            onClick={() => moveScopeSection(si, -1)} aria-label="Move section up">▲</button>
                          <button type="button" className="bc-order-btn" disabled={si === scopeDraft.length - 1}
                            onClick={() => moveScopeSection(si, 1)} aria-label="Move section down">▼</button>
                        </div>
                        <input
                          className="nv-input scope-section__heading"
                          value={section.heading}
                          onChange={e => updateScopeSectionHeading(section.id, e.target.value)}
                          placeholder="Section heading — e.g. Revenue Management Services"
                        />
                        <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm bc-delete"
                          onClick={() => removeScopeSection(section.id)}>
                          Remove Section
                        </button>
                      </div>

                      <div className="scope-items">
                        {section.items.map((item, ii) => (
                          <div key={item.id} className="scope-item">
                            <div className="scope-order">
                              <button type="button" className="bc-order-btn" disabled={ii === 0}
                                onClick={() => moveScopeItem(section.id, ii, -1)} aria-label="Move bullet up">▲</button>
                              <button type="button" className="bc-order-btn" disabled={ii === section.items.length - 1}
                                onClick={() => moveScopeItem(section.id, ii, 1)} aria-label="Move bullet down">▼</button>
                            </div>
                            <textarea
                              className="nv-input scope-item__text"
                              value={item.text}
                              onChange={e => updateScopeItemText(section.id, item.id, e.target.value)}
                              placeholder="Bullet text"
                              rows={2}
                            />
                            <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm bc-delete"
                              onClick={() => removeScopeItem(section.id, item.id)}>
                              Remove
                            </button>
                          </div>
                        ))}
                        <button type="button" className="nv-btn nv-btn--outlined nv-btn--sm"
                          onClick={() => addScopeItem(section.id)}>
                          + Add Bullet
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="scope-panel__actions">
                    <button type="button" className="nv-btn nv-btn--outlined nv-btn--sm" onClick={addScopeSection}>
                      + Add Section
                    </button>
                    <button type="button" className="nv-btn nv-btn--solid nv-btn--sm"
                      onClick={() => saveScope(cat.code)} disabled={scopeSaving}>
                      {scopeSaving ? 'Saving…' : 'Save Scope of Work'}
                    </button>
                    {scopeSaved && <span className="scope-panel__saved">Saved ✓</span>}
                  </div>
                  {scopeError && <div className="bc-row__error" style={{ position: 'static' }}>{scopeError}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <h3 className="bc-add-title">Add Service Line</h3>
      <div className="bc-add-form">
        <input className="nv-input" value={newLabel} onChange={e => setNewLabel(e.target.value)}
          placeholder="Label — e.g. Consulting" />
        <input className="nv-input" value={newCode} onChange={e => setNewCode(e.target.value)}
          placeholder="Code (optional — auto-generated from label)" />
        <input className="nv-input" value={newDesc} onChange={e => setNewDesc(e.target.value)}
          placeholder="Short description (optional)" />
        <button type="button" className="nv-btn nv-btn--outlined nv-btn--sm" onClick={handleAdd} disabled={adding}>
          {adding ? 'Adding…' : '+ Add Service Line'}
        </button>
      </div>
      {addError && <div className="sync-card__result sync-card__result--error">{addError}</div>}

      <style jsx>{`
        .bc-card {
          max-width: 760px;
          width: 100%;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .bc-list { display: flex; flex-direction: column; gap: 10px; margin: 16px 0 8px; }
        .bc-empty { font-size: 13px; color: var(--nv-text-muted); font-style: italic; }
        .bc-row-group { display: flex; flex-direction: column; gap: 0; }
        .bc-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          border: 1px solid var(--nv-border-hair);
          border-radius: 8px;
          background: rgba(40,104,127,0.03);
          position: relative;
        }
        .bc-row--inactive { opacity: 0.55; }
        .bc-row__order { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
        .bc-order-btn {
          width: 22px; height: 18px; border: 1px solid var(--nv-border); background: none;
          border-radius: 4px; font-size: 9px; cursor: pointer; line-height: 1;
        }
        .bc-order-btn:disabled { opacity: 0.3; cursor: default; }
        .bc-row__code {
          flex-shrink: 0;
          background: var(--nv-blue-slate);
          color: white;
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          align-self: center;
        }
        .bc-row__fields { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .bc-label-input { font-weight: 600; }
        .bc-desc-input { font-size: 12.5px; }
        .bc-active-toggle {
          display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--nv-text-muted);
          flex-shrink: 0; align-self: center; white-space: nowrap;
        }
        .bc-delete { align-self: center; color: var(--nv-error); flex-shrink: 0; }
        .bc-row__error {
          position: absolute; bottom: -18px; left: 12px; font-size: 11px; color: var(--nv-error);
        }
        .bc-add-title {
          font-family: var(--font-comfortaa); font-size: 14px; font-weight: 700;
          color: var(--nv-text-heading); margin: 12px 0 4px;
        }
        .bc-add-form {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 8px;
          align-items: center;
        }
        @media (max-width: 760px) { .bc-add-form { grid-template-columns: 1fr; } }

        .scope-panel {
          border: 1px solid var(--nv-border-hair);
          border-top: none;
          border-radius: 0 0 8px 8px;
          background: rgba(40,104,127,0.015);
          padding: 14px 14px 16px;
          margin-top: -10px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .scope-panel__hint { font-size: 12px; color: var(--nv-text-muted); margin: 0; }
        .scope-panel__empty { font-size: 12.5px; color: var(--nv-text-muted); font-style: italic; margin: 0; }
        .scope-panel__actions { display: flex; align-items: center; gap: 10px; }
        .scope-panel__saved { font-size: 12px; color: var(--nv-blue-slate); font-weight: 600; }

        .scope-section {
          border: 1px solid var(--nv-border-hair);
          border-radius: 8px;
          padding: 10px;
          background: var(--nv-surface, #fff);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .scope-section__header { display: flex; align-items: center; gap: 8px; }
        .scope-section__heading { flex: 1; font-weight: 600; font-size: 13px; }
        .scope-order { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }

        .scope-items { display: flex; flex-direction: column; gap: 8px; padding-left: 30px; }
        .scope-item { display: flex; align-items: flex-start; gap: 8px; }
        .scope-item__text { flex: 1; font-size: 12.5px; resize: vertical; }
      `}</style>
    </div>
  )
}
