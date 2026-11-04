/**
 * M3 — Surpac DTM/STR. Tes di berkas ini memisahkan:
 *  (a) deteksi/pemasangan/error yang SUDAH dapat diuji tanpa sampel Surpac, dan
 *  (b) jalur impor geometri yang BELUM terbukti (it.todo, SURPAC_SITE_PENDING).
 * Teks DTM/STR di bawah adalah struktur sintetis mengikuti tata letak teks umum
 * (header, record sumbu, OBJECT/TRISOLATION, END); BUKAN ekspor Surpac terverifikasi.
 */
import { describe, expect, it } from 'vitest'
import { detectSurpacVariant, dtmStrReference, looksBinary, pairSurpacFiles, surpacImportIssues, SURPAC_SITE_PENDING } from '../../src/import/surpac'
import type { NamedText } from '../../src/import/surpac'
import { openSurfaceFiles } from '../../src/import/open-surface'
import { fakeFile } from './helpers'

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
    const issues = surpacImportIssues(r.pair, detectSurpacVariant(r.pair))
    expect(issues[0]!.code).toBe('SURPAC_BINARY_UNSUPPORTED')
    expect(issues[0]!.message).toMatch(/Ekspor kembali sebagai DXF muka segitiga dari Surpac/)
  })

  it('struktur DTM tidak dikenali dilaporkan', () => {
    const r = pairSurpacFiles([nt('topo.dtm', 'topo.str,x\nhalo\n'), nt('topo.str', STR)])
    if (!r.ok) throw new Error()
    const codes = surpacImportIssues(r.pair, detectSurpacVariant(r.pair)).map((i) => i.code)
    expect(codes).toContain('SURPAC_DTM_STRUCTURE')
  })

  it('jalur impor geometri ditandai SURPAC_SITE_PENDING (belum terbukti)', () => {
    const r = pairSurpacFiles([nt('topo.dtm', DTM), nt('topo.str', STR)])
    if (!r.ok) throw new Error()
    const issues = surpacImportIssues(r.pair, detectSurpacVariant(r.pair))
    expect(issues.at(-1)!.code).toBe(SURPAC_SITE_PENDING)
    expect(issues.at(-1)!.severity).toBe('error')
  })
})

describe('batas ukuran per anggota pasangan', () => {
  it('dua berkas masing-masing tepat 25.000.000 byte dibaca', async () => {
    const d = fakeFile('topo.dtm', 25_000_000, DTM)
    const s = fakeFile('topo.str', 25_000_000, STR)
    const r = await openSurfaceFiles([d, s])
    expect(d.reads).toBe(1)
    expect(s.reads).toBe(1)
    expect(r.ok).toBe(false) // jalur impor masih pending
    if (!r.ok) expect(r.issues.at(-1)!.code).toBe(SURPAC_SITE_PENDING)
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

describe('jalur impor DTM/STR → mesh (SURPAC_SITE_PENDING)', () => {
  it.todo('adapter varian terverifikasi menghasilkan mesh setara DXF dari surface yang sama')
  it.todo('indeks segitiga putus → pesan spesifik')
  it.todo('E/N tertukar terdeteksi melalui titik kontrol site, bukan ditukar otomatis')
  it.todo('jumlah segitiga, batas E/N/Z, tiga kontrol dan satu penampang sesuai Surpac (M8)')
})
