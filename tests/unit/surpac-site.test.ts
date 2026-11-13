/**
 * Uji penerimaan LOKAL terhadap sampel site Surpac di private/site/ (diabaikan git).
 * Di CI atau tanpa berkas site, seluruh blok di-skip. Tidak ada koordinat site di berkas ini;
 * yang diperiksa hanya jumlah dan sifat struktural TIN.
 *
 * Pembanding independen di dalam tes ini: parser referensi kecil (bukan kode adapter) yang
 * memetakan indeks DTM ke record STR, lalu memeriksa konsistensi tetangga TIN.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pairSurpacFiles, parseSurpacPair } from '../../src/import/surpac'
import type { NamedText } from '../../src/import/surpac'
import { parseDxf } from '../../src/import/dxf'
import { buildMeshIndex } from '../../src/geometry/mesh-index'
import { sliceSurface } from '../../src/geometry/profile'

const DIR = join(process.cwd(), 'private', 'site')
const DTM = join(DIR, 'pa_tes.dtm')
const STR = join(DIR, 'pa_tes.str')
const DXF = join(DIR, 'pa_tes.dxf')
const HAVE = existsSync(DTM) && existsSync(STR)

const load = (p: string, name: string): NamedText => {
  const bytes = new Uint8Array(readFileSync(p))
  return { name, bytes, text: new TextDecoder().decode(bytes) }
}

type P = [number, number, number]

/** Parser referensi independen: record STR setelah sumbu (pemisah ikut dinomori). */
function referenceTin(dtmText: string, strText: string) {
  const recs: (P | null)[] = []
  for (const l of strText.split(/\r?\n/).slice(2)) {
    if (l.trim() === '') continue
    const f = l.split(',')
    recs.push(f[0]!.trim() === '0' ? null : [Number(f[2]), Number(f[1]), Number(f[3])])
  }
  const tri: number[][] = []
  let inTri = false
  for (const l of dtmText.split(/\r?\n/)) {
    const s = l.trim()
    if (/^TRISOLATION/i.test(s)) inTri = true
    else if (inTri && s && s !== 'END') tri.push(s.split(',').slice(0, 7).map(Number))
  }
  return { recs, tri }
}

describe.skipIf(!HAVE)('sampel site Surpac (lokal, private/site)', () => {
  const dtm = HAVE ? load(DTM, 'pa_tes.dtm') : null
  const str = HAVE ? load(STR, 'pa_tes.str') : null

  it('pasangan dikenali melalui referensi STR di header DTM', () => {
    const p = pairSurpacFiles([str!, dtm!])
    expect(p.ok && p.pair.matchedBy).toBe('reference')
  })

  it('semua segitiga terpetakan; mesh identik dengan parser referensi; TIN konsisten', async () => {
    const p = pairSurpacFiles([dtm!, str!])
    if (!p.ok) throw new Error(p.issues[0]!.message)
    const t0 = performance.now()
    const r = await parseSurpacPair(p.pair, { yieldFn: async () => {} })
    const ms = performance.now() - t0
    if (!r.ok) throw new Error(r.issues.map((i) => i.code).join(','))
    expect(r.candidates.length).toBe(1)
    const c = r.candidates[0]!
    const { recs, tri } = referenceTin(dtm!.text, str!.text)
    expect(c.mesh.triangles.length / 3).toBe(tri.length)
    expect(c.rejectedFaces).toBe(0)
    expect(r.issueCounts.SURPAC_INDEX_REFERS_CONTROL ?? 0).toBe(0)
    expect(r.issueCounts.SURPAC_INDEX_OUT_OF_RANGE ?? 0).toBe(0)

    // himpunan segitiga adapter = himpunan segitiga referensi (abaikan urutan)
    const key = (a: P, b: P, d: P) => [a, b, d].map((q) => q.join(',')).sort().join('|')
    const ref = new Set(tri.map((t) => key(recs[t[1]! - 1]!, recs[t[2]! - 1]!, recs[t[3]! - 1]!)))
    const m = c.mesh
    let same = 0
    for (let t = 0; t < m.triangles.length; t += 3) {
      const v = [0, 1, 2].map((k) => {
        const i = m.triangles[t + k]! * 3
        return [m.xyz[i]!, m.xyz[i + 1]!, m.xyz[i + 2]!] as P
      })
      if (ref.has(key(v[0]!, v[1]!, v[2]!))) same++
    }
    expect(same).toBe(tri.length)

    // tetangga berbagi tepi dan berada di sisi berlawanan (tidak ada tumpang tindih)
    const side = (a: P, b: P, q: P) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])
    let pairs = 0, overlap = 0
    for (const t of tri) {
      const vs = t.slice(1, 4)
      for (const nb of t.slice(4, 7)) {
        if (!nb) continue
        const u = tri[nb - 1]!.slice(1, 4)
        const common = vs.filter((x) => u.includes(x))
        if (common.length !== 2) continue
        pairs++
        const a = recs[common[0]! - 1]!, b = recs[common[1]! - 1]!
        const pv = recs[vs.find((x) => !common.includes(x))! - 1]!
        const qv = recs[u.find((x) => !common.includes(x))! - 1]!
        if (side(a, b, pv) * side(a, b, qv) >= 0) overlap++
      }
    }
    expect(pairs).toBeGreaterThan(tri.length)
    expect(overlap).toBe(0)
    console.info(`[site] segitiga=${tri.length} vertex=${m.xyz.length / 3} pasangan-tetangga=${pairs} tumpang-tindih=${overlap} urai=${ms.toFixed(0)}ms`)
  })

  it('penampang melintang mesh: ada bagian profil dan tidak ada rentang ambigu', async () => {
    const p = pairSurpacFiles([dtm!, str!])
    if (!p.ok) throw new Error()
    const r = await parseSurpacPair(p.pair, { yieldFn: async () => {} })
    if (!r.ok) throw new Error()
    const c = r.candidates[0]!
    const b = c.bounds
    const idx = buildMeshIndex(c.mesh)
    const t0 = performance.now()
    const prof = sliceSurface(c.mesh, idx, { a: { e: b.min.e, n: b.min.n }, b: { e: b.max.e, n: b.max.n } })
    const ms = performance.now() - t0
    expect(prof.parts.length).toBeGreaterThan(0)
    expect(prof.ambiguous).toEqual([])
    expect(ms).toBeLessThan(1000)
    console.info(`[site] profil diagonal: ${prof.parts.length} bagian, ${prof.parts.reduce((s, q) => s + q.length, 0)} vertex, ${ms.toFixed(1)} ms; dikeluarkan dari profil=${idx.excludedCount}`)
  })

  it.skipIf(!existsSync(DXF))('DXF lampiran berisi string/titik, bukan TIN → ditolak sebagai kontur', () => {
    const r = parseDxf(readFileSync(DXF, 'latin1'), 'pa_tes.dxf')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues[0]!.code).toBe('DXF_CONTOURS_ONLY')
  })
})

