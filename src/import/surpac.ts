/**
 * Pasangan Surpac DTM/STR — M3 PARSIAL.
 *
 * Status: SURPAC_SITE_PENDING. Belum ada sampel site atau ekspor uji dari Surpac yang
 * terverifikasi, sehingga modul ini hanya:
 *  - memasangkan .dtm + .str (bebas urutan, kapitalisasi, referensi STR di header DTM),
 *  - memeriksa ukuran tiap anggota secara terpisah (oleh pemanggil),
 *  - mengenali struktur teks (header, record sumbu, OBJECT/TRISOLATION, END) dan varian biner,
 *  - melaporkan pesan pemulihan spesifik.
 * Jalur konversi DTM/STR → Mesh SENGAJA belum diaktifkan: penomoran vertex DTM terhadap
 * titik STR harus dibuktikan dengan sampel Surpac (IMPLEMENTATION_PLAN.md M3/M8).
 */
import type { ValidationIssue } from '../domain/types'

export const SURPAC_SITE_PENDING = 'SURPAC_SITE_PENDING'

export type NamedText = { name: string; text: string; bytes: Uint8Array }

export type SurpacPair = { dtm: NamedText; str: NamedText; matchedBy: 'reference' | 'basename' | 'user' }

export type SurpacVariant = {
  encoding: 'text' | 'binary'
  dtmHeader: string | null
  /** Nama STR yang dirujuk header DTM (bila ada). */
  strReference: string | null
  objects: number
  trisolations: number
  triangleRecords: number
  strHeader: string | null
  strAxisRecord: boolean
  strRecords: number
  strSeparators: number
  strEnd: boolean
}

const baseName = (n: string) => n.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '').toLowerCase()
const ext = (n: string) => (n.toLowerCase().split('.').pop() ?? '')

/** Teks dianggap biner bila memuat NUL atau proporsi kontrol non-spasi tinggi. */
export function looksBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 4096)
  let ctrl = 0
  for (let i = 0; i < n; i++) {
    const b = bytes[i]!
    if (b === 0) return true
    if (b < 9 || (b > 13 && b < 32)) ctrl++
  }
  return n > 0 && ctrl / n > 0.05
}

function firstLine(text: string): string | null {
  const l = text.split(/\r?\n/, 1)[0]
  return l === undefined ? null : l.trim()
}

/** Referensi .str pada baris pertama DTM (mis. "pit1.str,13-Jan-98,,..."). */
export function dtmStrReference(dtmText: string): string | null {
  const l = firstLine(dtmText)
  if (!l) return null
  const m = l.split(',')[0]?.trim()
  return m && /\.str$/i.test(m) ? m : null
}

export type PairResult =
  | { ok: true; pair: SurpacPair; issues: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[]; needsConfirmation?: { dtm: string; str: string } }

/**
 * Memasangkan tepat satu .dtm dan satu .str. `confirmed` = pengguna telah mengonfirmasi
 * pasangan yang nama/referensinya tidak cocok.
 */
export function pairSurpacFiles(files: NamedText[], confirmed = false): PairResult {
  const dtms = files.filter((f) => ext(f.name) === 'dtm')
  const strs = files.filter((f) => ext(f.name) === 'str')
  if (dtms.length === 1 && strs.length === 0) {
    return { ok: false, issues: [{ code: 'SURPAC_STR_MISSING', severity: 'error', message: 'Pilih STR pasangan untuk DTM ini (pilih kedua berkas sekaligus).', location: { file: dtms[0]!.name } }] }
  }
  if (strs.length === 1 && dtms.length === 0) {
    return { ok: false, issues: [{ code: 'SURPAC_DTM_MISSING', severity: 'error', message: 'Pilih DTM pasangan untuk STR ini (pilih kedua berkas sekaligus).', location: { file: strs[0]!.name } }] }
  }
  if (dtms.length !== 1 || strs.length !== 1) {
    return { ok: false, issues: [{ code: 'SURPAC_PAIR_COUNT', severity: 'error', message: 'Pilih tepat satu berkas .dtm dan satu berkas .str.' }] }
  }
  const dtm = dtms[0]!
  const str = strs[0]!
  const ref = looksBinary(dtm.bytes) ? null : dtmStrReference(dtm.text)
  if (ref) {
    if (baseName(ref) === baseName(str.name)) return { ok: true, pair: { dtm, str, matchedBy: 'reference' }, issues: [] }
    if (confirmed) return { ok: true, pair: { dtm, str, matchedBy: 'user' }, issues: [] }
    return {
      ok: false,
      needsConfirmation: { dtm: dtm.name, str: str.name },
      issues: [{ code: 'SURPAC_REFERENCE_MISMATCH', severity: 'error', message: `DTM merujuk "${ref}" tetapi STR yang dipilih "${str.name}". Pilih STR pasangan yang benar atau konfirmasi pasangan ini.`, location: { file: dtm.name, line: 1 } }],
    }
  }
  if (baseName(dtm.name) === baseName(str.name)) return { ok: true, pair: { dtm, str, matchedBy: 'basename' }, issues: [] }
  if (confirmed) return { ok: true, pair: { dtm, str, matchedBy: 'user' }, issues: [] }
  return {
    ok: false,
    needsConfirmation: { dtm: dtm.name, str: str.name },
    issues: [{ code: 'SURPAC_PAIR_AMBIGUOUS', severity: 'warning', message: `Nama dasar "${dtm.name}" dan "${str.name}" berbeda dan DTM tidak memuat referensi STR. Konfirmasi bahwa keduanya pasangan.` }],
  }
}

