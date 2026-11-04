import { describe, expect, it } from 'vitest'
import type { Borehole, Section } from '../../src/domain/types'
import {
  DegenerateSectionError,
  intervalInCorridor,
  pointInCorridor,
  projectPoint,
  reverseSection,
  sectionBasis,
  validateSection,
} from '../../src/geometry/section'
import { boreholeToe, intersectBorehole, projectBorehole } from '../../src/geometry/borehole'
import { loadExpected, rawCsvRows } from './helpers'

const X = loadExpected()
const TOL = X.tolerance_m
const SEC: Section = { a: { e: X.a[0], n: X.a[1] }, b: { e: X.b[0], n: X.b[1] } }

function points() {
  return rawCsvRows('points.csv').map((r) => ({
    id: `point:${r.name}`,
    name: r.name!,
    e: Number(r.easting),
    n: Number(r.northing),
    z: Number(r.elevation),
  }))
}

function holes(): Borehole[] {
  return rawCsvRows('boreholes.csv').map((r) => ({
    id: `borehole:${r.name}`,
    name: r.name!,
    collar: { e: Number(r.easting), n: Number(r.northing), z: Number(r.elevation) },
    md: Number(r.depth),
    azDeg: Number(r.azimuth),
    dipDeg: Number(r.dip),
  }))
}

describe('projectPoint (fixture SYN-01)', () => {
  for (const p of points()) {
    it(`${p.name} sesuai expected.json`, () => {
      const exp = X.points[p.name]!
      const r = projectPoint(p, SEC)
      expect(r.s).toBeCloseTo(exp.s, 6)
      expect(r.o).toBeCloseTo(exp.offset, 6)
      expect(r.z).toBe(exp.z)
      expect(Math.abs(r.s - exp.s)).toBeLessThanOrEqual(TOL)
    })
  }

  it('titik sebelum A dan sesudah B tidak ditumpuk di ujung (garis tak berhingga)', () => {
    const pts = points()
    expect(projectPoint(pts.find((p) => p.name === 'P-02')!, SEC).s).toBeCloseTo(-10, 9)
    expect(projectPoint(pts.find((p) => p.name === 'P-03')!, SEC).s).toBeCloseTo(110, 9)
  })

  it('orientasi utara: A→B ke utara, timur bernilai kanan (negatif)', () => {
    const s: Section = { a: { e: 500000, n: 9000000 }, b: { e: 500000, n: 9000100 } }
    const r = projectPoint({ e: 500010, n: 9000030, z: 5 }, s)
    expect(r.s).toBeCloseTo(30, 9)
    expect(r.o).toBeCloseTo(-10, 9)
    expect(r.z).toBe(5)
  })

  it('orientasi timur: utara bernilai kiri (positif)', () => {
    const s: Section = { a: { e: 0, n: 0 }, b: { e: 10, n: 0 } }
    expect(projectPoint({ e: 3, n: 2, z: 0 }, s).o).toBeCloseTo(2, 12)
  })

  it('oblique: A=(0,0), B=(3,4), P=(−4,3,10) → s=0, o=+5', () => {
    const s: Section = { a: { e: 0, n: 0 }, b: { e: 3, n: 4 } }
    const r = projectPoint({ e: -4, n: 3, z: 10 }, s)
    expect(r.s).toBeCloseTo(0, 12)
    expect(r.o).toBeCloseTo(5, 12)
    expect(r.z).toBe(10)
  })

  it('oblique pada koordinat jutaan meter tetap presisi', () => {
    const s: Section = { a: { e: 712345.678, n: 9123456.789 }, b: { e: 712345.678 + 3, n: 9123456.789 + 4 } }
    const r = projectPoint({ e: 712345.678 - 4, n: 9123456.789 + 3, z: 1 }, s)
    expect(Math.abs(r.s)).toBeLessThan(1e-6)
    expect(r.o).toBeCloseTo(5, 6)
  })

  it('pembalikan garis: s′=L−s, o′=−o, Z tetap', () => {
    const rev = reverseSection(SEC)
    const p01 = projectPoint(points().find((p) => p.name === 'P-01')!, rev)
    expect(p01.s).toBeCloseTo(70, 9)
    expect(p01.o).toBeCloseTo(10, 9)
    const p03 = projectPoint(points().find((p) => p.name === 'P-03')!, rev)
    expect(p03.s).toBeCloseTo(-10, 9)
    expect(p03.o).toBeCloseTo(2, 9)
    for (const p of points()) {
      const a = projectPoint(p, SEC)
      const b = projectPoint(p, rev)
      expect(b.s).toBeCloseTo(100 - a.s, 9)
      expect(b.o).toBeCloseTo(-a.o, 9)
      expect(b.z).toBe(a.z)
    }
  })

  it('A=B ditolak dengan pesan untuk memindahkan B', () => {
    const s: Section = { a: { e: 1, n: 1 }, b: { e: 1, n: 1 + 1e-9 } }
    expect(validateSection(s)?.code).toBe('SECTION_ZERO_LENGTH')
    expect(validateSection(s)?.message).toMatch(/Pindahkan B/)
    expect(() => projectPoint({ e: 0, n: 0, z: 0 }, s)).toThrow(DegenerateSectionError)
    expect(sectionBasis(SEC).L).toBe(100)
  })

  it('A atau B non-finite ditolak', () => {
    expect(validateSection({ a: { e: NaN, n: 0 }, b: { e: 1, n: 1 } })?.code).toBe('SECTION_NOT_FINITE')
  })
})

