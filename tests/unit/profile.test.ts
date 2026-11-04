import { describe, expect, it } from 'vitest'
import type { Mesh, Profile, Section } from '../../src/domain/types'
import { parseDxf } from '../../src/import/dxf'
import { buildMeshIndex, queryCandidates } from '../../src/geometry/mesh-index'
import { profileZAt, sliceSurface } from '../../src/geometry/profile'
import { reverseSection } from '../../src/geometry/section'
import { loadExpected, readFixtureText } from './helpers'

const X = loadExpected()
const E0 = 700000
const N0 = 9100000
const SEC: Section = { a: { e: X.a[0], n: X.a[1] }, b: { e: X.b[0], n: X.b[1] } }

function meshOf(name: string): Mesh {
  const r = parseDxf(readFixtureText(name), name)
  if (!r.ok) throw new Error('fixture gagal')
  return r.candidates[0]!.mesh
}

function slice(mesh: Mesh, s: Section): Profile {
  return sliceSurface(mesh, buildMeshIndex(mesh), s)
}

function meshFromTris(tris: number[][][]): Mesh {
  const xyz: number[] = []
  const idx: number[] = []
  for (const t of tris) for (const p of t) {
    idx.push(xyz.length / 3)
    xyz.push(p[0]!, p[1]!, p[2]!)
  }
  return { xyz: Float64Array.from(xyz), triangles: Uint32Array.from(idx) }
}

/** Pembanding independen: cari segitiga yang memuat titik (barycentric), interpolasi Z. */
function bruteZ(mesh: Mesh, e: number, n: number): number[] {
  const out: number[] = []
  for (let t = 0; t < mesh.triangles.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => {
      const i = mesh.triangles[t + k]! * 3
      return [mesh.xyz[i]!, mesh.xyz[i + 1]!, mesh.xyz[i + 2]!]
    }) as [number[], number[], number[]]
    const det = (b[1]! - c[1]!) * (a[0]! - c[0]!) + (c[0]! - b[0]!) * (a[1]! - c[1]!)
    if (Math.abs(det) < 1e-12) continue
    const l1 = ((b[1]! - c[1]!) * (e - c[0]!) + (c[0]! - b[0]!) * (n - c[1]!)) / det
    const l2 = ((c[1]! - a[1]!) * (e - c[0]!) + (a[0]! - c[0]!) * (n - c[1]!)) / det
    const l3 = 1 - l1 - l2
    if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) out.push(l1 * a[2]! + l2 * b[2]! + l3 * c[2]!)
  }
  return out
}

function compareWithBrute(mesh: Mesh, sec: Section, samples = 400) {
  const prof = slice(mesh, sec)
  const L = Math.hypot(sec.b.e - sec.a.e, sec.b.n - sec.a.n)
  let checked = 0
  for (let i = 0; i <= samples; i++) {
    const s = (L * i) / samples
    const e = sec.a.e + ((sec.b.e - sec.a.e) * s) / L
    const n = sec.a.n + ((sec.b.n - sec.a.n) * s) / L
    const zs = bruteZ(mesh, e, n)
    const z = profileZAt(prof, s, 1e-6)
    if (zs.length === 0) {
      // Celah: profil tidak boleh mengisi (kecuali tepat di batas).
      if (z !== null) {
        const nearEdge = bruteZ(mesh, e + 1e-4, n).length + bruteZ(mesh, e - 1e-4, n).length + bruteZ(mesh, e, n + 1e-4).length + bruteZ(mesh, e, n - 1e-4).length
        expect(nearEdge).toBeGreaterThan(0)
      }
      continue
    }
    expect(z).not.toBeNull()
    expect(Math.abs(z! - zs[0]!)).toBeLessThanOrEqual(X.tolerance_m)
    checked++
  }
  return { prof, checked }
}

