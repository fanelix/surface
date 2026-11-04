import { describe, expect, it } from 'vitest'
import { parseDxf, parseDxfAsync } from '../../src/import/dxf'
import type { DxfParseOk } from '../../src/import/dxf'
import { MAX_SURFACE_BYTES, checkSurfaceSize, readSurfaceFile } from '../../src/import/surface'
import type { Mesh } from '../../src/domain/types'
import { fakeFile, loadExpected, readFixtureText } from './helpers'

const X = loadExpected()

function ok(text: string, name = 'x.dxf'): DxfParseOk {
  const r = parseDxf(text, name)
  if (!r.ok) throw new Error('parse gagal: ' + r.issues.map((i) => i.code + ' ' + i.message).join('; '))
  return r
}

/** Kunci segitiga independen urutan vertex. */
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

function uniqueVertexCount(m: Mesh): number {
  const s = new Set<string>()
  for (let i = 0; i < m.xyz.length; i += 3) s.add(`${m.xyz[i]},${m.xyz[i + 1]},${m.xyz[i + 2]}`)
  return s.size
}

/** Bangun teks DXF ASCII minimal dari pasangan [kode, nilai]. */
function dxf(entities: [number, string | number][][], header: [number, string | number][] = []): string {
  const pairs: [number, string | number][] = [
    [0, 'SECTION'], [2, 'HEADER'], ...header, [0, 'ENDSEC'],
    [0, 'SECTION'], [2, 'ENTITIES'],
    ...entities.flat(),
    [0, 'ENDSEC'], [0, 'EOF'],
  ]
  return pairs.map(([c, v]) => `${String(c).padStart(3)}\n${v}`).join('\n') + '\n'
}

function face3(layer: string, pts: number[][], handle = '1'): [number, string | number][] {
  const out: [number, string | number][] = [[0, '3DFACE'], [5, handle], [8, layer]]
  pts.forEach((p, i) => {
    out.push([10 + i, p[0]!], [20 + i, p[1]!], [30 + i, p[2]!])
  })
  return out
}

describe('batas ukuran surface (sebelum membaca isi)', () => {
  it('konstanta 25.000.000 byte', () => {
    expect(MAX_SURFACE_BYTES).toBe(25_000_000)
  })

  for (const [size, accepted] of [
    [24_999_999, true],
    [25_000_000, true],
    [25_000_001, false],
  ] as const) {
    it(`${size} byte → ${accepted ? 'diterima' : 'ditolak tanpa dibaca'}`, async () => {
      const f = fakeFile('s.dxf', size, '')
      expect(checkSurfaceSize(f) === null).toBe(accepted)
      const r = await readSurfaceFile(f)
      if (accepted) {
        expect(f.reads).toBe(1)
      } else {
        expect(r.ok).toBe(false)
        expect(f.reads).toBe(0)
        if (!r.ok) expect(r.issues[0]!.code).toBe('SURFACE_TOO_LARGE')
      }
    })
  }

  it('ukuran byte aktual juga diperiksa setelah dibaca', async () => {
    const f = { name: 'bohong.dxf', size: 10, text: async () => '', arrayBuffer: async () => new ArrayBuffer(MAX_SURFACE_BYTES + 1) }
    const r = await readSurfaceFile(f)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues[0]!.code).toBe('SURFACE_TOO_LARGE')
  })

  it('berkas kosong ditolak', async () => {
    const r = await readSurfaceFile(fakeFile('kosong.dxf', 0, ''))
    expect(r.ok).toBe(false)
  })
})

