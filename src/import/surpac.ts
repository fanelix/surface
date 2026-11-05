/**
 * Pasangan Surpac DTM/STR (M3).
 *
 * Varian teks yang DIVERIFIKASI pada sampel site (lihat docs/acceptance.md):
 *  - STR: baris 1 header, baris 2 record sumbu ("0, ..."), lalu record "string, Y, X, Z, [D1...]".
 *    Y = northing, X = easting (diverifikasi terhadap ekspor DXF dari Surpac: E = kolom 3).
 *    Record "0, ..." adalah pemisah string; "0, ..., END" menutup berkas.
 *  - DTM: baris 1 merujuk STR ("<nama>.str,..."), blok titik opsional (salinan titik STR;
 *    tidak dipakai untuk geometri), lalu "OBJECT, n," / "TRISOLATION, n, ..." dan record
 *    segitiga "id, v1, v2, v3[, n1, n2, n3]," sampai "END".
 *  - Indeks vertex = nomor urut record STR SETELAH record sumbu, dengan record pemisah ikut
 *    dinomori (dan tidak pernah dirujuk). Hipotesis ini satu-satunya dari lima yang lolos:
 *    0 rujukan ke pemisah, 0 segitiga degenerat, seluruh pasangan tetangga konsisten.
 * Varian lain (biner, tanpa record sumbu, rujukan yang tidak terpetakan) ditolak dengan pesan
 * pemulihan. Pembandingan terhadap kontrol/penampang Surpac tetap bagian M8.
 */
import type { ENZ, UnitStatus, ValidationIssue } from '../domain/types'
import type { DxfCandidate, DxfParseResult } from './dxf'
import { ImportCancelledError } from './dxf'
import { IssueCollector, MeshBuilder, coordinateSanityIssues } from './mesh-builder'

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

/** Masalah struktural yang membuat pasangan tidak dapat dibaca (kosong = boleh diurai). */
export function surpacStructureIssues(pair: SurpacPair, v: SurpacVariant): ValidationIssue[] {
  const loc = { file: pair.dtm.name }
  if (v.encoding === 'binary') {
    return [{ code: 'SURPAC_BINARY_UNSUPPORTED', severity: 'error', message: 'DTM/STR biner belum didukung. Simpan DTM/STR dalam format teks dari Surpac, atau ekspor kembali sebagai DXF muka segitiga.', location: loc }]
  }
  const out: ValidationIssue[] = []
  if (v.objects === 0 || v.trisolations === 0 || v.triangleRecords === 0) {
    out.push({ code: 'SURPAC_DTM_STRUCTURE', severity: 'error', message: 'DTM tidak memuat record OBJECT/TRISOLATION dan segitiga yang dikenali. Pastikan berkas adalah DTM Surpac teks.', location: loc })
  }
  if (!v.strAxisRecord || v.strRecords === 0) {
    out.push({ code: 'SURPAC_STR_STRUCTURE', severity: 'error', message: 'STR tidak memuat record sumbu (baris 2) dan titik string yang dikenali.', location: { file: pair.str.name, line: 2 } })
  }
  return out
}

const UNITLESS: UnitStatus = { kind: 'unitless', source: 'DTM/STR Surpac tidak menyatakan unit' }

type StrRecord = { p: ENZ | null; line: number }

function parseNum(v: string | undefined): number {
  const t = (v ?? '').trim()
  return t === '' ? NaN : Number(t)
}

export type SurpacParseOptions = { signal?: AbortSignal; yieldFn?: () => Promise<void>; onProgress?: (f: number) => void; batchLines?: number }

/**
 * Mengurai pasangan DTM/STR varian teks terverifikasi menjadi kandidat mesh
 * (satu kandidat per OBJECT/TRISOLATION), dengan struktur yang sama seperti DXF.
 */
