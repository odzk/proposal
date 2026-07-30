'use client'

import { useState } from 'react'

export default function UserSettingsPage() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ total: number; created: number; updated: number } | null>(null)
  const [syncError, setSyncError] = useState('')

  async function handleSync() {
    setSyncing(true)
    setSyncError('')
    setSyncResult(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/staff/sync-m365`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setSyncResult(data.data)
    } catch (e: any) {
      setSyncError(e.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="nv-card sync-card">
      <h2 className="sync-card__title">Microsoft 365 Sync</h2>
      <p className="sync-card__desc">
        Pull every active @nuvho.com account from Microsoft 365 into the staff roster,
        so they show up in the proposal wizard&rsquo;s &ldquo;Sending on behalf of&rdquo; list.
        Existing staff members are matched by email and updated (name, M365 IDs) — their
        role, BD-facing flag, and signatory status are left untouched. New accounts are
        added with default settings.
      </p>

      <button
        className="nv-btn nv-btn--solid nv-btn--md"
        onClick={handleSync}
        disabled={syncing}
        aria-busy={syncing}
      >
        {syncing ? 'Syncing…' : 'Sync Microsoft 365 Users'}
      </button>

      {syncResult && (
        <div className="sync-card__result sync-card__result--ok">
          Synced {syncResult.total} users — {syncResult.created} added, {syncResult.updated} updated.
        </div>
      )}
      {syncError && (
        <div className="sync-card__result sync-card__result--error">{syncError}</div>
      )}

      <style jsx>{`
        .sync-card {
          max-width: 560px;
          width: 100%;
          margin: 0;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
      `}</style>
    </div>
  )
}