describe('boreholeToe dan projectBorehole (fixture SYN-01)', () => {
  for (const h of holes()) {
    const exp = X.boreholes[h.name]!
    it(`${h.name} collar/toe sesuai expected.json`, () => {
      const r = projectBorehole(h, SEC)
      expect(r.collar.s).toBeCloseTo(exp.collar_s_o_z[0], 6)
      expect(r.collar.o).toBeCloseTo(exp.collar_s_o_z[1], 6)
      expect(r.collar.z).toBeCloseTo(exp.collar_s_o_z[2], 6)
      expect(r.toe.s).toBeCloseTo(exp.toe_s_o_z[0], 6)
      expect(r.toe.o).toBeCloseTo(exp.toe_s_o_z[1], 6)
      expect(r.toe.z).toBeCloseTo(exp.toe_s_o_z[2], 6)
    })

    it(`${h.name} status bidang = ${exp.plane}`, () => {
      const hit = intersectBorehole(h, SEC)
      if (exp.plane === 'cross' || exp.plane === 'extension-cross') {
        expect(hit.kind).toBe('cross')
        if (hit.kind !== 'cross') return
        expect(hit.onAB).toBe(exp.plane === 'cross')
        expect(Math.abs(hit.md - exp.md_at_hit!)).toBeLessThanOrEqual(TOL)
        expect(Math.abs(hit.s - exp.hit_s_z![0])).toBeLessThanOrEqual(TOL)
        expect(Math.abs(hit.z - exp.hit_s_z![1])).toBeLessThanOrEqual(TOL)
      } else {
        expect(hit.kind).toBe(exp.plane)
      }
    })
  }

  it('BH-01: s=50, offset +12/−8, MD potong=24, Z potong=113,2153903', () => {
    const h = holes().find((x) => x.name === 'BH-01')!
    const r = projectBorehole(h, SEC)
    expect(r.collar.o).toBeCloseTo(12, 9)
    expect(r.toe.o).toBeCloseTo(-8, 9)
    const hit = intersectBorehole(h, SEC)
    expect(hit.kind).toBe('cross')
    if (hit.kind !== 'cross') return
    expect(hit.s).toBeCloseTo(50, 9)
    expect(hit.md).toBeCloseTo(24, 9)
    expect(hit.z).toBeCloseTo(113.2153903, 7)
    expect(hit.onAB).toBe(true)
  })

  it('BH-01 pada garis terbalik: MD dan Z potong sama, offset collar −12, toe +8', () => {
    const h = holes().find((x) => x.name === 'BH-01')!
    const rev = reverseSection(SEC)
    const r = projectBorehole(h, rev)
    expect(r.collar.o).toBeCloseTo(-12, 9)
    expect(r.toe.o).toBeCloseTo(8, 9)
    const hit = intersectBorehole(h, rev)
    if (hit.kind !== 'cross') throw new Error('harus cross')
    expect(hit.md).toBeCloseTo(24, 9)
    expect(hit.z).toBeCloseTo(113.2153903, 7)
    expect(hit.s).toBeCloseTo(50, 9)
  })

  it('bor vertikal: azimuth tidak menggeser E/N', () => {
    for (const az of [0, 37, 180, 359.9]) {
      const toe = boreholeToe({ id: 'v', name: 'v', collar: { e: 700000, n: 9100000, z: 100 }, md: 50, azDeg: az, dipDeg: -90 })
      expect(toe.e).toBe(700000)
      expect(toe.n).toBe(9100000)
      expect(toe.z).toBe(50)
    }
  })

  it('BH-02 in-plane berada di dalam rentang A–B', () => {
    const hit = intersectBorehole(holes().find((x) => x.name === 'BH-02')!, SEC)
    expect(hit.kind).toBe('in-plane')
    if (hit.kind !== 'in-plane') return
    expect(hit.abCoverage).toBe('inside')
    expect(hit.sRange[0]).toBeCloseTo(80, 9)
  })

  it('in-plane pada perpanjangan dan sebagian', () => {
    const base = { id: 'x', name: 'x', md: 30, azDeg: 90, dipDeg: 0 }
    const outside = intersectBorehole({ ...base, collar: { e: 700120, n: 9100000, z: 100 } }, SEC)
    expect(outside.kind === 'in-plane' && outside.abCoverage).toBe('outside')
    const partial = intersectBorehole({ ...base, collar: { e: 700090, n: 9100000, z: 100 } }, SEC)
    expect(partial.kind === 'in-plane' && partial.abCoverage).toBe('partial')
  })

  it('BH-04 bor mendatar: kedua proyeksi berimpit dan memotong di perpanjangan', () => {
    const r = projectBorehole(holes().find((x) => x.name === 'BH-04')!, SEC)
    expect(r.coincident).toBe(true)
    expect(r.hit.kind).toBe('cross')
    if (r.hit.kind === 'cross') expect(r.hit.onAB).toBe(false)
  })

  it('BH-03 sejajar bidang, tidak memotong', () => {
    const r = projectBorehole(holes().find((x) => x.name === 'BH-03')!, SEC)
    expect(r.hit.kind).toBe('none')
    expect(r.coincident).toBe(false)
  })

  it('sentuhan tepat di toe (MD penuh) dan di collar (MD 0)', () => {
    // collar o=+10, ke selatan mendatar 10 m → toe o=0
    const atToe = intersectBorehole(
      { id: 't', name: 't', collar: { e: 700040, n: 9100010, z: 125 }, md: 10, azDeg: 180, dipDeg: 0 },
      SEC,
    )
    expect(atToe.kind).toBe('touch')
    if (atToe.kind === 'touch') {
      expect(atToe.md).toBe(10)
      expect(atToe.s).toBeCloseTo(40, 9)
      expect(atToe.z).toBe(125)
      expect(atToe.onAB).toBe(true)
    }
    const atCollar = intersectBorehole(
      { id: 'c', name: 'c', collar: { e: 700040, n: 9100000, z: 125 }, md: 10, azDeg: 0, dipDeg: -45 },
      SEC,
    )
    expect(atCollar.kind).toBe('touch')
    if (atCollar.kind === 'touch') expect(atCollar.md).toBe(0)
  })

  it('bidang tidak terdefinisi untuk A=B', () => {
    const h = holes()[0]!
    expect(() => intersectBorehole(h, { a: SEC.a, b: SEC.a })).toThrow(DegenerateSectionError)
  })
})

