import { useEffect, useRef } from 'react'
import type { ObjectRow, SectionObjects } from '../domain/section-objects'
import { fmtNum, fmtOffset } from './format'

type Props = {
  objects: SectionObjects | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  rejectedCount: number
  onRemove: (id: string) => void
}

function hitText(r: ObjectRow): string {
  if (r.kind === 'point') return r.onAB ? 'dalam A–B' : 'di perpanjangan'
  const h = r.hit
  switch (h.kind) {
    case 'cross':
      return `memotong ${h.onAB ? 'dalam A–B' : 'di perpanjangan'} · MD ${fmtNum(h.md)} · s ${fmtNum(h.s)} · Z ${fmtNum(h.z)}`
    case 'touch':
      return `menyentuh di ${h.md === 0 ? 'collar' : 'toe'} ${h.onAB ? '(dalam A–B)' : '(perpanjangan)'} · s ${fmtNum(h.s)} · Z ${fmtNum(h.z)}`
    case 'in-plane':
      return `seluruh bor pada bidang ${h.abCoverage === 'inside' ? '(dalam A–B)' : h.abCoverage === 'partial' ? '(sebagian di perpanjangan)' : '(di perpanjangan)'}`
    default:
      return 'tidak memotong bidang'
  }
}

export function ObjectTable({ objects, selectedId, onSelect, rejectedCount, onRemove }: Props) {
  const selRef = useRef<HTMLTableRowElement>(null)
  useEffect(() => {
    selRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])
  if (!objects) {
    return <p className="muted pad">Tabel proyeksi muncul setelah garis A–B dibuat.</p>
  }
  return (
    <div className="object-table">
      <p className="counter" data-testid="object-counter">
        Ditampilkan <b data-testid="count-shown">{objects.shownCount}</b> · valid <b data-testid="count-valid">{objects.validCount}</b> · ditolak saat impor{' '}
        <b data-testid="count-rejected">{rejectedCount}</b>
      </p>
      <div className="table-scroll">
        <table data-testid="object-table">
          <thead>
            <tr>
              <th>Jenis</th><th>Nama</th><th>s (m)</th><th>Z (m)</th><th>Offset</th>
              <th>s toe</th><th>Z toe</th><th>Offset toe</th><th>MD</th><th>Status</th><th />
            </tr>
          </thead>
          <tbody>
            {objects.rows.filter((r) => r.visible).map((r) => {
              const sel = r.id === selectedId
              const common = {
                ref: sel ? selRef : undefined,
                className: sel ? 'selected' : undefined,
                'aria-selected': sel,
                'data-testid': `row-${r.name}`,
                'data-id': r.id,
                onClick: () => onSelect(sel ? null : r.id),
              }
              if (r.kind === 'point') {
                return (
                  <tr key={r.id} {...common}>
                    <td>Titik</td><td>{r.name}</td>
                    <td data-col="s">{fmtNum(r.p.s)}</td><td data-col="z">{fmtNum(r.p.z)}</td>
                    <td data-col="o" data-value={r.p.o}>{fmtOffset(r.p.o)}</td>
                    <td /><td /><td /><td />
                    <td>{hitText(r)}</td>
                    <td><button type="button" title="Hapus dari sesi" onClick={(e) => { e.stopPropagation(); onRemove(r.id) }}>×</button></td>
                  </tr>
                )
              }
              return (
                <tr key={r.id} {...common}>
                  <td>Bor</td><td>{r.name}{r.coincident ? ' (proyeksi berimpit)' : ''}</td>
                  <td data-col="s">{fmtNum(r.collar.s)}</td><td data-col="z">{fmtNum(r.collar.z)}</td>
                  <td data-col="o" data-value={r.collar.o}>{fmtOffset(r.collar.o)}</td>
                  <td data-col="s-toe">{fmtNum(r.toe.s)}</td><td data-col="z-toe">{fmtNum(r.toe.z)}</td>
                  <td data-col="o-toe" data-value={r.toe.o}>{fmtOffset(r.toe.o)}</td>
                  <td data-col="md">{fmtNum(r.md)}</td>
                  <td data-col="hit">{hitText(r)}</td>
                  <td><button type="button" title="Hapus dari sesi" onClick={(e) => { e.stopPropagation(); onRemove(r.id) }}>×</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
