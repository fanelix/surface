import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Borehole, NamedPoint, Profile, Section } from '../domain/types'
import type { Corridor } from '../domain/section-objects'
import { projectObjects } from '../domain/section-objects'
import { reverseSection, validateSection } from '../geometry/section'
import { GeometryClient } from '../worker/client'
import type { Transport } from '../worker/client'
import type { RenderBuffers, SurfaceSummary } from '../worker/protocol'
import { ImportPanel } from './ImportPanel'
import type { ImportState } from './ImportPanel'
import { ObjectPanel } from './ObjectPanel'
import { ObjectTable } from './ObjectTable'
import { SectionControls } from './SectionControls'
import { SectionView } from './SectionView'
import type { ScaleMode } from './SectionView'
import { TerrainView } from './TerrainView'
import type { InteractionMode, ViewMode } from './TerrainView'
import type { ObjectKind } from '../import/objects'

type Surface = { summary: SurfaceSummary; render: RenderBuffers; version: number }

const sameSection = (p: Section, q: Section) => p.a.e === q.a.e && p.a.n === q.a.n && p.b.e === q.b.e && p.b.n === q.b.n

function createTransport(): Transport | null {
  if (typeof Worker === 'undefined') return null
  return new Worker(new URL('../worker/geometry.worker.ts', import.meta.url), { type: 'module' }) as unknown as Transport
}

