'use client'

// Plain padding wrapper for the Settings section. Navigation between
// Region Settings / User Settings now lives in the left sidebar
// (components/layout/AppShell.tsx), not as in-page tabs.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="settings-page">
      {children}

      <style jsx>{`
        .settings-page {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          min-height: 100vh;
          padding: 40px 24px;
          width: 100%;
        }
      `}</style>
    </div>
  )
}