export async function parseSurpacPair(pair: SurpacPair, opts: SurpacParseOptions = {}): Promise<DxfParseResult> {
  const fileName = `${pair.dtm.name} + ${pair.str.name}`
  const v = detectSurpacVariant(pair)
  const fatal = surpacStructureIssues(pair, v)
  if (fatal.length) return { ok: false, fileName, issues: fatal }
  const batch = opts.batchLines ?? 50_000
  const y = opts.yieldFn ?? (() => new Promise<void>((r) => setTimeout(r, 0)))
  let n = 0
  const tick = async (fraction: number) => {
    if (++n % batch === 0) {
      if (opts.signal?.aborted) throw new ImportCancelledError()
      opts.onProgress?.(fraction)
      await y()
    }
  }

  // --- STR: record setelah sumbu, pemisah ikut dinomori ---
  const sl = pair.str.text.split(/\r?\n/)
  const recs: StrRecord[] = []
  const total = sl.length + 1
  for (let i = 2; i < sl.length; i++) {
    await tick((i / total) * 0.4)
    const raw = sl[i]!.trim()
    if (raw === '') continue
    const f = raw.split(',')
    const sn = (f[0] ?? '').trim()
    if (sn === '0') {
      recs.push({ p: null, line: i + 1 })
      continue
    }
    // Surpac: string, Y (northing), X (easting), Z
    recs.push({ p: { e: parseNum(f[2]), n: parseNum(f[1]), z: parseNum(f[3]) }, line: i + 1 })
  }

  // --- DTM: OBJECT/TRISOLATION dan segitiga ---
  const issues = new IssueCollector()
  const groups = new Map<string, { builder: MeshBuilder; triangles: number }>()
  let key: string | null = null
  let object = ''
  const dl = pair.dtm.text.split(/\r?\n/)
  let copiedPoints = 0
  for (let i = 1; i < dl.length; i++) {
    await tick(0.4 + (i / dl.length) * 0.6)
    const raw = dl[i]!.trim()
    if (raw === '' || /^END\b/i.test(raw)) continue
    const om = /^OBJECT\s*,\s*([^,]*)/i.exec(raw)
    if (om) {
      object = om[1]!.trim()
      continue
    }
    const tm = /^TRISOLATION\s*,\s*([^,]*)/i.exec(raw)
    if (tm) {
      key = `OBJECT ${object || '?'} / TRISOLATION ${tm[1]!.trim()}`
      if (!groups.has(key)) groups.set(key, { builder: new MeshBuilder(issues), triangles: 0 })
      continue
    }
    if (!key) {
      copiedPoints++ // blok titik sebelum OBJECT: salinan titik STR, tidak dipakai
      continue
    }
    const f = raw.split(',').map((x) => x.trim())
    const id = f[0] ?? ''
    const idx = [1, 2, 3].map((k) => Number(f[k]))
    const g = groups.get(key)!
    g.triangles++
    const L = { file: pair.dtm.name, layer: key, line: i + 1, faceId: id }
    if (!idx.every((k) => Number.isInteger(k))) {
      g.builder.reject('SURPAC_TRIANGLE_RECORD', `Segitiga ${id} pada baris ${i + 1} tidak memuat tiga indeks vertex bilangan bulat; segitiga dikeluarkan.`, L)
      continue
    }
    const pts: ENZ[] = []
    let bad = false
    for (const k of idx) {
      const r = recs[k - 1]
      if (!r) {
        g.builder.reject('SURPAC_INDEX_OUT_OF_RANGE', `Segitiga ${id} merujuk record STR ${k}, di luar rentang 1–${recs.length}. Pilih STR pasangan yang benar.`, L)
        bad = true
        break
      }
      if (!r.p) {
        g.builder.reject('SURPAC_INDEX_REFERS_CONTROL', `Segitiga ${id} merujuk record STR ${k} (baris ${r.line}) yang merupakan pemisah/penutup, bukan titik. Varian DTM/STR ini tidak sesuai; ekspor kembali dari Surpac.`, L)
        bad = true
        break
      }
      pts.push(r.p)
    }
    if (bad) continue
    g.builder.addTriangle(pts[0]!, pts[1]!, pts[2]!, `T${id}`, L)
  }

  const candidates: DxfCandidate[] = []
  for (const [layer, g] of groups) {
    if (g.builder.triangleCount === 0) {
      issues.add({ code: 'SURPAC_TRISOLATION_EMPTY', severity: 'warning', message: `${layer} tidak memiliki segitiga yang valid.`, location: { file: pair.dtm.name, layer } })
      continue
    }
    const built = g.builder.build()
    for (const i of coordinateSanityIssues(built.bounds, fileName)) issues.add({ ...i, location: { file: fileName, layer } })
    candidates.push({
      layer,
      mesh: built.mesh,
      bounds: built.bounds,
      faceIds: built.faceIds,
      sourceCounts: { '3DFACE': 0, POLYFACE: 0 },
      rejectedFaces: built.rejectedFaces,
      verticalFaces: built.verticalFaces,
    })
  }
  candidates.sort((a, b) => b.mesh.triangles.length - a.mesh.triangles.length || a.layer.localeCompare(b.layer))
  if (candidates.length === 0) {
    return { ok: false, fileName, issues: [{ code: 'SURPAC_NO_VALID_TRIANGLES', severity: 'error', message: 'Tidak ada segitiga DTM yang dapat dipetakan ke titik STR. Pastikan STR adalah pasangan DTM ini, atau ekspor kembali dari Surpac.', location: { file: pair.dtm.name } }, ...issues.list] }
  }
  if (copiedPoints > 0) {
    issues.add({ code: 'SURPAC_DTM_POINT_BLOCK', severity: 'info', message: `Blok ${copiedPoints} record titik di awal DTM diabaikan; geometri segitiga diambil dari record STR.`, location: { file: pair.dtm.name } })
  }
  opts.onProgress?.(1)
  return {
    ok: true,
    fileName,
    version: `Surpac DTM/STR teks (STR dirujuk: ${v.strReference ?? '—'}, ${v.objects} objek, ${v.trisolations} trisolation)`,
    units: UNITLESS,
    candidates,
    issues: issues.list,
    issueCounts: issues.counts,
    stats: { pairs: recs.length, entities: candidates.reduce((s, c) => s + c.mesh.triangles.length / 3, 0), contourEntities: 0 },
  }
}
