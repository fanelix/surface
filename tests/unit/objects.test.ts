import { describe, expect, it } from 'vitest'
import type { Section } from '../../src/domain/types'
import { nameKey, parseCsv, parseNumber, previewCsv, validateBorehole, validatePoint } from '../../src/import/objects'
import { projectObjects } from '../../src/domain/section-objects'
import { reverseSection } from '../../src/geometry/section'
import { loadExpected, readFixtureText } from './helpers'

const X = loadExpected()
const SEC: Section = { a: { e: X.a[0], n: X.a[1] }, b: { e: X.b[0], n: X.b[1] } }
const none = new Set<string>()

describe('CSV fixture', () => {
  const pts = previewCsv(readFixtureText('points.csv'), 'point', none)
  const bhs = previewCsv(readFixtureText('boreholes.csv'), 'borehole', none)

  it('points.csv: 5 diterima; boreholes.csv: 4 diterima; total 9', () => {
    expect(pts.fatal).toBeNull()
    expect(pts.accepted.map((p) => p.name)).toEqual(['P-01', 'P-02', 'P-03', 'P-04', 'P-05'])
    expect(bhs.accepted.map((b) => b.name)).toEqual(['BH-01', 'BH-02', 'BH-03', 'BH-04'])
    expect(pts.accepted.length + bhs.accepted.length).toBe(X.all_count)
    expect(pts.delimiter).toBe(',')
  })

  it('points_invalid.csv: baris 2 diterima; 3, 4, 5 ditolak dengan alasan', () => {
    const r = previewCsv(readFixtureText('points_invalid.csv'), 'point', none)
    expect(r.rows.filter((x) => x.status === 'accepted').map((x) => x.line)).toEqual(X.points_invalid.accepted_rows)
    const rej = r.rows.filter((x) => x.status === 'rejected')
    expect(rej.map((x) => x.line)).toEqual(X.points_invalid.rejected_rows)
    expect(rej[0]!.reasons.join()).toMatch(/Northing kosong/)
    expect(rej[1]!.reasons.join()).toMatch(/duplikat/)
    expect(rej[2]!.reasons.join()).toMatch(/Elevation "NaN" bukan angka/)
  })

  it('proyeksi seluruh objek: filter mati = 9, koridor ±5 m = 6 dengan ID sesuai expected.json', () => {
    const all = projectObjects(pts.accepted, bhs.accepted, SEC, { enabled: false, halfWidth: 5 })
    expect(all.shownCount).toBe(9)
    const cor = projectObjects(pts.accepted, bhs.accepted, SEC, { enabled: true, halfWidth: 5 })
    expect(cor.shownCount).toBe(6)
    expect(cor.rows.filter((r) => r.visible).map((r) => r.name).sort()).toEqual([...X.corridor_half_width_5m].sort())
    expect(cor.validCount).toBe(9)
  })

  it('extent memuat objek di luar A–B (P-02 s=−10, P-03/BH-04 s=110) dan toe BH-01', () => {
    const all = projectObjects(pts.accepted, bhs.accepted, SEC, { enabled: false, halfWidth: 0 })
    expect(all.extent!.sMin).toBeCloseTo(-10, 9)
    expect(all.extent!.sMax).toBeCloseTo(110, 9)
    expect(all.extent!.zMin).toBeCloseTo(99.35898384862246, 9)
    const p02 = all.rows.find((r) => r.name === 'P-02')!
    expect(p02.kind === 'point' && p02.onAB).toBe(false)
  })

  it('balik A/B memperbarui semua proyeksi bersama', () => {
    const r = projectObjects(pts.accepted, bhs.accepted, reverseSection(SEC), { enabled: false, halfWidth: 0 })
    const p01 = r.rows.find((x) => x.name === 'P-01')!
    if (p01.kind !== 'point') throw new Error()
    expect(p01.p.s).toBeCloseTo(70, 9)
    expect(p01.p.o).toBeCloseTo(10, 9)
    const bh1 = r.rows.find((x) => x.name === 'BH-01')!
    if (bh1.kind !== 'borehole' || bh1.hit.kind !== 'cross') throw new Error()
    expect(bh1.collar.o).toBeCloseTo(-12, 9)
    expect(bh1.hit.md).toBeCloseTo(24, 9)
  })

  it('reimpor berkas yang sama tidak menciptakan duplikat', () => {
    const existing = new Set(pts.accepted.map((p) => nameKey(p.name)))
    const again = previewCsv(readFixtureText('points.csv'), 'point', existing)
    expect(again.accepted).toEqual([])
    expect(again.rows.every((r) => r.status === 'rejected' && /sudah ada/.test(r.reasons[0]!))).toBe(true)
  })

  it('nama sama antara titik dan bor diizinkan', () => {
    const csvP = 'nama,easting,northing,elevasi\nX-1,1,2,3\n'
    const csvB = 'nama,easting,northing,elevasi,md,azimuth,dip\nX-1,1,2,3,10,0,-90\n'
    const p = previewCsv(csvP, 'point', none)
    const b = previewCsv(csvB, 'borehole', new Set()) // set nama bor terpisah dari titik
    expect(p.accepted.length).toBe(1)
    expect(b.accepted.length).toBe(1)
    expect(p.accepted[0]!.id).not.toBe(b.accepted[0]!.id)
  })
})