/** Mengenali struktur teks DTM/STR tanpa menafsirkan record sebagai geometri. */
export function detectSurpacVariant(pair: SurpacPair): SurpacVariant {
  const binary = looksBinary(pair.dtm.bytes) || looksBinary(pair.str.bytes)
  const v: SurpacVariant = {
    encoding: binary ? 'binary' : 'text',
    dtmHeader: null, strReference: null, objects: 0, trisolations: 0, triangleRecords: 0,
    strHeader: null, strAxisRecord: false, strRecords: 0, strSeparators: 0, strEnd: false,
  }
  if (binary) return v
  const dl = pair.dtm.text.split(/\r?\n/)
  v.dtmHeader = dl[0]?.trim() ?? null
  v.strReference = dtmStrReference(pair.dtm.text)
  for (const raw of dl.slice(1)) {
    const l = raw.trim()
    if (/^OBJECT\s*,/i.test(l)) v.objects++
    else if (/^TRISOLATION\s*,/i.test(l)) v.trisolations++
    else if (/^\d+\s*,(\s*-?\d+\s*,){2,}/.test(l)) v.triangleRecords++
  }
  const sl = pair.str.text.split(/\r?\n/)
  v.strHeader = sl[0]?.trim() ?? null
  v.strAxisRecord = /^0\s*,/.test(sl[1]?.trim() ?? '')
  for (const raw of sl.slice(2)) {
    const l = raw.trim()
    if (l === '') continue
    if (/^0\s*,/.test(l)) {
      if (/END\s*$/i.test(l)) v.strEnd = true
      else v.strSeparators++
    } else if (/^\d+\s*,/.test(l)) v.strRecords++
  }
  return v
}

/** Validasi struktural + status jalur impor (belum terverifikasi). */
export function surpacImportIssues(pair: SurpacPair, v: SurpacVariant): ValidationIssue[] {
  const loc = { file: pair.dtm.name }
  if (v.encoding === 'binary') {
    return [{ code: 'SURPAC_BINARY_UNSUPPORTED', severity: 'error', message: 'DTM/STR biner belum didukung. Ekspor kembali sebagai DXF muka segitiga dari Surpac, atau simpan DTM/STR dalam format teks.', location: loc }]
  }
  const out: ValidationIssue[] = []
  if (v.objects === 0 || v.trisolations === 0) {
    out.push({ code: 'SURPAC_DTM_STRUCTURE', severity: 'error', message: 'DTM tidak memuat record OBJECT/TRISOLATION yang dikenali. Pastikan berkas adalah DTM Surpac teks.', location: loc })
  }
  if (!v.strAxisRecord || v.strRecords === 0) {
    out.push({ code: 'SURPAC_STR_STRUCTURE', severity: 'error', message: 'STR tidak memuat record sumbu dan titik string yang dikenali.', location: { file: pair.str.name } })
  }
  if (v.objects > 1) {
    out.push({ code: 'SURPAC_MULTIPLE_OBJECTS', severity: 'info', message: `DTM memuat ${v.objects} objek; pilih objek permukaan setelah varian diverifikasi.`, location: loc })
  }
  out.push({
    code: SURPAC_SITE_PENDING,
    severity: 'error',
    message:
      'Pembacaan DTM/STR belum diverifikasi terhadap Surpac (SURPAC_SITE_PENDING). Untuk saat ini ekspor kembali sebagai DXF muka segitiga dari Surpac.',
    location: loc,
  })
  return out
}
