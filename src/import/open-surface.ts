import type { ValidationIssue } from '../domain/types'
import { ImportCancelledError, parseDxfAsync } from './dxf'
import type { DxfParseOk } from './dxf'
import { checkSurfaceSize, decodeText, kindFromName, looksBinaryDxf, readSurfaceFile } from './surface'
import type { FileLike } from './surface'
import { detectSurpacVariant, pairSurpacFiles, surpacImportIssues } from './surpac'
import type { NamedText } from './surpac'

export type OpenProgress = (phase: 'baca' | 'urai', fraction: number) => void

export type OpenResult =
  | { ok: true; format: 'dxf'; dxf: DxfParseOk; bytes: number }
  | { ok: false; issues: ValidationIssue[]; needsPairConfirmation?: { dtm: string; str: string } }

export type OpenOptions = {
  signal?: AbortSignal
  onProgress?: OpenProgress
  confirmPair?: boolean
  yieldFn?: () => Promise<void>
}

/** Pintu impor surface: satu DXF, atau pasangan .dtm + .str (bebas urutan). */
export async function openSurfaceFiles(files: FileLike[], opts: OpenOptions = {}): Promise<OpenResult> {
  if (files.length === 0) return { ok: false, issues: [{ code: 'NO_FILE', severity: 'error', message: 'Pilih berkas surface.' }] }
  const kinds = files.map((f) => kindFromName(f.name))
  const isSurpac = kinds.some((k) => k === 'dtm' || k === 'str')
  if (!isSurpac && files.length > 1) {
    return { ok: false, issues: [{ code: 'MULTIPLE_SURFACES', severity: 'error', message: 'Versi ini memuat satu surface aktif. Pilih satu berkas DXF, atau satu pasangan DTM + STR.' }] }
  }
  // Periksa ukuran SEMUA berkas sebelum membaca isi apa pun.
  const sizeIssues = files.map(checkSurfaceSize).filter((i): i is ValidationIssue => i !== null)
  if (sizeIssues.length > 0) return { ok: false, issues: sizeIssues }
  const read: NamedText[] = []
  for (const f of files) {
    if (opts.signal?.aborted) throw new ImportCancelledError()
    const r = await readSurfaceFile(f)
    if (!r.ok) return { ok: false, issues: r.issues }
    read.push({ name: r.name, bytes: r.bytes, text: '' })
    opts.onProgress?.('baca', read.length / files.length)
  }
  if (isSurpac) {
    for (const t of read) t.text = decodeText(t.bytes)
    const p = pairSurpacFiles(read, opts.confirmPair)
    if (!p.ok) return { ok: false, issues: p.issues, ...(p.needsConfirmation ? { needsPairConfirmation: p.needsConfirmation } : {}) }
    const v = detectSurpacVariant(p.pair)
    return { ok: false, issues: surpacImportIssues(p.pair, v) }
  }
  const f = read[0]!
  if (kinds[0] !== 'dxf') {
    return { ok: false, issues: [{ code: 'UNKNOWN_FORMAT', severity: 'error', message: `Format "${f.name}" tidak dikenali. Gunakan DXF ASCII (3DFACE/POLYFACE) atau pasangan DTM + STR.`, location: { file: f.name } }] }
  }
  if (looksBinaryDxf(f.bytes)) {
    return { ok: false, issues: [{ code: 'DXF_BINARY', severity: 'error', message: 'DXF biner belum didukung. Simpan ulang sebagai DXF ASCII.', location: { file: f.name } }] }
  }
  const text = decodeText(f.bytes)
  const res = await parseDxfAsync(text, f.name, {
    ...(opts.signal ? { signal: opts.signal } : {}),
    ...(opts.yieldFn ? { yieldFn: opts.yieldFn } : {}),
    onProgress: (x) => opts.onProgress?.('urai', x),
  })
  if (!res.ok) return { ok: false, issues: res.issues }
  return { ok: true, format: 'dxf', dxf: res, bytes: f.bytes.byteLength }
}
