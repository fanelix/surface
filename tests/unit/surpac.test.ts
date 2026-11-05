/**
 * M3 — Surpac DTM/STR.
 *  - Pemasangan, deteksi struktur, dan error.
 *  - Jalur impor varian teks yang diverifikasi pada sampel site: indeks vertex DTM = nomor record
 *    STR setelah record sumbu (pemisah ikut dinomori); STR = string, Y(N), X(E), Z.
 *  - Pembanding independen: fixture sintetis surpac/bench.{dtm,str} harus menghasilkan mesh yang
 *    identik dengan bench_3dface.dxf.
 * Sampel site asli TIDAK ada di repo; lihat tests/unit/surpac-site.test.ts (hanya lokal).
 */
import { describe, expect, it } from 'vitest'
import { detectSurpacVariant, dtmStrReference, looksBinary, pairSurpacFiles, parseSurpacPair, surpacStructureIssues } from '../../src/import/surpac'
import type { NamedText } from '../../src/import/surpac'
import { openSurfaceFiles } from '../../src/import/open-surface'
import { parseDxf } from '../../src/import/dxf'
import type { Mesh } from '../../src/domain/types'
import { buildMeshIndex } from '../../src/geometry/mesh-index'
import { profileZAt, sliceSurface } from '../../src/geometry/profile'
import { fakeFile, loadExpected, readFixtureBytes, readFixtureText } from './helpers'

const enc = new TextEncoder()
const nt = (name: string, text: string): NamedText => ({ name, text, bytes: enc.encode(text) })

const STR = [
  'topo,04-Nov-26,sintetis,',
  '0, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000',
  '1, 9099980.000, 700000.000, 120.000,',
  '1, 9099980.000, 700020.000, 120.000,',
  '1, 9100020.000, 700020.000, 120.000,',
  '0, 0.000, 0.000, 0.000,',
  '0, 0.000, 0.000, 0.000, END',
].join('\n')

const DTM = [
  'topo.str,04-Nov-26,,',
  '0, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000',
  'OBJECT, 1,',
  'TRISOLATION, 1, neighbours=no,validated=true,closed=no',
  '1, 1, 2, 3,',
  'END',
].join('\n')

describe('pemasangan DTM + STR', () => {
  it('bebas urutan dan kapitalisasi; referensi STR pada header DTM dipakai', () => {
    const r = pairSurpacFiles([nt('TOPO.STR', STR), nt('Topo.dtm', DTM)])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.pair.matchedBy).toBe('reference')
      expect(r.pair.dtm.name).toBe('Topo.dtm')
    }
    expect(dtmStrReference(DTM)).toBe('topo.str')
  })

  it('tanpa referensi: cocokkan nama dasar', () => {
    const dtm = DTM.replace('topo.str,', 'tanpa-ref,')
    const r = pairSurpacFiles([nt('pit.dtm', dtm), nt('PIT.str', STR)])
    expect(r.ok && r.pair.matchedBy).toBe('basename')
  })

  it('nama dasar berbeda tanpa referensi → minta konfirmasi; setelah konfirmasi diterima', () => {
    const dtm = DTM.replace('topo.str,', 'tanpa-ref,')
    const r = pairSurpacFiles([nt('a.dtm', dtm), nt('b.str', STR)])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.issues[0]!.code).toBe('SURPAC_PAIR_AMBIGUOUS')
      expect(r.needsConfirmation).toEqual({ dtm: 'a.dtm', str: 'b.str' })
    }
    const c = pairSurpacFiles([nt('a.dtm', dtm), nt('b.str', STR)], true)
    expect(c.ok && c.pair.matchedBy).toBe('user')
  })

  it('nama referensi salah dilaporkan spesifik', () => {
    const r = pairSurpacFiles([nt('topo.dtm', DTM), nt('lain.str', STR)])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.issues[0]!.code).toBe('SURPAC_REFERENCE_MISMATCH')
      expect(r.issues[0]!.message).toMatch(/topo\.str/)
    }
  })

  it('STR hilang → "Pilih STR pasangan"', () => {
    const r = pairSurpacFiles([nt('topo.dtm', DTM)])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues[0]!.message).toMatch(/Pilih STR pasangan/)
  })

  it('DTM hilang dan jumlah berkas salah', () => {
    const r1 = pairSurpacFiles([nt('topo.str', STR)])
    expect(!r1.ok && r1.issues[0]!.code).toBe('SURPAC_DTM_MISSING')
    const r2 = pairSurpacFiles([nt('a.dtm', DTM), nt('b.dtm', DTM), nt('a.str', STR)])
    expect(!r2.ok && r2.issues[0]!.code).toBe('SURPAC_PAIR_COUNT')
  })
})

