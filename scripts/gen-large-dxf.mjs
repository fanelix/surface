#!/usr/bin/env node
/**
 * Membangkitkan surface DXF ASCII 3DFACE sintetis dengan banyak segitiga nyata
 * (grid bergelombang dengan bench), bukan padding, untuk tolok ukur M7.
 *
 *   node scripts/gen-large-dxf.mjs --bytes 24900000 --out tests/fixtures/large/large_25mb.dxf
 *
 * Ukuran akhir mendekati --bytes tanpa melebihinya. Koordinat sekitar E 700000, N 9100000.
 */
import { createWriteStream, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []),
)
const target = Number(args.bytes ?? 1_000_000)
const out = args.out ?? 'tests/fixtures/large/generated.dxf'
const E0 = 700000, N0 = 9100000, STEP = 2

const header = '  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1009\n  9\n$INSUNITS\n 70\n6\n  0\nENDSEC\n  0\nSECTION\n  2\nENTITIES\n'
const footer = '  0\nENDSEC\n  0\nEOF\n'

const z = (i, j) => 100 + 8 * Math.sin(i / 23) + 5 * Math.cos(j / 17) + 10 * Math.floor(i / 80)
const f3 = (x) => x.toFixed(3)
function face(handle, p) {
  let s = `  0\n3DFACE\n  5\n${handle.toString(16).toUpperCase()}\n  8\nTOPO\n`
  const q = [p[0], p[1], p[2], p[2]]
  q.forEach((v, k) => {
    s += ` 1${k}\n${f3(v[0])}\n 2${k}\n${f3(v[1])}\n 3${k}\n${f3(v[2])}\n`
  })
  return s
}
const sample = face(0xfffff, [[E0, N0, 100], [E0 + 2, N0, 100], [E0 + 2, N0 + 2, 100]])
const perFace = Buffer.byteLength(sample)
const faces = Math.floor((target - header.length - footer.length) / perFace)
const n = Math.max(1, Math.floor(Math.sqrt(faces / 2)))

mkdirSync(dirname(out), { recursive: true })
const ws = createWriteStream(out)
let bytes = 0
const write = (s) => {
  bytes += Buffer.byteLength(s)
  return ws.write(s)
}
write(header)
let h = 0x100
let tri = 0
const budget = target - footer.length
outer: for (let j = 0; j < n; j++) {
  for (let i = 0; i < n; i++) {
    const a = [E0 + i * STEP, N0 + j * STEP, z(i, j)]
    const b = [E0 + (i + 1) * STEP, N0 + j * STEP, z(i + 1, j)]
    const c = [E0 + (i + 1) * STEP, N0 + (j + 1) * STEP, z(i + 1, j + 1)]
    const d = [E0 + i * STEP, N0 + (j + 1) * STEP, z(i, j + 1)]
    for (const t of [[a, b, c], [a, c, d]]) {
      const s = face(h++, t)
      if (bytes + Buffer.byteLength(s) > budget) break outer
      write(s)
      tri++
    }
  }
}
write(footer)
ws.end(() => console.log(JSON.stringify({ out, bytes, triangles: tri, grid: n })))