describe('profil bench (fixture SYN-01)', () => {
  const mesh = meshOf('bench_3dface.dxf')
  const prof = slice(mesh, SEC)

  it('satu bagian kontinu dari s=0 sampai s=100', () => {
    expect(prof.parts.length).toBe(1)
    const p = prof.parts[0]!
    expect(p[0]!.s).toBeCloseTo(0, 6)
    expect(p[p.length - 1]!.s).toBeCloseTo(100, 6)
    expect(prof.ambiguous).toEqual([])
  })

  it('titik patah bench sesuai expected.json (±0,01 m)', () => {
    for (const [s, z] of X.bench.required_breakpoints_s_z) {
      const zz = profileZAt(prof, s)
      expect(zz).not.toBeNull()
      expect(Math.abs(zz! - z)).toBeLessThanOrEqual(X.tolerance_m)
      // titik patah harus muncul sebagai vertex profil
      expect(prof.parts[0]!.some((v) => Math.abs(v.s - s) <= X.tolerance_m && Math.abs(v.z - z) <= X.tolerance_m)).toBe(true)
    }
  })

  it('POLYFACE memberi profil yang sama', () => {
    const p2 = slice(meshOf('bench_polyface.dxf'), SEC)
    for (const [s, z] of X.bench.required_breakpoints_s_z) expect(profileZAt(p2, s)).toBeCloseTo(z, 6)
  })

  it('sesuai pembanding brute-force pada A–B acuan dan garis oblique', () => {
    expect(compareWithBrute(mesh, SEC).checked).toBeGreaterThan(300)
    const obl: Section = { a: { e: E0 - 10, n: N0 - 25 }, b: { e: E0 + 110, n: N0 + 25 } }
    expect(compareWithBrute(mesh, obl).checked).toBeGreaterThan(200)
    const north: Section = { a: { e: E0 + 47, n: N0 - 30 }, b: { e: E0 + 47, n: N0 + 30 } }
    expect(compareWithBrute(mesh, north).checked).toBeGreaterThan(200)
  })

  it('pembalikan A/B membalik urutan profil: s′ = L − s', () => {
    const rev = slice(mesh, reverseSection(SEC))
    expect(rev.parts.length).toBe(1)
    for (const [s, z] of X.bench.required_breakpoints_s_z) expect(profileZAt(rev, 100 - s)).toBeCloseTo(z, 6)
    const r = rev.parts[0]!
    expect(r[0]!.z).toBeCloseTo(140, 6)
    expect(r[r.length - 1]!.z).toBeCloseTo(120, 6)
    for (let i = 1; i < r.length; i++) expect(r[i]!.s).toBeGreaterThan(r[i - 1]!.s)
  })

  it('A dan B di luar mesh: profil tetap dibatasi pada cakupan segitiga', () => {
    const p = slice(mesh, { a: { e: E0 - 50, n: N0 }, b: { e: E0 + 150, n: N0 } })
    expect(p.parts.length).toBe(1)
    expect(p.parts[0]![0]!.s).toBeCloseTo(50, 6)
    expect(p.parts[0]!.at(-1)!.s).toBeCloseTo(150, 6)
  })
})

describe('profil gap', () => {
  const mesh = meshOf('gap_3dface.dxf')
  it('hanya dua interval [0,40] dan [55,100] m', () => {
    const prof = slice(mesh, SEC)
    const intervals = prof.parts.filter((p) => p.length > 1).map((p) => [p[0]!.s, p.at(-1)!.s])
    expect(intervals.length).toBe(X.gap.profile_intervals_s.length)
    intervals.forEach(([s0, s1], i) => {
      expect(Math.abs(s0! - X.gap.profile_intervals_s[i]![0])).toBeLessThanOrEqual(X.tolerance_m)
      expect(Math.abs(s1! - X.gap.profile_intervals_s[i]![1])).toBeLessThanOrEqual(X.tolerance_m)
    })
    expect(prof.parts.length).toBe(2)
    expect(profileZAt(prof, 47)).toBeNull()
  })
  it('sesuai brute-force', () => {
    compareWithBrute(mesh, SEC)
  })
})

