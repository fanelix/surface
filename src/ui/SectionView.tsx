import { useEffect, useMemo, useState } from 'react'
import type { Profile } from '../domain/types'
import type { ObjectRow, SectionObjects } from '../domain/section-objects'
import { fmtM, fmtNum, fmtOffset, ticks } from './format'

export type ScaleMode = 'equal' | 'fit' | 2 | 5 | 10

type Props = {
  L: number | null
  profile: Profile | null
  objects: SectionObjects | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  datumRL: boolean
  scaleMode: ScaleMode
  extentMode: 'all' | 'ab'
  busy: boolean
  hasSurface: boolean
}

const M = { l: 62, r: 14, t: 26, b: 40 }

/** Callback ref: elemen yang diamati dapat berganti (keadaan kosong → grafik). */
function useSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [size, setSize] = useState({ w: 600, h: 300 })
  useEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      if (!e) return
      const r = e.contentRect
      setSize({ w: Math.max(200, Math.floor(r.width)), h: Math.max(160, Math.floor(r.height)) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, size] as const
}

type Label = { key: string; x: number; y: number; text: string; color: string; size: number; anchorX: number; anchorY: number; bold?: boolean }

/** Penempatan label serakah: geser vertikal sampai tidak menimpa label lain. */
export function placeLabels(labels: Label[], bounds: { x0: number; y0: number; x1: number; y1: number }): (Label & { dy: number })[] {
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = []
  const out: (Label & { dy: number })[] = []
  const order = [...labels].sort((a, b) => a.anchorX - b.anchorX || a.anchorY - b.anchorY)
  for (const l of order) {
    const w = l.text.length * l.size * 0.56
    const h = l.size + 2
    let chosen = 0
    for (let k = 0; k < 24; k++) {
      const dy = (k % 2 === 0 ? -1 : 1) * Math.ceil(k / 2) * h
      const y1 = l.y + dy, y0 = y1 - h
      if (y0 < bounds.y0 || y1 > bounds.y1) continue
      const x0 = Math.max(bounds.x0, Math.min(l.x, bounds.x1 - w)), x1 = x0 + w
      if (!placed.some((b) => x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0)) {
        chosen = dy
        break
      }
    }
    const x0 = Math.max(bounds.x0, Math.min(l.x, bounds.x1 - w))
    placed.push({ x0, x1: x0 + w, y0: l.y + chosen - h, y1: l.y + chosen })
    out.push({ ...l, x: x0, dy: chosen })
  }
  return out
}

function rowLabel(r: ObjectRow): string {
  if (r.kind === 'point') return `${r.name} · ${fmtOffset(r.p.o)}`
  if (r.coincident) return `${r.name} · proyeksi berimpit · collar ${fmtOffset(r.collar.o)}, toe ${fmtOffset(r.toe.o)}`
  return `${r.name} · collar ${fmtOffset(r.collar.o)}, toe ${fmtOffset(r.toe.o)}`
}

function hitLabel(r: ObjectRow): string | null {
  if (r.kind !== 'borehole') return null
  const h = r.hit
  if (h.kind === 'cross' || h.kind === 'touch') {
    return `${h.kind === 'cross' ? 'potong' : 'sentuh'} MD ${fmtNum(h.md)} · s ${fmtNum(h.s)} · Z ${fmtNum(h.z)}${h.onAB ? '' : ' (perpanjangan)'}`
  }
  if (h.kind === 'in-plane') return `pada bidang${h.abCoverage === 'inside' ? '' : h.abCoverage === 'partial' ? ' (sebagian di perpanjangan)' : ' (di perpanjangan)'}`
  return 'tidak memotong bidang'
}