const DXF3D = join(DIR, 'pa_tes_3d.dxf')

describe.skipIf(!HAVE || !existsSync(DXF3D))('sampel site: DXF 3D (3DFACE dari Surpac) vs DTM/STR — pembanding independen', () => {
  it('vertex DXF yang berasal dari titik STR berimpit dengan vertex mesh DTM/STR (≤ 1 mm E/N dan Z)', async () => {
    const dx = parseDxf(readFileSync(DXF3D, 'latin1'), 'pa_tes_3d.dxf')
    if (!dx.ok) throw new Error(dx.issues[0]!.code)
    expect(dx.candidates.length).toBe(1)
    expect(dx.candidates[0]!.rejectedFaces).toBe(0)
    const p = pairSurpacFiles([load(DTM, 'pa_tes.dtm'), load(STR, 'pa_tes.str')])
    if (!p.ok) throw new Error()
    const sp = await parseSurpacPair(p.pair, { yieldFn: async () => {} })
    if (!sp.ok) throw new Error()
    const A = sp.candidates[0]!.mesh, B = dx.candidates[0]!.mesh
    // vertex DTM per sel 1 mm (dengan tetangga sel) untuk mencari padanan dalam 1 mm
    const cell = new Map<string, number[]>()
    const k = (e: number, n: number) => `${Math.floor(e * 1000)},${Math.floor(n * 1000)}`
    for (let i = 0; i < A.xyz.length; i += 3) {
      const key = k(A.xyz[i]!, A.xyz[i + 1]!)
      const arr = cell.get(key)
      if (arr) arr.push(i)
      else cell.set(key, [i])
    }
    let shared = 0, maxDxy = 0, maxDz = 0
    for (let i = 0; i < B.xyz.length; i += 3) {
      const e = B.xyz[i]!, n = B.xyz[i + 1]!, z = B.xyz[i + 2]!
      let best: number | null = null, bestD = Infinity
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const j of cell.get(`${Math.floor(e * 1000) + dx},${Math.floor(n * 1000) + dy}`) ?? []) {
          const d = Math.hypot(A.xyz[j]! - e, A.xyz[j + 1]! - n)
          if (d < bestD) { bestD = d; best = j }
        }
      }
      if (best === null || bestD > 0.001) continue
      shared++
      maxDxy = Math.max(maxDxy, bestD)
      maxDz = Math.max(maxDz, Math.abs(A.xyz[best + 2]! - z))
    }
    const nB = B.xyz.length / 3
    console.info(`[site 3D] vertex DXF=${nB} berimpit dengan vertex DTM=${shared} (${((shared / nB) * 100).toFixed(1)}%) maks dE/N=${(maxDxy * 1000).toFixed(2)} mm maks dZ=${(maxDz * 1000).toFixed(2)} mm`)
    expect(shared / nB).toBeGreaterThan(0.99)
    expect(maxDxy).toBeLessThanOrEqual(0.001)
    expect(maxDz).toBeLessThanOrEqual(0.001)
  }, 120000)
})