describe('kasus khusus segitiga', () => {
  const plane = meshFromTris([[[0, 0, 100], [10, 0, 110], [0, 10, 120]]])

  it('bidang Z=100+E+2N: A=(1,1), B=(2,1) → satu interval 1 m, Z=103 dan Z=104', () => {
    const p = slice(plane, { a: { e: 1, n: 1 }, b: { e: 2, n: 1 } })
    expect(p.parts.length).toBe(1)
    const part = p.parts[0]!
    expect(part.length).toBe(2)
    expect(part[0]!.s).toBeCloseTo(0, 9)
    expect(part[1]!.s).toBeCloseTo(1, 9)
    expect(part[0]!.z).toBeCloseTo(103, 9)
    expect(part[1]!.z).toBeCloseTo(104, 9)
  })

  it('sama pada koordinat dunia jutaan meter', () => {
    const w = meshFromTris([[[E0, N0, 100], [E0 + 10, N0, 110], [E0, N0 + 10, 120]]])
    const p = slice(w, { a: { e: E0 + 1, n: N0 + 1 }, b: { e: E0 + 2, n: N0 + 1 } })
    expect(p.parts[0]![0]!.z).toBeCloseTo(103, 7)
    expect(p.parts[0]![1]!.z).toBeCloseTo(104, 7)
  })

  it('potongan searah dan berlawanan memberi Z sama', () => {
    const f = slice(plane, { a: { e: -5, n: 2 }, b: { e: 15, n: 2 } })
    const r = slice(plane, { a: { e: 15, n: 2 }, b: { e: -5, n: 2 } })
    expect(f.parts[0]![0]!.s).toBeCloseTo(5, 9) // masuk pada E=0
    expect(r.parts[0]![0]!.s).toBeCloseTo(7, 9) // masuk pada E=8 (tepi miring)
    expect(profileZAt(f, 5 + 3)).toBeCloseTo(profileZAt(r, 20 - 8)!, 9)
  })

  it('tepat di edge bersama: satu interval tanpa duplikasi', () => {
    const two = meshFromTris([
      [[0, 0, 0], [10, 0, 0], [10, 10, 10]],
      [[0, 0, 0], [10, 10, 10], [0, 10, 0]],
    ])
    const p = slice(two, { a: { e: -2, n: -2 }, b: { e: 12, n: 12 } })
    expect(p.parts.length).toBe(1)
    expect(p.ambiguous).toEqual([])
    const part = p.parts[0]!
    expect(part[0]!.z).toBeCloseTo(0, 9)
    expect(part.at(-1)!.z).toBeCloseTo(10, 9)
    expect(part.length).toBe(2)
  })

  it('hanya menyentuh satu vertex: satu marker tanpa segmen rekaan', () => {
    const p = slice(plane, { a: { e: -5, n: 5 }, b: { e: 5, n: -5 } })
    expect(p.parts.length).toBe(1)
    expect(p.parts[0]!.length).toBe(1)
    expect(p.parts[0]![0]!.z).toBeCloseTo(100, 9)
    expect(p.parts[0]![0]!.s).toBeCloseTo(Math.hypot(5, 5), 6)
  })

  it('di luar mesh: tidak ada bagian profil', () => {
    const p = slice(plane, { a: { e: 20, n: 20 }, b: { e: 30, n: 25 } })
    expect(p.parts).toEqual([])
  })

  it('segitiga overlap dengan elevasi berbeda: profil dipecah, rentang ambigu dilaporkan', () => {
    const m = meshFromTris([
      [[0, 0, 10], [10, 0, 10], [0, 10, 10]],
      [[0, 0, 20], [10, 0, 20], [0, 10, 20]],
      [[10, 0, 10], [20, 0, 10], [10, 10, 10]],
    ])
    const p = slice(m, { a: { e: 0, n: 1 }, b: { e: 20, n: 1 } })
    expect(p.ambiguous.length).toBe(1)
    expect(p.ambiguous[0]![0]).toBeCloseTo(0, 9)
    expect(p.ambiguous[0]![1]).toBeCloseTo(9, 9)
    expect(p.ambiguousFaces![0]).toEqual([0, 1])
    // bagian setelah rentang ambigu tetap ada
    expect(p.parts.some((part) => part.length > 1 && part[0]!.s >= 10 - 1e-6)).toBe(true)
    expect(profileZAt(p, 4)).toBeNull()
  })

  it('surface bertumpuk identik (Z sama) tidak dianggap ambigu', () => {
    const t = [[0, 0, 10], [10, 0, 10], [0, 10, 10]]
    const p = slice(meshFromTris([t, t]), { a: { e: 0, n: 1 }, b: { e: 10, n: 1 } })
    expect(p.ambiguous).toEqual([])
    expect(p.parts.length).toBe(1)
  })

  it('segitiga vertikal dikeluarkan dari profil dan dihitung', () => {
    const m = meshFromTris([
      [[0, 0, 0], [10, 0, 0], [0, 10, 0]],
      [[5, 0, 0], [5, 10, 0], [5, 10, 50]],
    ])
    const idx = buildMeshIndex(m)
    expect(idx.excludedCount).toBe(1)
    const p = sliceSurface(m, idx, { a: { e: 0, n: 1 }, b: { e: 10, n: 1 } })
    expect(p.parts.length).toBe(1)
    expect(p.parts[0]!.every((v) => Math.abs(v.z) < 1e-9)).toBe(true)
  })

  it('tebing vertikal (dua permukaan bertemu dengan Z berbeda) tidak disambung', () => {
    const m = meshFromTris([
      [[0, 0, 0], [10, 0, 0], [10, 10, 0]],
      [[10, 0, 5], [20, 0, 5], [10, 10, 5]],
    ])
    const p = slice(m, { a: { e: 0, n: 0.5 }, b: { e: 20, n: 0.5 } })
    expect(p.parts.length).toBe(2)
  })
})

