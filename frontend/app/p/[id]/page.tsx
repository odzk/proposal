'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { NuvhoLogo } from '@/components/ui/NuvhoLogo'
import { ProposalDocument } from '@/components/proposal/ProposalDocument'
import { SignaturePad } from '@/components/proposal/SignaturePad'
import { buildDocModelFromProposal } from '@/lib/documentModel'
import type { ProposalDocModel } from '@/lib/documentModel'

/* Public, unauthenticated proposal view (proposals.nuvho.com/p/{signing_token}).
   Renders the exact same <ProposalDocument> the internal Proposal Details page
   shows staff (cover, letter, background, scope of works, fee structure, and
   Quote Approval / signature block, plus the terms appendix) so the client is
   reviewing the real proposal rather than a placeholder summary. The Accept
   This Proposal control below the document signs using whichever method
   (typed name or drawn signature) the proposal's Quote Approval section is
   configured for, via the same <SignaturePad> the internal wizard uses. */
export default function PublicProposalPage() {
  const params = useParams<{ id: string }>()
  const [raw,      setRaw]      = useState<any | null>(null)
  const [docModel, setDocModel] = useState<ProposalDocModel | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [signing,  setSigning]  = useState(false)
  const [signed,   setSigned]   = useState(false)

  // Signing form state — seeded from the proposal's own Quote Approval
  // fields once it loads, so a pre-filled signatory name/title carries
  // through rather than starting blank. sigMethod is a client-chosen toggle
  // (Type name / Draw signature) — same choice the internal wizard's Terms
  // step offers staff — rather than being locked to one method.
  const [sigMethod,  setSigMethod]  = useState<'type' | 'draw'>('type')
  const [sigName,    setSigName]    = useState('')
  const [sigTitle,   setSigTitle]   = useState('')
  const [sigDataUrl, setSigDataUrl] = useState('')
  // NUVCL-105: requires an explicit "I have read and agree to the Terms and
  // Conditions" acknowledgement before Accept & Sign is enabled — mirrors
  // the approval statement added to the Quote Approval section of the
  // generated document itself.
  const [approved, setApproved] = useState(false)

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/p/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setRaw(d.data)
        const model = buildDocModelFromProposal(d.data)
        setDocModel(model)
        // model.signatoryName/signatoryTitle/signatureMethod/signatureDataUrl
        // are the SENDER's own letter sign-off ("Yours sincerely, ...") —
        // not the client's. The Accept & Sign form is the client signing as
        // themselves, so it seeds from the hotel contact's own name/title
        // instead, and always starts on the simpler "type name" method with
        // a blank signature canvas rather than showing the sender's drawn
        // signature as if the client had already signed.
        setSigMethod('type')
        setSigName(model.contactName)
        setSigTitle(model.contactTitle)
        setSigDataUrl('')
        setSigned(d.data.status === 'signed')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.id])

  async function handleSign() {
    if (!docModel) return
    if (!approved) return
    if (!sigName.trim()) return
    if (sigMethod === 'draw' && !sigDataUrl) return
    setSigning(true)
    setError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/p/${params.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureMethod:   sigMethod,
          signatoryName:     sigName.trim(),
          signatoryTitle:    sigTitle.trim(),
          signatureDataUrl:  sigMethod === 'draw' ? sigDataUrl : '',
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to sign proposal')

      // Reflect the just-captured signature straight into the rendered
      // document so the Quote Approval section shows exactly what was
      // signed, without a refetch.
      setDocModel(prev => prev ? {
        ...prev,
        signatureMethod:  sigMethod,
        signatoryName:    sigName.trim(),
        signatoryTitle:   sigTitle.trim(),
        signatureDataUrl: sigMethod === 'draw' ? sigDataUrl : '',
      } : prev)
      setSigned(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSigning(false)
    }
  }

  if (loading) return <LoadingScreen />
  if (!raw || !docModel) return <ErrorScreen message={error || 'Proposal not found'} />

  const isExpired = raw.status === 'expired' ||
    (raw.expires_at && new Date(raw.expires_at) < new Date())

  return (
    <div className="public-page">
      {/* Header */}
      <header className="public-header">
        <NuvhoLogo variant="white" height={40} />
        <div className="public-header__meta">
          <span className="public-header__ref">
            Proposal #{raw.np_id || (raw.id ? raw.id.slice(0, 8).toUpperCase() : '')}
          </span>
          {raw.expires_at && (
            <span className="public-header__expiry">
              Valid until {new Date(raw.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}
        </div>
      </header>

      {/* The actual proposal — same component + model builder as the
          internal Proposal Details page, so nothing here is a summary or
          placeholder. */}
      <div className="public-doc-wrap">
        <ProposalDocument model={docModel} />
      </div>

      {/* Accept & Sign */}
      <div className="public-body">
        <section className="public-section public-sign-section">
          {signed ? (
            <div className="public-signed">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" fill="var(--nv-success)" fillOpacity="0.1"/>
                <circle cx="24" cy="24" r="22" stroke="var(--nv-success)" strokeWidth="2"/>
                <path d="M14 24l7 7 13-13" stroke="var(--nv-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3>Proposal Accepted</h3>
              <p>Thank you for accepting this proposal. Our team will be in touch shortly to begin onboarding.</p>
            </div>
          ) : isExpired ? (
            <div className="public-expired">
              <h3>Proposal Expired</h3>
              <p>This proposal has expired. Please contact your Nuvho representative to receive an updated proposal.</p>
            </div>
          ) : (
            <div className="public-sign-form">
              <h2 className="public-section-title">Accept This Proposal</h2>
              <p style={{ fontSize: 14, color: 'var(--nv-text-muted)', marginBottom: 20 }}>
                By signing below, you acknowledge and accept the terms and services outlined in this proposal.
              </p>

              <div className="sign-fields">
                <div className="sign-field">
                  <label className="sign-label">Your full name</label>
                  <input
                    className="nv-input"
                    placeholder="Your full name"
                    value={sigName}
                    onChange={e => setSigName(e.target.value)}
                  />
                </div>
                <div className="sign-field">
                  <label className="sign-label">Title (optional)</label>
                  <input
                    className="nv-input"
                    placeholder="e.g. General Manager"
                    value={sigTitle}
                    onChange={e => setSigTitle(e.target.value)}
                  />
                </div>
              </div>

              {/* Same Type name / Draw signature toggle as the internal
                  wizard's Terms & Conditions step — the client picks how
                  they sign rather than being locked to one method. */}
              <div className="signature-method" role="tablist" aria-label="Signature method">
                <button type="button" role="tab" aria-selected={sigMethod === 'type'}
                  className={`signature-method__btn ${sigMethod === 'type' ? 'signature-method__btn--active' : ''}`}
                  onClick={() => setSigMethod('type')}>
                  Type name
                </button>
                <button type="button" role="tab" aria-selected={sigMethod === 'draw'}
                  className={`signature-method__btn ${sigMethod === 'draw' ? 'signature-method__btn--active' : ''}`}
                  onClick={() => setSigMethod('draw')}>
                  Draw signature
                </button>
              </div>

              {sigMethod === 'draw' ? (
                <div className="sign-capture">
                  <span className="sign-capture__label">Draw signature</span>
                  <SignaturePad value={sigDataUrl} onChange={setSigDataUrl} />
                </div>
              ) : (
                <div className="sign-capture">
                  <span className="sign-capture__label">Signature preview</span>
                  <div className="sign-capture__script">{sigName || 'Your name here'}</div>
                </div>
              )}

              <label className="approval-check">
                <input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />
                <span>
                  I have read and agree to the{' '}
                  <a href="#doc-section-appendix" onClick={e => {
                    e.preventDefault()
                    document.getElementById('doc-section-appendix')?.scrollIntoView({ behavior: 'smooth' })
                  }}>Terms and Conditions</a>.
                </span>
              </label>

              <button
                className="nv-btn nv-btn--solid nv-btn--lg"
                onClick={handleSign}
                disabled={signing || !approved || !sigName.trim() || (sigMethod === 'draw' && !sigDataUrl)}
                aria-busy={signing}
              >
                {signing ? 'Signing…' : 'Accept & Sign'}
              </button>

              {error && (
                <p style={{ color: 'var(--nv-error)', fontSize: 13, marginTop: 8 }}>{error}</p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="public-footer">
        <span>© Nuvho Systems Pty Ltd · Smart Hoteliers</span>
      </footer>

      <style jsx>{`
        .public-page {
          min-height: 100vh;
          background: var(--nv-surface-page);
          display: flex;
          flex-direction: column;
        }

        /* Header */
        .public-header {
          background: var(--nv-surface-dark);
          padding: 16px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        @media (max-width: 600px) { .public-header { padding: 16px; } }
        .public-header__meta { text-align: right; }
        .public-header__ref  { font-size: 12px; color: rgba(255,255,255,0.6); display: block; }
        .public-header__expiry { font-size: 11px; color: rgba(255,255,255,0.45); }

        /* Document wrapper — ProposalDocument renders its own cover/letter/
           section pages inside this, so it just needs the page's top/bottom
           breathing room, not its own max-width (ProposalDocument sets that
           per-page already). */
        .public-doc-wrap { padding: 32px 24px 0; }

        .public-body {
          max-width: 820px;
          width: 100%;
          margin: 0 auto;
          padding: 0 24px 48px;
        }

        .public-section { margin-bottom: 0; }
        /* Heading styled to match <ProposalDocument>'s .doc-heading (NUVCL-98)
           so "Accept This Proposal" reads as another section of the document
           rather than a visually distinct widget. */
        .public-section-title {
          font-family: var(--font-comfortaa);
          font-size: 16px;
          font-weight: 700;
          color: var(--nv-text-heading);
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--nv-border-hair);
        }

        /* Signing — container styled to match <ProposalDocument>'s .doc-page
           (NUVCL-98): same white card, 680px width, 40/48 padding, 4px
           radius, and shadow-sm, so the signature box looks like the next
           page of the proposal instead of a separate bordered widget. */
        .public-sign-section {
          background: white;
          max-width: 680px;
          margin: 0 auto;
          padding: 40px 48px;
          border-radius: 4px;
          box-shadow: var(--nv-shadow-sm);
          font-family: var(--font-raleway);
        }
        @media (max-width: 600px) {
          .public-sign-section { padding: 28px 24px; }
        }

        .sign-fields {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
        }
        .sign-field { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .sign-label {
          font-size: 11px; font-weight: 700; color: var(--nv-text-muted);
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        @media (max-width: 600px) { .sign-fields { flex-direction: column; } }

        .signature-method { display: flex; gap: 8px; margin-bottom: 20px; }
        .signature-method__btn {
          padding: 7px 16px; border-radius: 20px; border: 2px solid var(--nv-border);
          background: white; color: var(--nv-text-body); font-size: 12px; font-weight: 600;
          font-family: var(--font-comfortaa); cursor: pointer;
        }
        .signature-method__btn--active { border-color: var(--nv-blue-slate); background: var(--nv-blue-slate); color: white; }

        .sign-capture { margin-bottom: 20px; }
        .sign-capture__label {
          display: block; font-size: 11px; font-weight: 700; color: var(--nv-text-muted);
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;
        }
        .sign-capture__script {
          font-family: var(--font-signature);
          font-size: 40px;
          line-height: 1.3;
          color: var(--nv-text-heading);
          padding: 6px 14px 10px;
          border-bottom: 1.5px solid var(--nv-border);
          max-width: 420px;
        }

        .approval-check {
          display: flex; align-items: flex-start; gap: 8px; font-size: 13px;
          color: var(--nv-text-muted); margin: 16px 0; cursor: pointer;
        }
        .approval-check input[type="checkbox"] { margin-top: 2px; cursor: pointer; }
        .approval-check a { color: var(--nv-blue-slate); text-decoration: underline; }

        .public-signed, .public-expired {
          text-align: center;
          padding: 20px;
        }
        .public-signed h3, .public-expired h3 {
          font-family: var(--font-comfortaa);
          font-size: 22px;
          font-weight: 700;
          color: var(--nv-text-heading);
          margin: 16px 0 8px;
        }
        .public-signed p, .public-expired p {
          color: var(--nv-text-muted);
          font-size: 14px;
          line-height: 1.6;
          max-width: 400px;
          margin: 0 auto;
        }

        /* Footer */
        .public-footer {
          background: var(--nv-surface-dark);
          padding: 24px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        @media (max-width: 600px) {
          .public-footer { padding: 20px 16px; flex-direction: column; gap: 8px; }
        }
        .public-footer span {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
        }
      `}</style>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:20, background:'var(--nv-surface-page)' }}>
      <NuvhoLogo variant="primary" height={40} />
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none"
        style={{ animation:'spin 0.8s linear infinite' }}>
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
        <circle cx="18" cy="18" r="15" stroke="var(--nv-platinum)" strokeWidth="3"/>
        <path d="M18 3a15 15 0 0 1 15 15" stroke="var(--nv-blue-slate)" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:16, background:'var(--nv-surface-page)', padding:24 }}>
      <NuvhoLogo variant="primary" height={40} />
      <h2 style={{ fontFamily:'var(--font-comfortaa)', color:'var(--nv-text-heading)', fontSize:22 }}>
        Proposal not found
      </h2>
      <p style={{ color:'var(--nv-text-muted)', fontSize:14, textAlign:'center', maxWidth:360 }}>
        {message}. Please check the link or contact your Nuvho representative.
      </p>
    </div>
  )
}