describe('deteksi varian (struktur, tanpa menafsirkan geometri)', () => {
  it('mengenali header, record sumbu, OBJECT/TRISOLATION, record kontrol dan END', () => {
    const r = pairSurpacFiles([nt('topo.dtm', DTM), nt('topo.str', STR)])
    if (!r.ok) throw new Error()
    const v = detectSurpacVariant(r.pair)
    expect(v).toMatchObject({
      encoding: 'text', strReference: 'topo.str', objects: 1, trisolations: 1, triangleRecords: 1,
      strAxisRecord: true, strRecords: 3, strSeparators: 1, strEnd: true,
    })
  })

  it('record kontrol (sumbu/pemisah/END) tidak dihitung sebagai titik', () => {
    const r = pairSurpacFiles([nt('topo.dtm', DTM), nt('topo.str', STR)])
    if (!r.ok) throw new Error()
    expect(detectSurpacVariant(r.pair).strRecords).toBe(3)
  })

  it('varian biner belum didukung → pesan pemulihan spesifik', () => {
    const bin: NamedText = { name: 'topo.dtm', text: '', bytes: Uint8Array.from([0x44, 0x00, 0x01, 0x02, 0x00]) }
    expect(looksBinary(bin.bytes)).toBe(true)
    const r = pairSurpacFiles([bin, nt('topo.str', STR)])
    // header biner tidak dibaca sebagai referensi → pasangan via nama dasar
    if (!r.ok) throw new Error(r.issues[0]!.message)
    const issues = surpacStructureIssues(r.pair, detectSurpacVariant(r.pair))
    expect(issues[0]!.code).toBe('SURPAC_BINARY_UNSUPPORTED')
    expect(issues[0]!.message).toMatch(/format teks/)
  })

  it('struktur DTM tidak dikenali dilaporkan', () => {
    const r = pairSurpacFiles([nt('topo.dtm', 'topo.str,x\nhalo\n'), nt('topo.str', STR)])
    if (!r.ok) throw new Error()
    const codes = surpacStructureIssues(r.pair, detectSurpacVariant(r.pair)).map((i) => i.code)
    expect(codes).toContain('SURPAC_DTM_STRUCTURE')
  })

  it('STR tanpa record sumbu dilaporkan', () => {
    const noAxis = STR.split('\n').filter((_, i) => i !== 1).join('\n')
    const r = pairSurpacFiles([nt('topo.dtm', DTM), nt('topo.str', noAxis)])
    if (!r.ok) throw new Error()
    expect(surpacStructureIssues(r.pair, detectSurpacVariant(r.pair)).map((i) => i.code)).toContain('SURPAC_STR_STRUCTURE')
  })
})

const X = loadExpected()

function surpacFixture(): NamedText[] {
  return ['bench.dtm', 'bench.str'].map((n) => ({ name: n, text: readFixtureText(`surpac/${n}`), bytes: readFixtureBytes(`surpac/${n}`) }))
}

async function parse(files: NamedText[]) {
  const p = pairSurpacFiles(files)
  if (!p.ok) throw new Error(p.issues[0]!.message)
  return parseSurpacPair(p.pair, { yieldFn: async () => {} })
}