describe('indeks spasial', () => {
  /** Grid bergelombang n×n sel (2 segitiga per sel) sebagai mesh besar realistis. */
  function wavy(n: number, step = 5): Mesh {
    const xyz: number[] = []
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      xyz.push(E0 + i * step, N0 + j * step, 100 + 10 * Math.sin(i / 7) + 6 * Math.cos(j / 5))
    }
    const tri: number[] = []
    const id = (i: number, j: number) => j * (n + 1) + i
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      tri.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i, j + 1))
    }
    return { xyz: Float64Array.from(xyz), triangles: Uint32Array.from(tri) }
  }

  it('kandidat indeks memuat semua segitiga yang benar-benar terpotong (acak)', () => {
    const m = wavy(60)
    const idx = buildMeshIndex(m)
    const all = { ...idx, cellStart: Uint32Array.from([0, idx.triangleCount]), cellItems: Uint32Array.from({ length: idx.triangleCount }, (_, i) => i), nx: 1, ny: 1, cell: 1e9, stamp: new Uint32Array(idx.triangleCount), stampValue: 0 }
    let seed = 42
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    for (let k = 0; k < 25; k++) {
      const s: Section = {
        a: { e: E0 - 20 + rnd() * 340, n: N0 - 20 + rnd() * 340 },
        b: { e: E0 - 20 + rnd() * 340, n: N0 - 20 + rnd() * 340 },
      }
      const p1 = sliceSurface(m, idx, s)
      const p2 = sliceSurface(m, all, s)
      expect(p1.parts.length).toBe(p2.parts.length)
      p1.parts.forEach((part, i) => {
        expect(part.length).toBe(p2.parts[i]!.length)
        part.forEach((v, j) => {
          expect(v.s).toBeCloseTo(p2.parts[i]![j]!.s, 9)
          expect(v.z).toBeCloseTo(p2.parts[i]![j]!.z, 9)
        })
      })
    }
  })

  it('garis vertikal (utara) dan horizontal memakai kolom/baris yang tepat', () => {
    const m = wavy(20)
    const idx = buildMeshIndex(m)
    expect(queryCandidates(idx, { e: E0 + 12.5, n: N0 - 10 }, { e: E0 + 12.5, n: N0 + 110 }).length).toBeGreaterThan(0)
    expect(queryCandidates(idx, { e: E0 + 500, n: N0 }, { e: E0 + 600, n: N0 }).length).toBe(0)
  })

  it('mesh besar: pembaruan profil jauh di bawah 1 detik', () => {
    const m = wavy(400) // 320.000 segitiga
    const t0 = performance.now()
    const idx = buildMeshIndex(m)
    const tIndex = performance.now() - t0
    const t1 = performance.now()
    for (let k = 0; k < 10; k++) sliceSurface(m, idx, { a: { e: E0 + k, n: N0 }, b: { e: E0 + 2000 - k, n: N0 + 2000 } })
    const tSlice = (performance.now() - t1) / 10
    expect(tSlice).toBeLessThan(1000)
    expect(tIndex).toBeLessThan(5000)
  })
})
