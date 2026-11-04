import { useState } from 'react'

type ActionState = { enabled: boolean; reason?: string }

export function App() {
  const [hasSurface] = useState(false)
  const actions: { id: string; label: string; state: ActionState }[] = [
    { id: 'open-surface', label: 'Buka surface', state: { enabled: true } },
    { id: 'add-point', label: 'Tambah titik', state: { enabled: true } },
    { id: 'add-borehole', label: 'Tambah bor', state: { enabled: true } },
    {
      id: 'make-section',
      label: 'Buat penampang',
      state: hasSurface
        ? { enabled: true }
        : { enabled: false, reason: 'Buka surface terlebih dahulu untuk menggambar garis A–B.' },
    },
  ]
  return (
    <div className="app">
      <header className="toolbar">
        <h1>Topografi &amp; Penampang</h1>
        {actions.map((a) => (
          <span key={a.id} className="action">
            <button type="button" data-testid={a.id} disabled={!a.state.enabled} title={a.state.reason}>
              {a.label}
            </button>
            {!a.state.enabled && a.state.reason && <small className="hint">{a.state.reason}</small>}
          </span>
        ))}
      </header>
    </div>
  )
}