function triangleSet(m: Mesh): string[] {
  const out: string[] = []
  for (let t = 0; t < m.triangles.length; t += 3) {
    const vs = [0, 1, 2].map((k) => {
      const i = m.triangles[t + k]! * 3
      return `${m.xyz[i]},${m.xyz[i + 1]},${m.xyz[i + 2]}`
    })
    out.push(vs.sort().join('|'))
  }
  return out.sort()
}

describe('impor DTM/STR varian teks terverifikasi', () => {
  it('fixture sintetis: mesh identik dengan bench_3dface.dxf (pembanding independen)', async () => {
    const r = await parse(surpacFixture())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const dxf = parseDxf(readFixtureText('bench_3dface.dxf'), 'bench_3dface.dxf')
    if (!dxf.ok) throw new Error()
    const c = r.candidates[0]!
    expect(r.candidates.map((x) => x.layer)).toEqual(['OBJECT 1 / TRISOLATION 1'])
    expect(c.mesh.triangles.length / 3).toBe(X.bench.triangle_count)
    expect(c.mesh.xyz.length / 3).toBe(X.bench.unique_vertex_count)
    expect(c.rejectedFaces).toBe(0)
    expect(triangleSet(c.mesh)).toEqual(triangleSet(dxf.candidates[0]!.mesh))
    const [mn, mx] = X.bench.bounds_ENZ
    expect([c.bounds.min.e, c.bounds.min.n, c.bounds.min.z]).toEqual(mn)
    expect([c.bounds.max.e, c.bounds.max.n, c.bounds.max.z]).toEqual(mx)
  })

  it('fixture sintetis: profil A–B sesuai titik patah expected.json', async () => {
    const r = await parse(surpacFixture())
    if (!r.ok) throw new Error()
    const m = r.candidates[0]!.mesh
    const prof = sliceSurface(m, buildMeshIndex(m), { a: { e: X.a[0], n: X.a[1] }, b: { e: X.b[0], n: X.b[1] } })
    expect(prof.parts.length).toBe(1)
    for (const [s, z] of X.bench.required_breakpoints_s_z) expect(Math.abs(profileZAt(prof, s)! - z)).toBeLessThanOrEqual(X.tolerance_m)
  })

  it('STR dibaca sebagai string, Y (northing), X (easting), Z — tanpa penukaran otomatis', async () => {
    const r = await parse([nt('topo.dtm', DTM), nt('topo.str', STR)])
    if (!r.ok) throw new Error()
    const b = r.candidates[0]!.bounds
    expect([b.min.e, b.max.e]).toEqual([700000, 700020])
    expect([b.min.n, b.max.n]).toEqual([9099980, 9100020])
    expect(r.units.kind).toBe('unitless')
  })

  it('pemisah ikut dinomori: indeks setelah pemisah menunjuk titik berikutnya', async () => {
    const str = ['h', '0, 0, 0, 0, 0, 0, 0', '1, 0, 0, 1,', '1, 0, 10, 1,', '0, 0, 0, 0,', '2, 10, 0, 1,', '0, 0, 0, 0, END'].join('\n')
    const dtm = ['t.str,x', 'OBJECT, 1,', 'TRISOLATION, 1, neighbours=no', '1, 1, 2, 4,', 'END'].join('\n')
    const r = await parse([nt('t.dtm', dtm), nt('t.str', str)])
    if (!r.ok) throw new Error(r.issues[0]!.message)
    const b = r.candidates[0]!.bounds
    expect([b.min.e, b.max.e, b.min.n, b.max.n]).toEqual([0, 10, 0, 10])
  })

  it('indeks putus: merujuk pemisah atau di luar rentang → segitiga ditolak dengan pesan spesifik', async () => {
    const dtm = ['topo.str,x', 'OBJECT, 1,', 'TRISOLATION, 1, neighbours=no', '1, 1, 2, 3,', '2, 1, 2, 4,', '3, 1, 2, 99,', 'END'].join('\n')
    const r = await parse([nt('topo.dtm', dtm), nt('topo.str', STR)])
    if (!r.ok) throw new Error()
    const c = r.candidates[0]!
    expect(c.mesh.triangles.length / 3).toBe(1)
    expect(c.rejectedFaces).toBe(2)
    const codes = r.issues.map((i) => i.code)
    expect(codes).toContain('SURPAC_INDEX_REFERS_CONTROL')
    expect(codes).toContain('SURPAC_INDEX_OUT_OF_RANGE')
    expect(r.issues.find((i) => i.code === 'SURPAC_INDEX_OUT_OF_RANGE')!.location?.faceId).toBe('3')
  })

  it('tidak ada segitiga yang terpetakan → kesalahan fatal', async () => {
    const dtm = ['topo.str,x', 'OBJECT, 1,', 'TRISOLATION, 1, neighbours=no', '1, 4, 5, 6,', 'END'].join('\n')
    const r = await parse([nt('topo.dtm', dtm), nt('topo.str', STR)])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues[0]!.code).toBe('SURPAC_NO_VALID_TRIANGLES')
  })

  it('beberapa OBJECT/TRISOLATION → beberapa kandidat untuk dipilih', async () => {
    const str = ['h', '0, 0, 0, 0, 0, 0, 0', '1, 0, 0, 1,', '1, 0, 10, 1,', '1, 10, 0, 1,', '1, 0, 0, 5,', '1, 0, 10, 5,', '1, 10, 0, 5,', '0, 0, 0, 0, END'].join('\n')
    const dtm = ['t.str,x', 'OBJECT, 1,', 'TRISOLATION, 1, neighbours=no', '1, 1, 2, 3,', 'OBJECT, 2,', 'TRISOLATION, 1, neighbours=no', '1, 4, 5, 6,', 'END'].join('\n')
    const r = await parse([nt('t.dtm', dtm), nt('t.str', str)])
    if (!r.ok) throw new Error()
    expect(r.candidates.map((c) => c.layer).sort()).toEqual(['OBJECT 1 / TRISOLATION 1', 'OBJECT 2 / TRISOLATION 1'])
  })

  it('blok titik di awal DTM diabaikan dan dicatat', async () => {
    const r = await parse(surpacFixture())
    if (!r.ok) throw new Error()
    expect(r.issues.some((i) => i.code === 'SURPAC_DTM_POINT_BLOCK')).toBe(true)
  })

  it('pembatalan saat diproses per batch', async () => {
    const p = pairSurpacFiles(surpacFixture())
    if (!p.ok) throw new Error()
    const ctl = new AbortController()
    ctl.abort()
    await expect(parseSurpacPair(p.pair, { signal: ctl.signal, batchLines: 2, yieldFn: async () => {} })).rejects.toThrow(/dibatalkan/i)
  })
})

describe('batas ukuran per anggota pasangan dan pintu impor', () => {
  it('dua berkas masing-masing tepat 25.000.000 byte dibaca dan diurai', async () => {
    const d = fakeFile('topo.dtm', 25_000_000, DTM)
    const s = fakeFile('topo.str', 25_000_000, STR)
    const r = await openSurfaceFiles([d, s], { yieldFn: async () => {} })
    expect(d.reads).toBe(1)
    expect(s.reads).toBe(1)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.format).toBe('surpac')
  })

  it('satu anggota 25.000.001 byte → keduanya tidak dibaca', async () => {
    const d = fakeFile('topo.dtm', 25_000_000, DTM)
    const s = fakeFile('topo.str', 25_000_001, STR)
    const r = await openSurfaceFiles([d, s])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues[0]!.code).toBe('SURFACE_TOO_LARGE')
    expect(d.reads).toBe(0)
    expect(s.reads).toBe(0)
  })
})

describe('pembandingan terhadap Surpac (M8, butuh data kontrol site)', () => {
  it.todo('jumlah segitiga, batas E/N/Z, tiga kontrol dan satu penampang sesuai Surpac')
})