describe('fixture DXF acuan', () => {
  const face = ok(readFixtureText('bench_3dface.dxf'), 'bench_3dface.dxf')
  const poly = ok(readFixtureText('bench_polyface.dxf'), 'bench_polyface.dxf')
  const gap = ok(readFixtureText('gap_3dface.dxf'), 'gap_3dface.dxf')

  it('satu kandidat layer TOPO per berkas', () => {
    for (const r of [face, poly, gap]) {
      expect(r.candidates.map((c) => c.layer)).toEqual(['TOPO'])
    }
  })

  for (const [label, r] of [['3DFACE', face], ['POLYFACE', poly]] as const) {
    it(`${label}: 10 segitiga, 12 vertex unik, bounds dan indeks valid`, () => {
      const c = r.candidates[0]!
      expect(c.mesh.triangles.length / 3).toBe(X.bench.triangle_count)
      expect(uniqueVertexCount(c.mesh)).toBe(X.bench.unique_vertex_count)
      expect(c.mesh.xyz.length / 3).toBe(X.bench.unique_vertex_count)
      const [mn, mx] = X.bench.bounds_ENZ
      expect([c.bounds.min.e, c.bounds.min.n, c.bounds.min.z]).toEqual(mn)
      expect([c.bounds.max.e, c.bounds.max.n, c.bounds.max.z]).toEqual(mx)
      const nV = c.mesh.xyz.length / 3
      for (const i of c.mesh.triangles) expect(i).toBeLessThan(nV)
      expect(c.rejectedFaces).toBe(0)
    })
  }

  it('3DFACE dan POLYFACE menghasilkan mesh yang setara (abaikan urutan)', () => {
    expect(triangleSet(poly.candidates[0]!.mesh)).toEqual(triangleSet(face.candidates[0]!.mesh))
  })

  it('POLYFACE: indeks bertanda negatif (sisi tersembunyi) dibaca sebagai nilai absolut', () => {
    expect(poly.candidates[0]!.sourceCounts.POLYFACE).toBe(1)
    expect(poly.candidates[0]!.mesh.triangles.length / 3).toBe(10)
  })

  it('file celah menghasilkan 8 segitiga', () => {
    expect(gap.candidates[0]!.mesh.triangles.length / 3).toBe(X.gap.triangle_count)
  })

  it('DXF R12 tanpa $INSUNITS ditandai tanpa unit (perlu konfirmasi meter)', () => {
    expect(face.version).toBe('AC1009')
    expect(face.units.kind).toBe('unitless')
  })

  it('semua segitiga berorientasi CCW di bidang E/N (normal ke atas)', () => {
    const m = face.candidates[0]!.mesh
    for (let t = 0; t < m.triangles.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => m.triangles[t + k]! * 3) as [number, number, number]
      const cross = (m.xyz[b]! - m.xyz[a]!) * (m.xyz[c + 1]! - m.xyz[a + 1]!) - (m.xyz[b + 1]! - m.xyz[a + 1]!) * (m.xyz[c]! - m.xyz[a]!)
      expect(cross).toBeGreaterThan(0)
    }
  })

  it('jalur async dengan progres menghasilkan hasil yang sama', async () => {
    const progress: number[] = []
    const r = await parseDxfAsync(readFixtureText('bench_polyface.dxf'), 'p.dxf', { onProgress: (f) => progress.push(f), batchPairs: 50 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(triangleSet(r.candidates[0]!.mesh)).toEqual(triangleSet(face.candidates[0]!.mesh))
    expect(progress.length).toBeGreaterThan(1)
  })

  it('jalur async dapat dibatalkan', async () => {
    const ctl = new AbortController()
    ctl.abort()
    await expect(parseDxfAsync(readFixtureText('bench_3dface.dxf'), 'p.dxf', { signal: ctl.signal, batchPairs: 10 })).rejects.toThrow(/dibatalkan/i)
  })
})

describe('DXF tidak valid atau di luar cakupan', () => {
  it('DXF biner ditolak dengan pesan spesifik', () => {
    const r = parseDxf('AutoCAD Binary DXF\r\n\u001a\u0000xxxx', 'bin.dxf')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues[0]!.code).toBe('DXF_BINARY')
  })

  it('isi bukan DXF (label salah) ditolak', () => {
    const r = parseDxf('name,easting,northing\nP1,1,2\n', 'titik.dxf')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues[0]!.code).toBe('DXF_NOT_DXF')
  })

  it('kode grup bukan angka adalah cacat struktural fatal', () => {
    const r = parseDxf('  0\nSECTION\n  2\nENTITIES\nabc\n3DFACE\n  0\nEOF\n', 'rusak.dxf')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.issues[0]!.code).toBe('DXF_STRUCTURE')
      expect(r.issues[0]!.location?.line).toBe(5)
    }
  })

  it('hanya kontur: tidak membentuk TIN, pesan spesifik', () => {
    const text = dxf([
      [[0, 'LWPOLYLINE'], [8, 'KONTUR'], [90, 2], [38, 120], [10, 0], [20, 0], [10, 10], [20, 0]],
      [[0, 'LINE'], [8, 'KONTUR'], [10, 0], [20, 0], [30, 1], [11, 1], [21, 1], [31, 1]],
    ])
    const r = parseDxf(text, 'kontur.dxf')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues[0]!.code).toBe('DXF_CONTOURS_ONLY')
  })

  it('tanpa entitas sama sekali', () => {
    const r = parseDxf(dxf([]), 'kosong.dxf')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues[0]!.code).toBe('DXF_NO_ENTITIES')
  })

  it('beberapa layer menghasilkan beberapa kandidat untuk dipilih', () => {
    const r = ok(dxf([
      face3('TOPO', [[0, 0, 1], [1, 0, 1], [0, 1, 1], [0, 1, 1]]),
      face3('DESAIN', [[0, 0, 2], [1, 0, 2], [0, 1, 2], [0, 1, 2]]),
    ]))
    expect(r.candidates.map((c) => c.layer).sort()).toEqual(['DESAIN', 'TOPO'])
  })

  it('muka empat vertex berbeda dilaporkan dan dikeluarkan', () => {
    const r = ok(dxf([
      face3('T', [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], 'A1'),
      face3('T', [[0, 0, 1], [1, 0, 1], [0, 1, 1], [0, 1, 1]], 'A2'),
    ]))
    const c = r.candidates[0]!
    expect(c.mesh.triangles.length).toBe(3)
    expect(c.rejectedFaces).toBe(1)
    const q = r.issues.find((i) => i.code === 'FACE_QUAD_UNSUPPORTED')!
    expect(q.location?.faceId).toBe('A1')
    expect(q.location?.layer).toBe('T')
    expect(q.location?.line).toBeGreaterThan(0)
  })

  it('vertex non-finite dan segitiga rusak tidak masuk hitungan', () => {
    const r = ok(dxf([
      face3('T', [[0, 0, 1], [1, 0, 1], [0, 1, 1], [0, 1, 1]], 'OK'),
      face3('T', [[0, 0, 1], [1, 0, 'nan' as unknown as number], [0, 1, 1], [0, 1, 1]], 'NF'),
      face3('T', [[0, 0, 1], [0, 0, 1], [0, 1, 1], [0, 1, 1]], 'DG'),
      face3('T', [[0, 0, 1], [1, 1, 2], [2, 2, 3], [2, 2, 3]], 'COL'),
    ]))
    expect(r.candidates[0]!.mesh.triangles.length).toBe(3)
    expect(r.candidates[0]!.rejectedFaces).toBe(3)
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['FACE_NONFINITE', 'FACE_DEGENERATE']))
  })

  it('segitiga vertikal dipertahankan di mesh tetapi ditandai', () => {
    const r = ok(dxf([
      face3('T', [[0, 0, 1], [1, 0, 1], [0, 1, 1], [0, 1, 1]], 'OK'),
      face3('T', [[0, 0, 1], [1, 0, 1], [1, 0, 5], [1, 0, 5]], 'V'),
    ]))
    expect(r.candidates[0]!.mesh.triangles.length).toBe(6)
    expect(r.candidates[0]!.verticalFaces).toBe(1)
    expect(r.issues.find((i) => i.code === 'FACE_VERTICAL')?.location?.faceId).toBe('V')
  })

  it('POLYFACE dengan indeks di luar rentang: muka itu ditolak, sisanya dipakai', () => {
    const v = (x: number, y: number, z: number): [number, string | number][] => [[0, 'VERTEX'], [8, 'P'], [10, x], [20, y], [30, z], [70, 192]]
    const f = (a: number, b: number, c: number): [number, string | number][] => [[0, 'VERTEX'], [8, 'P'], [10, 0], [20, 0], [30, 0], [70, 128], [71, a], [72, b], [73, c]]
    const r = ok(dxf([
      [[0, 'POLYLINE'], [8, 'P'], [66, 1], [70, 64], [71, 3], [72, 2]],
      v(0, 0, 1), v(1, 0, 1), v(0, 1, 1),
      f(1, 2, 3), f(1, 2, 9),
      [[0, 'SEQEND'], [8, 'P']],
    ]))
    expect(r.candidates[0]!.mesh.triangles.length).toBe(3)
    expect(r.issues.some((i) => i.code === 'FACE_INDEX_OUT_OF_RANGE')).toBe(true)
  })

  it('POLYLINE mesh M×N (bit 16) dilaporkan tidak didukung', () => {
    const r = parseDxf(dxf([[[0, 'POLYLINE'], [8, 'M'], [66, 1], [70, 16]], [[0, 'SEQEND']]]), 'm.dxf')
    const codes = r.issues.map((i) => i.code)
    expect(codes).toContain('POLYGON_MESH_UNSUPPORTED')
  })

  it('$INSUNITS=6 dibaca sebagai meter; satuan lain diperingatkan', () => {
    const body = [face3('T', [[0, 0, 1], [1, 0, 1], [0, 1, 1], [0, 1, 1]])]
    expect(ok(dxf(body, [[9, '$INSUNITS'], [70, 6]])).units.kind).toBe('meters')
    const ft = ok(dxf(body, [[9, '$INSUNITS'], [70, 2]]))
    expect(ft.units.kind).toBe('other')
    expect(ft.issues.some((i) => i.code === 'UNITS_NOT_METERS')).toBe(true)
  })

  it('CRLF dan spasi di sekitar nilai diterima', () => {
    const text = readFixtureText('bench_3dface.dxf').replace(/\n/g, '\r\n')
    expect(ok(text).candidates[0]!.mesh.triangles.length).toBe(30)
  })
})
