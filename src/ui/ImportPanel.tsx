import { useState } from 'react'
import type { ValidationIssue } from '../domain/types'
import type { CandidateInfo, SurfaceSummary } from '../worker/protocol'
import { fmtMs, fmtNum } from './format'

export type ImportState =
  | { kind: 'idle' }
  | { kind: 'loading'; phase: string; fraction: number; names: string[] }
  | { kind: 'choices'; fileName: string; candidates: CandidateInfo[]; partial: boolean; issues: ValidationIssue[]; issueCounts: Record<string, number> }
  | { kind: 'error'; issues: ValidationIssue[]; needsPairConfirmation?: { dtm: string; str: string } }

type Props = {
  state: ImportState
  summary: SurfaceSummary | null
  unitConfirmed: boolean
  datum: string
  datumRL: boolean
  timing: { importMs: number | null; profileMs: number | null }
  onFiles: (files: File[], confirmPair?: boolean) => void
  onCancel: () => void
  onSelect: (layer: string, acceptPartial: boolean) => void
  onDismiss: () => void
  onConfirmUnits: (ok: boolean) => void
  onDatum: (s: string) => void
  onDatumRL: (b: boolean) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

const PHASE: Record<string, string> = { baca: 'Membaca berkas', urai: 'Mengurai DXF', indeks: 'Membangun indeks' }

function IssueList({ issues, counts }: { issues: ValidationIssue[]; counts?: Record<string, number> }) {
  if (!issues.length) return null
  return (
    <ul className="issues" data-testid="issue-list">
      {issues.slice(0, 30).map((i, k) => (
        <li key={k} className={`sev-${i.severity}`} data-code={i.code}>
          <b>{i.code}</b> {i.message}
          {i.location && (
            <small>
              {' '}
              ({[i.location.file, i.location.layer && `layer ${i.location.layer}`, i.location.line && `baris ${i.location.line}`, i.location.faceId && `muka ${i.location.faceId}`].filter(Boolean).join(', ')})
            </small>
          )}
        </li>
      ))}
      {counts && Object.entries(counts).some(([, n]) => n > 30) && <li>Daftar dipotong; jumlah per kode: {Object.entries(counts).map(([c, n]) => `${c}=${n}`).join(', ')}</li>}
    </ul>
  )
}

export function ImportPanel(p: Props) {
  const [layer, setLayer] = useState<string | null>(null)
  const [acceptPartial, setAcceptPartial] = useState(false)
  const s = p.state
  const sum = p.summary
  return (
    <section className="panel" aria-labelledby="h-surface">
      <h2 id="h-surface">Surface</h2>
      <input
        ref={p.fileInputRef}
        type="file"
        accept=".dxf,.dtm,.str,.DXF,.DTM,.STR"
        multiple
        data-testid="surface-input"
        className="visually-hidden"
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? [])
          e.currentTarget.value = ''
          if (files.length) p.onFiles(files)
        }}
      />
      <p className="muted">DXF ASCII (3DFACE/POLYFACE segitiga) atau pasangan .dtm + .str, maks. 25.000.000 byte per berkas.</p>

      {s.kind === 'loading' && (
        <div className="status" data-testid="import-progress">
          {PHASE[s.phase] ?? s.phase} {s.names.join(', ')} … {fmtNum(s.fraction * 100, 0)}%
          <progress max={1} value={s.fraction} />
          <button type="button" onClick={p.onCancel}>Batalkan impor</button>
        </div>
      )}

      {s.kind === 'choices' && (
        <div className="status" data-testid="import-choices">
          <p>
            <b>{s.fileName}</b>: {s.candidates.length > 1 ? 'pilih layer permukaan.' : 'periksa ringkasan masalah.'}
          </p>
          {s.candidates.map((c) => (
            <label key={c.id} className="row">
              <input type="radio" name="layer" checked={(layer ?? s.candidates[0]!.id) === c.id} onChange={() => setLayer(c.id)} />
              Layer <b>{c.layer}</b>: {fmtNum(c.triangles, 0)} segitiga{c.rejectedFaces ? `, ${fmtNum(c.rejectedFaces, 0)} muka ditolak` : ''}
              {c.verticalFaces ? `, ${fmtNum(c.verticalFaces, 0)} vertikal` : ''}
            </label>
          ))}
          <IssueList issues={s.issues} counts={s.issueCounts} />
          {s.partial && (
            <label className="row">
              <input type="checkbox" checked={acceptPartial} onChange={(e) => setAcceptPartial(e.currentTarget.checked)} data-testid="accept-partial" />
              Lanjutkan hanya dengan muka yang valid
            </label>
          )}
          <button
            type="button"
            data-testid="confirm-layer"
            disabled={s.partial && !acceptPartial && (s.candidates.find((c) => c.id === (layer ?? s.candidates[0]!.id))?.rejectedFaces ?? 0) > 0}
            onClick={() => p.onSelect(layer ?? s.candidates[0]!.id, acceptPartial)}
          >
            Pakai layer ini
          </button>
          <button type="button" onClick={p.onDismiss}>Batal</button>
        </div>
      )}

      {s.kind === 'error' && (
        <div className="status error" role="alert" data-testid="import-error">
          <p>Impor tidak diterapkan.{sum ? ' Surface aktif sebelumnya tetap dipakai.' : ''}</p>
          <IssueList issues={s.issues} />
          {s.needsPairConfirmation && (
            <p className="muted">Pilih ulang kedua berkas lalu konfirmasi pasangan {s.needsPairConfirmation.dtm} + {s.needsPairConfirmation.str}.</p>
          )}
          <button type="button" onClick={p.onDismiss}>Tutup</button>
        </div>
      )}

      {sum && (
        <div className="summary" data-testid="surface-summary">
          <dl>
            <dt>Berkas</dt><dd>{sum.fileName} ({fmtNum(sum.bytes, 0)} byte{sum.version ? `, ${sum.version}` : ''})</dd>
            <dt>Layer</dt><dd data-testid="summary-layer">{sum.layer}</dd>
            <dt>Segitiga</dt><dd data-testid="summary-triangles">{fmtNum(sum.triangleCount, 0)}</dd>
            <dt>E</dt><dd>{fmtNum(sum.bounds.min.e)} – {fmtNum(sum.bounds.max.e)}</dd>
            <dt>N</dt><dd>{fmtNum(sum.bounds.min.n)} – {fmtNum(sum.bounds.max.n)}</dd>
            <dt>Z</dt><dd>{fmtNum(sum.bounds.min.z)} – {fmtNum(sum.bounds.max.z)}</dd>
            <dt>Unit</dt>
            <dd data-testid="summary-units">
              {sum.units.kind === 'meters' ? 'meter' : sum.units.kind === 'unitless' ? 'tanpa unit' : sum.units.label} <small>({sum.units.source})</small>
              {p.unitConfirmed ? ' · dikonfirmasi meter' : ''}
            </dd>
            <dt>Masalah</dt>
            <dd data-testid="summary-issues">
              {sum.rejectedFaces} muka ditolak, {sum.excludedFromProfile} dikeluarkan dari profil, {sum.issues.length} catatan
            </dd>
          </dl>
          {!p.unitConfirmed && (
            <div className="status warn" data-testid="unit-confirm">
              {sum.units.kind === 'other' ? (
                <p>Unit DXF bukan meter. Aplikasi menghitung dalam meter; nilai tidak dikonversi. Gunakan data meter atau konfirmasi bahwa angka sudah dalam meter.</p>
              ) : (
                <p>DXF tidak menyatakan unit. Konfirmasi bahwa E, N, dan Z dalam meter pada datum yang sama.</p>
              )}
              <button type="button" data-testid="confirm-meters" onClick={() => p.onConfirmUnits(true)}>Ya, koordinat dalam meter</button>
            </div>
          )}
          {sum.issues.length > 0 && (
            <details>
              <summary>Catatan impor ({sum.issues.length})</summary>
              <IssueList issues={sum.issues} counts={sum.issueCounts} />
            </details>
          )}
          {(p.timing.importMs !== null || p.timing.profileMs !== null) && (
            <p className="muted" data-testid="timing" data-import-ms={p.timing.importMs ?? ''} data-profile-ms={p.timing.profileMs ?? ''}>
              {p.timing.importMs !== null && <>Impor sampai frame pertama: {fmtMs(p.timing.importMs)}. </>}
              {p.timing.profileMs !== null && <>Pembaruan profil terakhir: {fmtMs(p.timing.profileMs)}.</>}
            </p>
          )}
        </div>
      )}
      <label className="field">
        Grid / datum (diisi pengguna)
        <input type="text" value={p.datum} placeholder="mis. UTM 50S, datum lokal RL" onChange={(e) => p.onDatum(e.currentTarget.value)} data-testid="datum-input" />
      </label>
      <label className="row">
        <input type="checkbox" checked={p.datumRL} onChange={(e) => p.onDatumRL(e.currentTarget.checked)} /> Elevasi pada datum RL (tampilkan mRL)
      </label>
    </section>
  )
}