describe('filter koridor', () => {
  it('koridor ±5 m memberi tepat 6 objek sesuai expected.json', () => {
    const w = 5
    const ids: string[] = []
    for (const p of points()) if (pointInCorridor(projectPoint(p, SEC).o, w)) ids.push(p.name)
    for (const h of holes()) {
      const r = projectBorehole(h, SEC)
      if (intervalInCorridor(r.collar.o, r.toe.o, w)) ids.push(h.name)
    }
    expect(ids.sort()).toEqual([...X.corridor_half_width_5m].sort())
    expect(points().length + holes().length).toBe(X.all_count)
  })

  it('koridor ±0 m hanya menerima offset nol (dalam toleransi numerik) dan bor yang menyeberang', () => {
    expect(pointInCorridor(0, 0)).toBe(true)
    expect(pointInCorridor(1e-9, 0)).toBe(true)
    expect(pointInCorridor(0.001, 0)).toBe(false)
    expect(intervalInCorridor(12, -8, 0)).toBe(true) // BH-01 menyeberang
    expect(intervalInCorridor(6, 6, 0)).toBe(false) // BH-03
    expect(intervalInCorridor(-4, 4, 0)).toBe(true) // BH-04
  })

  it('bor dengan kedua ujung jauh tetapi menyeberang tetap lolos', () => {
    expect(intervalInCorridor(100, -100, 1)).toBe(true)
    expect(intervalInCorridor(100, 50, 1)).toBe(false)
  })

  it('w negatif ditolak', () => {
    expect(() => pointInCorridor(0, -1)).toThrow()
  })
})