describe('validasi CSV dan formulir', () => {
  it('nama duplikat dalam satu batch (beda kapitalisasi/spasi) ditolak; baris valid pertama dipakai', () => {
    const r = previewCsv('name,easting,northing,elevation\nA-1,1,1,1\n a-1 ,2,2,2\n', 'point', none)
    expect(r.accepted.length).toBe(1)
    expect(r.accepted[0]!.e).toBe(1)
    expect(r.rows[1]!.status).toBe('rejected')
  })

  it('baris tidak valid tidak memblokir nama yang sama di baris valid berikutnya', () => {
    const r = previewCsv('name,easting,northing,elevation\nA,1,,1\nA,1,1,1\n', 'point', none)
    expect(r.rows.map((x) => x.status)).toEqual(['rejected', 'accepted'])
  })

  it('Z=0 diterima; NaN dan Infinity ditolak; angka nol awal pada nama dipertahankan', () => {
    const r = previewCsv('name,easting,northing,elevation\n007,1,1,0\nB,1,1,NaN\nC,1,1,Infinity\n', 'point', none)
    expect(r.accepted.map((p) => [p.name, p.z])).toEqual([['007', 0]])
    expect(r.rows.filter((x) => x.status === 'rejected').length).toBe(2)
  })

  it('kedalaman negatif/nol, dip dan azimuth di luar rentang ditolak; 360° disimpan sebagai 0°', () => {
    const csv = [
      'name,easting,northing,elevation,depth,azimuth,dip',
      'D1,0,0,0,-5,0,-90',
      'D2,0,0,0,0,0,-90',
      'D3,0,0,0,10,361,-60',
      'D4,0,0,0,10,10,-91',
      'D5,0,0,0,10,360,-45',
    ].join('\n')
    const r = previewCsv(csv, 'borehole', none)
    expect(r.rows.map((x) => x.status)).toEqual(['rejected', 'rejected', 'rejected', 'rejected', 'accepted'])
    expect(r.accepted[0]!.azDeg).toBe(0)
    expect(r.rows[0]!.reasons[0]).toMatch(/> 0/)
  })

  it('konvensi dip "positif ke bawah" membalik tanda seluruh batch tepat sekali', () => {
    const csv = 'name,easting,northing,elevation,depth,azimuth,dip\nB1,0,0,0,10,0,60\nB2,0,0,0,10,0,-30\n'
    const r = previewCsv(csv, 'borehole', none, { dip: 'positive-down' })
    expect(r.accepted.map((b) => b.dipDeg)).toEqual([-60, 30])
    expect(r.dip).toBe('positive-down')
  })

  it('koma desimal Indonesia diterima bila pemisah titik koma; header Indonesia bebas urutan', () => {
    const csv = 'Elevasi (m);Nama Titik;Northing;Easting\n128,5;P-ID;9100000,25;700030,75\n'
    const r = previewCsv(csv, 'point', none)
    expect(r.delimiter).toBe(';')
    expect(r.decimalComma).toBe(true)
    expect(r.accepted[0]).toMatchObject({ name: 'P-ID', e: 700030.75, n: 9100000.25, z: 128.5 })
  })

  it('koma desimal ambigu ditolak bila pemisah koma', () => {
    const r = previewCsv('name,easting,northing,elevation\nQ,"700030,5",9100000,1\n', 'point', none)
    expect(r.accepted).toEqual([])
    expect(r.rows[0]!.reasons[0]).toMatch(/ambigu/)
  })

  it('UTF-8 BOM dan nilai berpetik (termasuk "" dan koma di nama) dibaca benar', () => {
    const csv = '\uFEFF"name","easting","northing","elevation"\r\n"Bor ""A"", utara",700000,9100000,"12.5"\r\n'
    const r = previewCsv(csv, 'point', none)
    expect(r.bom).toBe(true)
    expect(r.accepted[0]!.name).toBe('Bor "A", utara')
    expect(r.accepted[0]!.z).toBe(12.5)
  })

  it('kolom wajib hilang → kesalahan fatal tanpa baris diterapkan', () => {
    const r = previewCsv('name,easting,elevation\nA,1,1\n', 'point', none)
    expect(r.fatal?.code).toBe('CSV_MISSING_COLUMNS')
    expect(r.accepted).toEqual([])
  })

  it('formulir memakai fungsi validasi yang sama (angka atau teks)', () => {
    expect(validatePoint({ name: '  T-1 ', easting: '700000', northing: 9100000, elevation: '0' }, { decimalComma: true })).toMatchObject({ ok: true, value: { name: 'T-1', z: 0 } })
    expect(validatePoint({ name: '', easting: 'x', northing: 1, elevation: 1 }, { decimalComma: true }).ok).toBe(false)
    const b = validateBorehole({ name: 'B', easting: 1, northing: 2, elevation: 3, depth: '12,5', azimuth: 360, dip: -90 }, { decimalComma: true })
    expect(b.ok && b.value.md).toBe(12.5)
    expect(b.ok && b.value.azDeg).toBe(0)
  })

  it('parseNumber ketat', () => {
    expect(parseNumber('1e3', { decimalComma: false })).toEqual({ ok: true, value: 1000 })
    expect(parseNumber('1.000,5', { decimalComma: true }).ok).toBe(false)
    expect(parseNumber('12abc', { decimalComma: false }).ok).toBe(false)
    expect(parseNumber('  -3.5 ', { decimalComma: false })).toEqual({ ok: true, value: -3.5 })
  })

  it('baris kosong dilewati dan nomor baris fisik dipertahankan', () => {
    const t = parseCsv('a,b\n\n1,2\n')
    expect(t.rows).toEqual([{ line: 3, cells: ['1', '2'] }])
  })
})
