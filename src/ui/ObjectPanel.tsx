import { useState } from 'react'
import type { Borehole, NamedPoint } from '../domain/types'
import type { CsvImportPreview, DipConvention, Field, ObjectKind } from '../import/objects'
import { FIELDS, FIELD_LABEL, nameKey, previewCsv, validateBorehole, validatePoint } from '../import/objects'

type Props = {
  points: NamedPoint[]
  holes: Borehole[]
  formKind: ObjectKind | null
  onFormKind: (k: ObjectKind | null) => void
  onAddPoints: (p: NamedPoint[], rejected: number) => void
  onAddHoles: (h: Borehole[], rejected: number) => void
  onRemove: (id: string) => void
}

type AnyPreview = CsvImportPreview<NamedPoint> | CsvImportPreview<Borehole>

const DIP_LABEL: Record<DipConvention, string> = {
  'negative-down': 'Negatif ke bawah (−90° = vertikal ke bawah)',
  'positive-down': 'Positif ke bawah (dibalik sekali saat impor)',
}

function existingKeys(list: { name: string }[]) {
  return new Set(list.map((x) => nameKey(x.name)))
}

function Form({ kind, p }: { kind: ObjectKind; p: Props }) {
  const [vals, setVals] = useState<Partial<Record<Field, string>>>({})
  const [dip, setDip] = useState<DipConvention>('negative-down')
  const [msg, setMsg] = useState<string[]>([])
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const fmt = { decimalComma: true }
    if (kind === 'point') {
      const r = validatePoint(vals, fmt)
      if (!r.ok) return setMsg(r.reasons)
      if (existingKeys(p.points).has(nameKey(r.value.name))) return setMsg([`Nama "${r.value.name}" sudah ada di sesi`])
      p.onAddPoints([r.value], 0)
    } else {
      const r = validateBorehole(vals, fmt, dip)
      if (!r.ok) return setMsg(r.reasons)
      if (existingKeys(p.holes).has(nameKey(r.value.name))) return setMsg([`Nama "${r.value.name}" sudah ada di sesi`])
      p.onAddHoles([r.value], 0)
    }
    setMsg([])
    setVals({})
  }
  return (
    <form className="obj-form" onSubmit={submit} data-testid={`form-${kind}`}>
      <h3>{kind === 'point' ? 'Tambah titik' : 'Tambah bor'}</h3>
      <div className="grid2">
        {FIELDS[kind].map((f) => (
          <label key={f} className="field">
            {f === 'name' ? (kind === 'point' ? 'Nama Titik' : 'Nama Titik Bor') : f === 'elevation' && kind === 'borehole' ? 'Elevation collar' : FIELD_LABEL[f]}
            <input
              name={f}
              data-testid={`${kind}-${f}`}
              value={vals[f] ?? ''}
              inputMode={f === 'name' ? 'text' : 'decimal'}
              onChange={(e) => {
                const v = e.currentTarget.value
                setVals((x) => ({ ...x, [f]: v }))
              }}
            />
          </label>
        ))}
      </div>
      {kind === 'borehole' && (
        <label className="field">
          Konvensi dip
          <select value={dip} onChange={(e) => setDip(e.currentTarget.value as DipConvention)}>
            {Object.entries(DIP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      )}
      {msg.length > 0 && (
        <ul className="issues" role="alert">{msg.map((m) => <li key={m} className="sev-error">{m}</li>)}</ul>
      )}
      <button type="submit" data-testid={`submit-${kind}`}>Simpan</button>
      <button type="button" onClick={() => p.onFormKind(null)}>Tutup</button>
    </form>
  )
}

function CsvImport({ p }: { p: Props }) {
  const [kind, setKind] = useState<ObjectKind>('point')
  const [text, setText] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [dip, setDip] = useState<DipConvention>('negative-down')
  const [mapping, setMapping] = useState<Record<string, number | null> | null>(null)

  const preview: AnyPreview | null =
    text === null
      ? null
      : kind === 'point'
        ? previewCsv(text, 'point', existingKeys(p.points), { dip, ...(mapping ? { mapping } : {}) })
        : previewCsv(text, 'borehole', existingKeys(p.holes), { dip, ...(mapping ? { mapping } : {}) })

  const reset = () => {
    setText(null)
    setMapping(null)
    setFileName('')
  }
  const apply = () => {
    if (!preview || preview.fatal) return
    const rejected = preview.rows.filter((r) => r.status === 'rejected').length
    if (preview.kind === 'point') p.onAddPoints(preview.accepted as NamedPoint[], rejected)
    else p.onAddHoles(preview.accepted as Borehole[], rejected)
    reset()
  }
  return (
    <div className="csv-import">
      <h3>Impor CSV</h3>
      <div className="row">
        <label><input type="radio" checked={kind === 'point'} onChange={() => { setKind('point'); setMapping(null) }} /> Titik</label>
        <label><input type="radio" checked={kind === 'borehole'} onChange={() => { setKind('borehole'); setMapping(null) }} data-testid="csv-kind-borehole" /> Bor</label>
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          data-testid="csv-input"
          onChange={async (e) => {
            const f = e.currentTarget.files?.[0]
            e.currentTarget.value = ''
            if (!f) return
            setFileName(f.name)
            setMapping(null)
            setText(await f.text())
          }}
        />
      </div>
      {kind === 'borehole' && (
        <label className="field">
          Konvensi dip sumber
          <select value={dip} onChange={(e) => setDip(e.currentTarget.value as DipConvention)} data-testid="csv-dip">
            {Object.entries(DIP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      )}
      {preview && (
        <div className="csv-preview" data-testid="csv-preview">
          <p className="muted">
            {fileName}: pemisah kolom <b>{preview.delimiter === ';' ? 'titik koma' : 'koma'}</b>, desimal{' '}
            <b>{preview.decimalComma ? 'koma atau titik' : 'titik'}</b>
            {preview.bom ? ', UTF-8 BOM' : ''}
            {preview.kind === 'borehole' ? `, dip: ${DIP_LABEL[preview.dip]}` : ''}
          </p>
          <div className="mapping">
            {FIELDS[kind].map((f) => (
              <label key={f}>
                {FIELD_LABEL[f]}{' '}
                <select
                  value={preview.mapping[f] ?? ''}
                  onChange={(e) => {
                    const v = e.currentTarget.value
                    setMapping({ ...preview.mapping, [f]: v === '' ? null : Number(v) })
                  }}
                >
                  <option value="">—</option>
                  {preview.header.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          {preview.fatal ? (
            <p className="sev-error" role="alert">{preview.fatal.message}</p>
          ) : (
            <>
              <p data-testid="csv-summary">
                Diterima <b>{preview.accepted.length}</b>, ditolak <b>{preview.rows.length - preview.accepted.length}</b>
              </p>
              <div className="table-scroll small">
                <table>
                  <thead>
                    <tr><th>Baris</th><th>Status</th>{preview.header.map((h, i) => <th key={i}>{h}</th>)}<th>Alasan</th></tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.line} className={r.status} data-testid={`csv-row-${r.line}`}>
                        <td>{r.line}</td>
                        <td>{r.status === 'accepted' ? 'diterima' : 'ditolak'}</td>
                        {preview.header.map((_, i) => <td key={i}>{r.cells[i] ?? ''}</td>)}
                        <td>{r.reasons.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <button type="button" data-testid="csv-apply" disabled={!!preview.fatal || preview.accepted.length === 0} onClick={apply}>
            Terapkan {preview.accepted.length} baris valid
          </button>
          <button type="button" data-testid="csv-cancel" onClick={reset}>Batal</button>
        </div>
      )}
    </div>
  )
}

export function ObjectPanel(p: Props) {
  return (
    <section className="panel" aria-labelledby="h-objects">
      <h2 id="h-objects">Titik &amp; bor</h2>
      <p className="muted" data-testid="object-counts">
        {p.points.length} titik, {p.holes.length} bor di sesi
      </p>
      {p.formKind && <Form key={p.formKind} kind={p.formKind} p={p} />}
      <CsvImport p={p} />
    </section>
  )
}
