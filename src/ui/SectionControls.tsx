import { useEffect, useState } from 'react'
import type { Section } from '../domain/types'
import type { Corridor } from '../domain/section-objects'
import { parseNumber } from '../import/objects'
import { validateSection } from '../geometry/section'
import { azimuthDeg, fmtM, fmtNum } from './format'
import type { InteractionMode, ViewMode } from './TerrainView'
import type { ScaleMode } from './SectionView'

type Props = {
  section: Section | null
  draft: Section | null
  mode: InteractionMode
  viewMode: ViewMode
  corridor: Corridor
  scaleMode: ScaleMode
  extentMode: 'all' | 'ab'
  onMode: (m: InteractionMode) => void
  onViewMode: (v: ViewMode) => void
  onApply: (s: Section) => void
  onReverse: () => void
  onCancel: () => void
  onFit: () => void
  onCorridor: (c: Corridor) => void
  onScaleMode: (s: ScaleMode) => void
  onExtentMode: (m: 'all' | 'ab') => void
  canDraw: { ok: boolean; reason?: string }
}

type Txt = { ae: string; an: string; be: string; bn: string }
const toTxt = (s: Section | null): Txt =>
  s ? { ae: String(s.a.e), an: String(s.a.n), be: String(s.b.e), bn: String(s.b.n) } : { ae: '', an: '', be: '', bn: '' }

export function SectionControls(p: Props) {
  const shown = p.draft ?? p.section
  const [txt, setTxt] = useState<Txt>(toTxt(shown))
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    setTxt(toTxt(shown))
  }, [shown])

  const apply = () => {
    const f = { decimalComma: true }
    const v = [txt.ae, txt.an, txt.be, txt.bn].map((x) => parseNumber(x, f))
    if (v.some((x) => !x.ok)) return setErr('Isi E dan N untuk A dan B berupa angka.')
    const [ae, an, be, bn] = v.map((x) => (x.ok ? x.value : NaN)) as [number, number, number, number]
    const s: Section = { a: { e: ae, n: an }, b: { e: be, n: bn } }
    const issue = validateSection(s)
    if (issue) return setErr(issue.message)
    setErr(null)
    p.onApply(s)
  }

  const L = shown ? Math.hypot(shown.b.e - shown.a.e, shown.b.n - shown.a.n) : null
  const az = shown ? azimuthDeg(shown.b.e - shown.a.e, shown.b.n - shown.a.n) : null

  return (
    <div className="section-controls">
      <div className="row wrap">
        <span className="seg" role="group" aria-label="Tampilan">
          <button type="button" aria-pressed={p.viewMode === 'top'} onClick={() => p.onViewMode('top')} data-testid="view-top">Tampak atas</button>
          <button type="button" aria-pressed={p.viewMode === 'orbit'} onClick={() => p.onViewMode('orbit')} data-testid="view-orbit">3D orbit</button>
        </span>
        <span className="seg" role="group" aria-label="Mode">
          <button type="button" aria-pressed={p.mode === 'navigate'} onClick={() => p.onMode('navigate')} data-testid="mode-navigate">Navigasi</button>
          <button type="button" aria-pressed={p.mode === 'draw'} disabled={!p.canDraw.ok} title={p.canDraw.reason} onClick={() => p.onMode('draw')} data-testid="mode-draw">Gambar A–B</button>
          <button type="button" aria-pressed={p.mode === 'edit'} disabled={!p.section} title={p.section ? undefined : 'Buat garis A–B terlebih dahulu.'} onClick={() => p.onMode('edit')} data-testid="mode-edit">Geser A/B</button>
        </span>
        <button type="button" onClick={p.onReverse} disabled={!p.section} data-testid="reverse-ab">Balik A/B</button>
        <button type="button" onClick={p.onCancel} data-testid="cancel-ab" title="Batalkan perubahan sementara (Esc)">Batal</button>
        <button type="button" onClick={p.onFit} data-testid="fit">Fit</button>
      </div>
      <div className="row wrap ab-inputs">
        <b className="a-label">A</b>
        <label>E <input data-testid="a-e" value={txt.ae} onChange={(e) => setTxt({ ...txt, ae: e.currentTarget.value })} size={11} /></label>
        <label>N <input data-testid="a-n" value={txt.an} onChange={(e) => setTxt({ ...txt, an: e.currentTarget.value })} size={11} /></label>
        <b className="b-label">B</b>
        <label>E <input data-testid="b-e" value={txt.be} onChange={(e) => setTxt({ ...txt, be: e.currentTarget.value })} size={11} /></label>
        <label>N <input data-testid="b-n" value={txt.bn} onChange={(e) => setTxt({ ...txt, bn: e.currentTarget.value })} size={11} /></label>
        <button type="button" onClick={apply} data-testid="apply-ab">Terapkan E/N</button>
        {L !== null && az !== null && (
          <span className="muted" data-testid="ab-info" data-length={L} data-azimuth={az}>
            Panjang {fmtM(L)} · arah A→B {fmtNum(az, 1)}°
          </span>
        )}
      </div>
      {err && <p className="sev-error" role="alert" data-testid="ab-error">{err}</p>}
      <div className="row wrap">
        <label>
          <input type="checkbox" checked={p.corridor.enabled} onChange={(e) => p.onCorridor({ ...p.corridor, enabled: e.currentTarget.checked })} data-testid="corridor-enabled" /> Filter koridor ±
        </label>
        <input
          type="number"
          min={0}
          step="any"
          value={p.corridor.halfWidth}
          onChange={(e) => {
            const w = Number(e.currentTarget.value)
            if (Number.isFinite(w) && w >= 0) p.onCorridor({ ...p.corridor, halfWidth: w })
          }}
          style={{ width: 70 }}
          data-testid="corridor-width"
        />
        m
        <label>
          Skala{' '}
          <select value={String(p.scaleMode)} onChange={(e) => {
            const v = e.currentTarget.value
            p.onScaleMode(v === 'equal' || v === 'fit' ? v : (Number(v) as 2 | 5 | 10))
          }} data-testid="scale-mode">
            <option value="equal">H = V (1:1)</option>
            <option value="fit">Pas layar (VE dihitung)</option>
            <option value="2">VE ×2</option>
            <option value="5">VE ×5</option>
            <option value="10">VE ×10</option>
          </select>
        </label>
        <span className="seg">
          <button type="button" aria-pressed={p.extentMode === 'all'} onClick={() => p.onExtentMode('all')} data-testid="fit-all">Fit semua objek</button>
          <button type="button" aria-pressed={p.extentMode === 'ab'} onClick={() => p.onExtentMode('ab')}>Hanya A–B</button>
        </span>
      </div>
    </div>
  )
}