export function App() {
  const [surface, setSurface] = useState<Surface | null>(null)
  const [importState, setImportState] = useState<ImportState>({ kind: 'idle' })
  const [unitConfirmed, setUnitConfirmed] = useState(false)
  const [datum, setDatum] = useState('')
  const [datumRL, setDatumRL] = useState(false)
  const [points, setPoints] = useState<NamedPoint[]>([])
  const [holes, setHoles] = useState<Borehole[]>([])
  const [rejectedCount, setRejectedCount] = useState(0)
  const [section, setSection] = useState<Section | null>(null)
  const [draft, setDraft] = useState<Section | null>(null)
  const [profile, setProfile] = useState<{ profile: Profile; section: Section; version: number } | null>(null)
  const [sectionError, setSectionError] = useState<string | null>(null)
  const [corridor, setCorridor] = useState<Corridor>({ enabled: false, halfWidth: 5 })
  const [scaleMode, setScaleMode] = useState<ScaleMode>('equal')
  const [extentMode, setExtentMode] = useState<'all' | 'ab'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<InteractionMode>('navigate')
  const [viewMode, setViewMode] = useState<ViewMode>('top')
  const [fitToken, setFitToken] = useState(0)
  const [formKind, setFormKind] = useState<ObjectKind | null>(null)
  const [webgl, setWebgl] = useState<{ ok: boolean; message?: string }>({ ok: true })
  const [replaceFiles, setReplaceFiles] = useState<File[] | null>(null)
  const [timing, setTiming] = useState<{ importMs: number | null; profileMs: number | null }>({ importMs: null, profileMs: null })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const clientRef = useRef<GeometryClient | null>(null)
  const lastFiles = useRef<File[]>([])
  const importStart = useRef<number | null>(null)
  const releaseAt = useRef<number | null>(null)

  // ---------- worker ----------
  useEffect(() => {
    const t = createTransport()
    if (!t) return
    clientRef.current = new GeometryClient(t, {
      onImport: (m) => {
        if (m.type === 'progress') setImportState({ kind: 'loading', phase: m.phase, fraction: m.fraction, names: lastFiles.current.map((f) => f.name) })
        else if (m.type === 'choices') {
          importStart.current = null
          setImportState({ kind: 'choices', fileName: m.fileName, candidates: m.candidates, partial: m.partial, issues: m.issues, issueCounts: m.issueCounts })
        } else if (m.type === 'surfaceReady') {
          setSurface({ summary: m.summary, render: m.render, version: m.surfaceVersion })
          setUnitConfirmed(m.summary.units.kind === 'meters')
          setProfile(null)
          setImportState({ kind: 'idle' })
          setFitToken((x) => x + 1)
        } else if (m.type === 'error') {
          importStart.current = null
          setImportState(m.cancelled ? { kind: 'idle' } : { kind: 'error', issues: m.issues, ...(m.needsPairConfirmation ? { needsPairConfirmation: m.needsPairConfirmation } : {}) })
        }
      },
      onSection: (m) => {
        setProfile({ profile: m.profile, section: m.section, version: m.surfaceVersion })
        setSectionError(null)
      },
      onSectionError: (m) => setSectionError(m.issues[0]?.message ?? 'Penampang gagal dihitung.'),
    })
    return () => {
      t.terminate?.()
      clientRef.current = null
    }
  }, [])

  // Waktu impor: dari pemilihan berkas (atau konfirmasi layer) sampai frame pertama.
  useEffect(() => {
    if (!surface || importStart.current === null) return
    const t0 = importStart.current
    importStart.current = null
    requestAnimationFrame(() => requestAnimationFrame(() => setTiming((t) => ({ ...t, importMs: performance.now() - t0 }))))
  }, [surface])

  const startImport = useCallback((files: File[], confirmPair = false) => {
    lastFiles.current = files
    importStart.current = performance.now()
    setImportState({ kind: 'loading', phase: 'baca', fraction: 0, names: files.map((f) => f.name) })
    clientRef.current?.loadSurface(files, confirmPair)
  }, [])

  const onFiles = (files: File[], confirmPair = false) => {
    if (surface && (points.length || holes.length)) {
      setReplaceFiles(files)
      return
    }
    startImport(files, confirmPair)
  }

  // ---------- penampang ----------
  const active = draft ?? section
  const activeValid = active && !validateSection(active) ? active : null
  const canCompute = !!surface && unitConfirmed
  useEffect(() => {
    if (activeValid && canCompute) clientRef.current?.requestSection(activeValid)
  }, [activeValid, canCompute, surface?.version])

  useEffect(() => {
    if (!profile || releaseAt.current === null || draft) return
    const t0 = releaseAt.current
    releaseAt.current = null
    requestAnimationFrame(() => setTiming((t) => ({ ...t, profileMs: performance.now() - t0 })))
  }, [profile, draft])

  const objects = useMemo(() => (activeValid ? projectObjects(points, holes, activeValid, corridor) : null), [points, holes, activeValid, corridor])
  const shownProfile = canCompute && profile && profile.version === surface?.version ? profile.profile : null

  const commit = useCallback((s: Section) => {
    const issue = validateSection(s)
    setDraft(null)
    if (issue) {
      setSectionError(issue.message)
      return
    }
    releaseAt.current = performance.now()
    setSection(s)
    setSectionError(null)
    setMode('edit')
  }, [])

  const cancelTemp = useCallback(() => {
    setDraft(null)
    setMode((m) => (m === 'draw' ? 'navigate' : m))
  }, [])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelTemp()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [cancelTemp])

  const hasObjects = points.length + holes.length > 0
  const canDraw = surface
    ? unitConfirmed
      ? { ok: true }
      : { ok: false, reason: 'Konfirmasi bahwa koordinat surface dalam meter terlebih dahulu.' }
    : hasObjects
      ? { ok: true }
      : { ok: false, reason: 'Buka surface atau tambahkan titik/bor terlebih dahulu.' }

  const onWebglStatus = useCallback((ok: boolean, message?: string) => setWebgl(message ? { ok, message } : { ok }), [])

  const removeObject = (id: string) => {
    setPoints((x) => x.filter((p) => p.id !== id))
    setHoles((x) => x.filter((h) => h.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const actions = [
    { id: 'open-surface', label: 'Buka surface', state: { ok: true } as { ok: boolean; reason?: string }, run: () => fileInputRef.current?.click() },
    { id: 'add-point', label: 'Tambah titik', state: { ok: true }, run: () => setFormKind('point') },
    { id: 'add-borehole', label: 'Tambah bor', state: { ok: true }, run: () => setFormKind('borehole') },
    {
      id: 'make-section',
      label: 'Buat penampang',
      state: canDraw,
      run: () => {
        setViewMode('top')
        setMode('draw')
      },
    },
  ]

  return (
    <div className="app">
      <header className="toolbar">
        <h1>Topografi &amp; Penampang</h1>
        {actions.map((a) => (
          <span key={a.id} className="action">
            <button type="button" data-testid={a.id} disabled={!a.state.ok} title={a.state.reason} onClick={a.run}>
              {a.label}
            </button>
            {!a.state.ok && a.state.reason && <small className="hint">{a.state.reason}</small>}
          </span>
        ))}
        <span className="spacer" />
        {datum && <span className="datum-badge" data-testid="datum-badge">Grid/datum: {datum}</span>}
        <span className="privacy" title="Isi berkas, nama objek, dan koordinat tidak dikirim ke server.">Pemrosesan lokal</span>
      </header>
      {!webgl.ok && webgl.message && (
        <div className="banner warn" role="status" data-testid="webgl-warning">{webgl.message}</div>
      )}
      {replaceFiles && (
        <div className="banner warn" role="dialog" aria-label="Konfirmasi ganti surface" data-testid="replace-confirm">
          Mengganti surface aktif. {points.length + holes.length} objek dipertahankan — pastikan grid/datum surface baru sama
          {datum ? ` (${datum})` : ''}. Profil akan dihitung ulang.
          <button type="button" data-testid="replace-ok" onClick={() => { const f = replaceFiles; setReplaceFiles(null); startImport(f) }}>Lanjutkan, grid/datum sama</button>
          <button type="button" onClick={() => setReplaceFiles(null)}>Batal</button>
        </div>
      )}
      <div className="layout">
        <aside className="sidebar" aria-label="Data">
          <ImportPanel
            state={importState}
            summary={surface?.summary ?? null}
            unitConfirmed={unitConfirmed}
            datum={datum}
            datumRL={datumRL}
            timing={timing}
            onFiles={onFiles}
            onCancel={() => clientRef.current?.cancelImport()}
            onSelect={(layer, acceptPartial) => {
              importStart.current = performance.now()
              clientRef.current?.selectSurface(layer, acceptPartial)
            }}
            onDismiss={() => setImportState({ kind: 'idle' })}
            onConfirmUnits={setUnitConfirmed}
            onDatum={setDatum}
            onDatumRL={setDatumRL}
            fileInputRef={fileInputRef}
          />
          {importState.kind === 'error' && importState.needsPairConfirmation && (
            <button type="button" className="pad" onClick={() => startImport(lastFiles.current, true)}>Konfirmasi pasangan DTM/STR</button>
          )}
          <ObjectPanel
            points={points}
            holes={holes}
            formKind={formKind}
            onFormKind={setFormKind}
            onAddPoints={(p, rej) => {
              setPoints((x) => [...x, ...p])
              setRejectedCount((r) => r + rej)
              setFitToken((x) => x + 1)
            }}
            onAddHoles={(h, rej) => {
              setHoles((x) => [...x, ...h])
              setRejectedCount((r) => r + rej)
              setFitToken((x) => x + 1)
            }}
            onRemove={removeObject}
          />
        </aside>
        <main className="main">
          <SectionControls
            section={section}
            draft={draft}
            mode={mode}
            viewMode={viewMode}
            corridor={corridor}
            scaleMode={scaleMode}
            extentMode={extentMode}
            onMode={(m) => {
              setMode(m)
              if (m !== 'navigate') setViewMode('top')
            }}
            onViewMode={(v) => {
              setViewMode(v)
              if (v === 'orbit') setMode('navigate')
            }}
            onApply={commit}
            onReverse={() => section && commit(reverseSection(section))}
            onCancel={cancelTemp}
            onFit={() => setFitToken((x) => x + 1)}
            onCorridor={setCorridor}
            onScaleMode={setScaleMode}
            onExtentMode={setExtentMode}
            canDraw={canDraw}
          />
          {sectionError && <p className="sev-error pad" role="alert" data-testid="section-error">{sectionError}</p>}
          <div className="views">
            <section className="panel view-panel" aria-labelledby="h-topo">
              <h2 id="h-topo">Topografi {viewMode === 'top' ? '· tampak atas (U ke atas, T ke kanan)' : '· 3D'}{mode === 'draw' ? ' · klik A lalu B, atau tarik A→B' : mode === 'edit' ? ' · seret pegangan A/B' : ''}</h2>
              <TerrainView
                render={surface?.render ?? null}
                bounds={surface?.summary.bounds ?? null}
                points={points}
                holes={holes}
                section={section}
                mode={mode}
                viewMode={viewMode}
                selectedId={selectedId}
                fitToken={fitToken}
                wireframe={(surface?.summary.triangleCount ?? 0) <= 50_000}
                onSelect={setSelectedId}
                onDraft={setDraft}
                onCommit={commit}
                onWebglStatus={onWebglStatus}
              />
            </section>
            <section className="panel view-panel" aria-labelledby="h-section">
              <h2 id="h-section">Penampang 2D</h2>
              <SectionView
                L={objects?.L ?? (activeValid ? Math.hypot(activeValid.b.e - activeValid.a.e, activeValid.b.n - activeValid.a.n) : null)}
                profile={shownProfile}
                objects={objects}
                selectedId={selectedId}
                onSelect={setSelectedId}
                datumRL={datumRL}
                scaleMode={scaleMode}
                extentMode={extentMode}
                busy={!!activeValid && canCompute && (!profile || !sameSection(profile.section, activeValid))}
                hasSurface={!!surface}
              />
            </section>
          </div>
          <section className="panel table-panel" aria-label="Tabel objek">
            <ObjectTable objects={objects} selectedId={selectedId} onSelect={setSelectedId} rejectedCount={rejectedCount} onRemove={removeObject} />
          </section>
        </main>
      </div>
    </div>
  )
}
