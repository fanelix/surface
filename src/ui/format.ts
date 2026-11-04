import { offsetSide } from '../geometry/section'

const nf = new Map<number, Intl.NumberFormat>()
function fmt(d: number) {
  let f = nf.get(d)
  if (!f) {
    f = new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
    nf.set(d, f)
  }
  return f
}

/** Angka Indonesia (koma desimal). Angka penuh disimpan; pembulatan hanya di tampilan. */
export function fmtNum(x: number, d = 2): string {
  if (!Number.isFinite(x)) return '—'
  const v = Math.abs(x) < 0.5 * 10 ** -d ? 0 : x
  return fmt(d).format(v)
}

export function fmtM(x: number, d = 2): string {
  return `${fmtNum(x, d)} m`
}

/** "12,00 m kiri" / "8,00 m kanan" / "tepat pada bidang". */
export function fmtOffset(o: number): string {
  const side = offsetSide(o)
  if (side === 'tepat') return 'tepat pada bidang'
  return `${fmtNum(Math.abs(o))} m ${side}`
}

export function fmtMs(ms: number): string {
  return ms >= 1000 ? `${fmtNum(ms / 1000, 2)} s` : `${fmtNum(ms, 0)} ms`
}

/** Azimuth grid A→B dalam derajat [0,360). */
export function azimuthDeg(dE: number, dN: number): number {
  const a = (Math.atan2(dE, dN) * 180) / Math.PI
  return (a + 360) % 360
}

/** Langkah tick "bagus" (1, 2, 5 × 10^k). */
export function niceStep(range: number, targetTicks: number): number {
  const raw = range / Math.max(targetTicks, 1)
  const p = 10 ** Math.floor(Math.log10(raw))
  const m = raw / p
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p
}

export function ticks(min: number, max: number, target: number): number[] {
  if (!(max > min)) return [min]
  const step = niceStep(max - min, target)
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v)
  return out
}