export function SectionView(p: Props) {
  const [ref, size] = useSize<HTMLDivElement>()
  const W = size.w - M.l - M.r
  const H = size.h - M.t - M.b

  const view = useMemo(() => {
    if (p.L === null) return null
    const L = p.L
    let sMin = 0, sMax = L
    let zMin = Infinity, zMax = -Infinity
    for (const part of p.profile?.parts ?? []) for (const v of part) {
      zMin = Math.min(zMin, v.z)
      zMax = Math.max(zMax, v.z)
    }
    const ext = p.objects?.extent
    if (ext) {
      if (p.extentMode === 'all') {
        sMin = Math.min(sMin, ext.sMin)
        sMax = Math.max(sMax, ext.sMax)
      }
      zMin = Math.min(zMin, ext.zMin)
      zMax = Math.max(zMax, ext.zMax)
    }
    if (!Number.isFinite(zMin)) {
      zMin = 0
      zMax = 1
    }
    const sPad = (sMax - sMin) * 0.04 || 1
    const zPad = (zMax - zMin) * 0.08 || 1
    sMin -= sPad
    sMax += sPad
    zMin -= zPad
    zMax += zPad
    let ve: number
    if (p.scaleMode === 'fit') {
      ve = (H / (zMax - zMin)) / (W / (sMax - sMin))
    } else {
      ve = p.scaleMode === 'equal' ? 1 : p.scaleMode
      const pxPerM = Math.min(W / (sMax - sMin), H / ((zMax - zMin) * ve))
      const sMid = (sMin + sMax) / 2, zMid = (zMin + zMax) / 2
      const sHalf = W / pxPerM / 2, zHalf = H / (pxPerM * ve) / 2
      sMin = sMid - sHalf
      sMax = sMid + sHalf
      zMin = zMid - zHalf
      zMax = zMid + zHalf
    }
    const x = (s: number) => M.l + ((s - sMin) / (sMax - sMin)) * W
    const y = (z: number) => M.t + (1 - (z - zMin) / (zMax - zMin)) * H
    return { L, sMin, sMax, zMin, zMax, ve, x, y }
  }, [p.L, p.profile, p.objects, p.extentMode, p.scaleMode, W, H])

  if (!view) {
    return (
      <div ref={ref} className="section-view empty" data-testid="section-empty">
        <p>Belum ada garis penampang. Tekan <b>Buat penampang</b> lalu gambar A–B di tampak atas, atau isi E/N A dan B.</p>
      </div>
    )
  }
  const { x, y, L } = view
  const sel = p.selectedId
  const noTopo = p.hasSurface && p.profile !== null && p.profile.parts.length === 0
  const yLabel = p.datumRL ? 'Elevasi (mRL)' : 'Elevasi (m)'
  const ve = view.ve
  const scaleText = Math.abs(ve - 1) < 1e-9 ? 'Skala horizontal = vertikal (1:1)' : `Pembesaran vertikal ×${fmtNum(ve, 2)}`

  const rows = (p.objects?.rows ?? []).filter((r) => r.visible)

  return (
    <div className="section-view">
      <div className="scale-info" data-testid="section-scale">{`A → B · L = ${fmtM(L)} · ${scaleText}`}</div>
      <div ref={ref} className="section-plot">
      <svg width={size.w} height={size.h} role="img" aria-label="Penampang 2D" data-testid="section-svg" data-ve={ve.toFixed(4)} data-length={L.toFixed(6)}>
        <defs>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#9aa5b1" strokeWidth="1.2" />
          </pattern>
          <pattern id="hatch-amb" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#d1242f" strokeWidth="1.2" />
          </pattern>
          <clipPath id="plot">
            <rect x={M.l} y={M.t} width={W} height={H} />
          </clipPath>
        </defs>
        {/* Arsir perpanjangan di luar A–B */}
        <g clipPath="url(#plot)">
          {x(0) > M.l && <rect data-testid="hatch-before-a" x={M.l} y={M.t} width={x(0) - M.l} height={H} fill="url(#hatch)" opacity={0.45} />}
          {x(L) < M.l + W && <rect data-testid="hatch-after-b" x={x(L)} y={M.t} width={M.l + W - x(L)} height={H} fill="url(#hatch)" opacity={0.45} />}
          {(p.profile?.ambiguous ?? []).map(([s0, s1], i) => (
            <rect key={i} data-testid="ambiguous-range" x={x(s0)} y={M.t} width={Math.max(1, x(s1) - x(s0))} height={H} fill="url(#hatch-amb)" opacity={0.6}>
              <title>{`Rentang ambigu s ${fmtNum(s0)}–${fmtNum(s1)} m: beberapa segitiga dengan Z berbeda (face ${(p.profile?.ambiguousFaces?.[i] ?? []).join(', ')})`}</title>
            </rect>
          ))}
        </g>
        {/* Grid & sumbu */}
        <g className="axis" fontSize="11">
          {ticks(view.sMin, view.sMax, Math.max(3, Math.floor(W / 80))).map((t) => (
            <g key={`x${t}`}>
              <line x1={x(t)} x2={x(t)} y1={M.t} y2={M.t + H} stroke="#e3e8ee" />
              <text x={x(t)} y={M.t + H + 14} textAnchor="middle">{fmtNum(t, 0)}</text>
            </g>
          ))}
          {ticks(view.zMin, view.zMax, Math.max(3, Math.floor(H / 40))).map((t) => (
            <g key={`y${t}`}>
              <line x1={M.l} x2={M.l + W} y1={y(t)} y2={y(t)} stroke="#e3e8ee" />
              <text x={M.l - 6} y={y(t) + 4} textAnchor="end">{fmtNum(t, 0)}</text>
            </g>
          ))}
          <rect x={M.l} y={M.t} width={W} height={H} fill="none" stroke="#9aa5b1" />
          <text x={M.l + W / 2} y={size.h - 6} textAnchor="middle">Chainage horizontal dari A (m)</text>
          <text transform={`translate(14 ${M.t + H / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>
        </g>
        {/* Identitas A–B */}
        <g fontSize="12" fontWeight="bold">
          <line x1={x(0)} x2={x(0)} y1={M.t} y2={M.t + H} stroke="#0b7a3e" strokeDasharray="2 3" />
          <line x1={x(L)} x2={x(L)} y1={M.t} y2={M.t + H} stroke="#b35900" strokeDasharray="2 3" />
          <text x={x(0)} y={M.t - 8} textAnchor="middle" fill="#0b7a3e">A</text>
          <text x={x(L)} y={M.t - 8} textAnchor="middle" fill="#b35900">B</text>
        </g>
        <g clipPath="url(#plot)">
          {/* Profil topografi: satu path per bagian; marker untuk sentuhan tunggal */}
          {(p.profile?.parts ?? []).map((part, i) =>
            part.length === 1 ? (
              <path key={i} data-testid="profile-marker" data-s={part[0]!.s.toFixed(4)} data-z={part[0]!.z.toFixed(4)} d={`M${x(part[0]!.s)},${y(part[0]!.z) - 5}l5,5l-5,5l-5,-5z`} fill="#6b4f2a" />
            ) : (
              <path
                key={i}
                data-testid="profile-part"
                data-s0={part[0]!.s.toFixed(4)}
                data-s1={part.at(-1)!.s.toFixed(4)}
                data-vertices={JSON.stringify(part.map((v) => [Number(v.s.toFixed(4)), Number(v.z.toFixed(4))]))}
                d={part.map((v, j) => `${j ? 'L' : 'M'}${x(v.s).toFixed(2)},${y(v.z).toFixed(2)}`).join('')}
                fill="none"
                stroke="#6b4f2a"
                strokeWidth={2.5}
              />
            ),
          )}
          {/* Objek: simbol */}
          {rows.map((r) => {
            const isSel = r.id === sel
            const color = isSel ? '#d1242f' : r.kind === 'point' ? '#1f6feb' : '#6e40c9'
            if (r.kind === 'point') {
              return (
                <g key={r.id} data-testid={`sec-obj-${r.name}`} data-kind="point" data-s={r.p.s.toFixed(4)} data-z={r.p.z.toFixed(4)} className="clickable" onClick={() => p.onSelect(r.id)}>
                  <circle cx={x(r.p.s)} cy={y(r.p.z)} r={isSel ? 6 : 4.5} fill={color} stroke="#fff" strokeWidth={1} />
                </g>
              )
            }
            const cx = x(r.collar.s), cy = y(r.collar.z), tx = x(r.toe.s), ty = y(r.toe.z)
            const inPlane = r.hit.kind === 'in-plane'
            return (
              <g key={r.id} data-testid={`sec-obj-${r.name}`} data-kind="borehole" data-hit={r.hit.kind} className="clickable" onClick={() => p.onSelect(r.id)}>
                {!r.coincident && (
                  <line x1={cx} y1={cy} x2={tx} y2={ty} stroke={color} strokeWidth={inPlane ? 3 : 1.6} strokeDasharray={inPlane ? undefined : '6 4'} />
                )}
                <rect x={cx - 4.5} y={cy - 4.5} width={9} height={9} fill={color} stroke="#fff" />
                {r.coincident ? (
                  <circle cx={cx} cy={cy} r={8} fill="none" stroke={color} strokeWidth={1.5} data-testid="coincident-marker" />
                ) : (
                  <path d={`M${tx},${ty + 5}l-5,-9h10z`} fill={color} stroke="#fff" />
                )}
                {(r.hit.kind === 'cross' || r.hit.kind === 'touch') && (
                  <path data-testid="hit-marker" d={`M${x(r.hit.s) - 6},${y(r.hit.z) - 6}l12,12m0,-12l-12,12`} stroke="#d1242f" strokeWidth={2.5} />
                )}
              </g>
            )
          })}
          {/* Objek: label (ditempatkan agar tidak saling menimpa; garis penunjuk bila digeser) */}
          {placeLabels(
            rows.flatMap((r): Label[] => {
              const isSel = r.id === sel
              const color = isSel ? '#d1242f' : r.kind === 'point' ? '#1f6feb' : '#6e40c9'
              const size = isSel ? 12 : 10.5
              if (r.kind === 'point') {
                const ax = x(r.p.s), ay = y(r.p.z)
                return [{ key: r.id, x: ax + 7, y: ay - 5, anchorX: ax, anchorY: ay, color, size, bold: isSel, text: isSel ? `${rowLabel(r)} · s ${fmtNum(r.p.s)} · Z ${fmtNum(r.p.z)}` : rowLabel(r) }]
              }
              const ax = x(r.collar.s), ay = y(r.collar.z)
              const hl = hitLabel(r)
              const out: Label[] = [{ key: r.id, x: ax + 8, y: ay - 6, anchorX: ax, anchorY: ay, color, size, bold: isSel, text: isSel ? `${rowLabel(r)} · MD ${fmtNum(r.md)} · ${hl}` : rowLabel(r) }]
              if (!isSel && (r.hit.kind === 'cross' || r.hit.kind === 'touch') && hl) {
                const hx = x(r.hit.s), hy = y(r.hit.z)
                out.push({ key: `${r.id}:hit`, x: hx + 8, y: hy + 12, anchorX: hx, anchorY: hy, color: '#d1242f', size: 10, text: hl })
              }
              return out
            }),
            { x0: M.l, y0: M.t, x1: M.l + W, y1: M.t + H },
          ).map((l) => {
            const id = l.key.replace(/:hit$/, '')
            return (
              <g key={l.key} className="clickable" data-testid={`label-${l.key}`} onClick={() => p.onSelect(id)}>
                {l.dy !== 0 && <line x1={l.anchorX} y1={l.anchorY} x2={l.x} y2={l.y + l.dy - l.size / 2} stroke={l.color} strokeWidth={0.6} opacity={0.6} />}
                <text x={l.x} y={l.y + l.dy} fontSize={l.size} fill={l.color} fontWeight={l.bold ? 'bold' : undefined}>
                  {l.text}
                </text>
              </g>
            )
          })}
        </g>
        {noTopo && (
          <text x={M.l + W / 2} y={M.t + 18} textAnchor="middle" fontSize="13" fill="#b35900" data-testid="no-topo">
            Tidak ada perpotongan topografi
          </text>
        )}
        {p.busy && (
          <text x={M.l + 6} y={M.t + 14} fontSize="11" fill="#6b7580">
            Menghitung…
          </text>
        )}
      </svg>
      </div>
      <div className="legend">
        <span><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="#6b4f2a" strokeWidth="2.5" /></svg> Profil topografi</span>
        <span><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="#6e40c9" strokeWidth="1.6" strokeDasharray="6 4" /></svg> Proyeksi bor</span>
        <span><svg width="12" height="12"><path d="M1,1l10,10m0,-10l-10,10" stroke="#d1242f" strokeWidth="2" /></svg> Titik potong bidang</span>
        <span><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="#1f6feb" /></svg> Titik</span>
        <span><svg width="20" height="10"><rect width="20" height="10" fill="url(#hatch)" stroke="#9aa5b1" /></svg> Di luar A–B</span>
      </div>
    </div>
  )
}
