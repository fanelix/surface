# Status implementasi

**Pelaksana / mode:** Claude Code, agen repo di sesi cloud. Kemampuan: baca/tulis repo, menjalankan perintah dan tes
(Node 22.23.4, npm 10.9.9, Chromium + Playwright 1.63.0), akses GitHub melalui MCP (push branch, membaca run/log
Actions). Tidak ada akses dashboard Netlify.

**Branch / SHA perubahan kode terakhir:** `claude/amazing-feynman-aaof72` / `6aa19d2` (terverifikasi CI). Commit
dokumentasi yang memperbarui berkas ini hanya mengubah `docs/STATUS.md`; hasil CI-nya terlihat di tab Checks PR.

**SHA yang benar-benar diuji / tautan cek:**

| SHA | Isi | CI (GitHub Actions) | Hasil |
|---|---|---|---|
| `6aa19d2` | + perbaikan Batal saat menggambar, STATUS, acceptance | [run 41850442335](https://github.com/fanelix/surface/actions/runs/41850442335) | **sukses**: check + e2e **18 lulus, 1 skip** (bench) |
| `2ea4d7e` | M0–M2, M4–M6, M3 parsial, M7 bench | [run 41849840647](https://github.com/fanelix/surface/actions/runs/41849840647) | **sukses**: check (Vitest 132 + 4 todo) + e2e 17/17, bench di-skip |
| `c5b8755` | M0–M2, M4–M6 | [run 41849050929](https://github.com/fanelix/surface/actions/runs/41849050929) | **sukses**: check + e2e 17/17 (termasuk render WebGL) |
| `b70474d` | M0, M1, M2, M4 + perbaikan host preview | [run 41846428841](https://github.com/fanelix/surface/actions/runs/41846428841) | **sukses**: check + e2e |
| `aa9453c` | M0–M2 | [run 41845204613](https://github.com/fanelix/surface/actions/runs/41845204613) | **gagal** e2e: `Timed out waiting 180000ms from config.webServer` → diperbaiki di `b70474d` |
| `3af52a2`, `c40632e` | M1, M0 | run 2, 1 | dibatalkan oleh `cancel-in-progress` (job check `3af52a2` sukses sebelum batal) |

**PR:** [fanelix/surface#1](https://github.com/fanelix/surface/pull/1) `claude/amazing-feynman-aaof72` → `main`, terbuka,
dipantau agen. Merge diputuskan pemilik repo. **URL preview:** belum ada (Netlify belum terhubung).

## Perubahan yang diusulkan namun belum diterapkan

- Naikkan `actions/checkout`, `actions/setup-node`, `actions/upload-artifact` ke versi yang berjalan di Node 24
  (runner memberi peringatan deprecation Node 20). Belum diubah karena versi target belum diverifikasi di sesi ini.
- Adapter DTM/STR → mesh (M3) setelah sampel Surpac terverifikasi tersedia.

## Diterapkan atas permintaan pemilik

- `Paket_Claude_Code_Topografi.zip` dihapus dari root. Sebelum dihapus, kedelapan isinya (`IMPLEMENTATION_PLAN.md` dan
  tujuh berkas `tests/fixtures/synthetic/`) diverifikasi identik byte-per-byte (`cmp`) dengan berkas di repo.

## Milestone selesai (diterapkan dan teruji)

| Milestone | Status | Bukti |
|---|---|---|
| M0 | Selesai | `npm ci && npm run check` dari clean clone lokal exit 0, `dist/index.html` ada; CI hijau sejak `b70474d` |
| M1 | Selesai | `tests/unit/geometry.test.ts` 34 tes |
| M2 | Selesai | `tests/unit/dxf.test.ts` 29 tes |
| M3 | **Parsial — SURPAC_SITE_PENDING** | `tests/unit/surpac.test.ts` 13 tes deteksi/pemasangan/error + 4 `it.todo` untuk jalur impor |
| M4 | Selesai | `tests/unit/profile.test.ts` 21 + `tests/unit/worker.test.ts` 13 tes |
| M5 | Selesai (preview DXF) | `tests/e2e/section.spec.ts` 11 tes, termasuk render WebGL terpisah dan Batal di tengah gambar |
| M6 | Selesai | `tests/unit/objects.test.ts` 19 + `tests/e2e/objects.spec.ts` 6 tes |
| M7 | **Parsial** | CI + e2e + `netlify.toml` + bench selesai; koneksi Netlify, Deploy Preview, smoke test preview dan benchmark laptop target menunggu pemilik/engineer |
| M8 | Belum | Bergantung M3, data kontrol site, dan Netlify |

## Milestone aktif dan checkbox berikutnya

1. **Pemilik repo (M7):** Netlify → *Add new project → Import an existing project → GitHub* → pilih `fanelix/surface`,
   branch produksi `main`, build `npm run build`, publish `dist` (sudah di `netlify.toml`, Node 22.23.4). Aktifkan Deploy
   Preview untuk PR; PR #1 sudah terbuka. Salin URL preview aktual dari cek Netlify ke berkas ini.
2. **Pada URL preview:** jalankan `E2E_BASE_URL=<url> npx playwright test` dan smoke test manual dengan berkas lokal; catat
   hasil di sini.
3. **Engineer (M3/M8):** lengkapi `docs/acceptance.md` (sampel DTM/STR + DXF surface yang sama, grid/datum, 3 kontrol,
   satu profil A–B, satu bor), tetapkan toleransi lapangan sebelum membandingkan.
4. **Engineer (M7):** `npm run gen:bench && npm run bench` di laptop kerja target, atau ukur langsung di aplikasi (panel
   Surface menampilkan *Impor sampai frame pertama* dan *Pembaruan profil terakhir*).

## Perintah yang dijalankan, hasil/exit code (lokal, container sesi ini)

| Perintah | Hasil |
|---|---|
| `npm ci && npm run check` (clean clone `c40632e`) | exit 0 |
| `npm run check` (`2ea4d7e`) | exit 0 — typecheck, lint 0 peringatan, Vitest **132 lulus + 4 todo** (7 berkas), build |
| `npx playwright test` (`2ea4d7e`) | exit 0 — **17 lulus, 1 skip** (bench, butuh `BENCH=1`) |
| `npx playwright test` (setelah perbaikan Batal) | exit 0 — **18 lulus, 1 skip**; tes baru terbukti gagal tanpa perbaikan (`stroke-dasharray "6 4"` tertinggal) |
| `BENCH=1 npx playwright test tests/e2e/bench.spec.ts` | exit 0 — lihat tabel kinerja |
| `npm audit` | 11 moderate, semuanya di rantai dev-tool lint (eslint/typescript-eslint → minimatch); tidak masuk bundle produksi |

## Fixture dan angka yang diperiksa (dihasilkan oleh kode, dibandingkan dengan `expected.json`, toleransi 0,01 m)

- **DXF:** `bench_3dface.dxf` dan `bench_polyface.dxf` → 10 segitiga, 12 vertex unik, bounds
  E 700000–700100, N 9099980–9100020, Z 120–140; himpunan segitiga identik setelah mengabaikan urutan.
  POLYFACE memuat indeks `-1` (sisi tersembunyi) dan dibaca sebagai 1. `gap_3dface.dxf` → 8 segitiga.
- **Profil A=(700000,9100000) B=(700100,9100000):** bench 1 bagian, vertex (0,120) (20,120) (40,130) (55,130)
  (75,140) (100,140). Gap 2 bagian [0,40] dan [55,100]. Bidang Z=100+E+2N, A=(1,1) B=(2,1): satu interval 1 m,
  Z 103 → 104. Hasil juga dicocokkan dengan pembanding brute-force barycentric pada garis acuan, oblique, dan utara.
- **Titik:** P-01 s=30 o=−10 · P-02 −10/+4 · P-03 110/−2 · P-04 60/0 · P-05 30/+15 (Z asli). Oblique
  A=(0,0) B=(3,4) P=(−4,3,10) → s=0, o=+5.
- **Bor:** BH-01 collar 50/+12/134, toe 50/−8/99,358983849, memotong dalam A–B MD 24, s 50, Z 113,215390309.
  BH-02 in-plane (dalam A–B). BH-03 tidak memotong (toe s 37,320508076). BH-04 memotong di perpanjangan MD 4, s 110,
  Z 139, proyeksi berimpit.
- **Kombinasi:** filter mati 9 objek; koridor ±5 m 6 objek (P-02, P-03, P-04, BH-01, BH-02, BH-04). Balik A/B: P-01
  s=70 o=+10, P-03 s=−10 o=+2, BH-01 offset collar −12 / toe +8, MD dan Z potong tetap.
- **CSV:** `points_invalid.csv` baris 2 diterima; 3 (Northing kosong), 4 (duplikat), 5 (NaN) ditolak.
- **Batas byte:** 24.999.999 dan 25.000.000 dibaca; 25.000.001 ditolak tanpa pembacaan (spy). Pasangan DTM/STR: dua
  berkas tepat 25 MB dibaca; satu anggota 25.000.001 → tidak ada yang dibaca.

## Kinerja (indikatif — container sesi, BUKAN laptop target)

Chromium 153 headless, WebGL SwiftShader (perangkat lunak), Intel Xeon 2,8 GHz 4 core, RAM 17 GB, Linux. Tiga
pengulangan. Impor: pemilihan berkas → frame pertama. Profil: pelepasan pegangan B → grafik.

| Dataset | Byte | Segitiga | Impor median / maks | Profil median / maks |
|---|---:|---:|---|---|
| small_500kb.dxf | 489.882 | 2.450 | 130 ms / 132 ms | 6,8 ms / 18,6 ms |
| medium_5mb.dxf | 4.931.696 | 24.642 | 536 ms / 558 ms | 7,0 ms / 7,5 ms |
| large_25mb.dxf | 24.733.962 | 123.008 | 1.508 ms / 1.617 ms | 39 ms / 234 ms |

Target awal (median ≤ 15 s impor, ≤ 1 s profil) terpenuhi di lingkungan ini. Memori puncak belum terukur
(`performance.memory` hanya heap thread utama, 11 MB; heap worker tidak termasuk). Status laptop target: PENDING.

## Keputusan implementasi dan pemetaan nama

- **Pembaca DXF eksplisit**, bukan library: `dxf-parser@1` diuji pada `bench_polyface.dxf`; indeks muka dipertahankan
  tetapi record muka dicampur ke daftar vertex dengan koordinat (0,0,0) dan tanpa nomor baris. Pembaca sendiri
  memberi lokasi per baris/layer/handle dan pemrosesan per batch untuk pembatalan.
- TypeScript dipin 5.9.3 karena `typescript-eslint` 8.72 belum mendukung TS 7.
- `PlaneHit` in-plane diperluas dengan `sRange` dan `abCoverage`; `Profile` diperluas dengan `ambiguousFaces`.
  Status berkas `extension-cross` = `kind: 'cross', onAB: false`.
- Modul tambahan di luar tabel bagian 3: `src/import/mesh-builder.ts`, `src/import/open-surface.ts`,
  `src/domain/section-objects.ts`, `src/worker/engine.ts` (logika worker yang dapat diuji di Node),
  `src/worker/client.ts`, `src/ui/SectionControls.tsx`, `src/ui/format.ts`.
- Toleransi: numerik 1e-6 m (`src/geometry/tolerance.ts`), kesamaan Z antar segitiga 1e-5 m, uji 0,01 m.
- Unit DXF tanpa `$INSUNITS` harus dikonfirmasi meter sebelum penampang dihitung; unit lain diperingatkan dan
  tidak dikonversi. Tidak ada tebakan EPSG atau penukaran E/N otomatis.

## Status

- **Status Surpac site:** PENDING (`SURPAC_SITE_PENDING`)
- **Status QA laptop target:** PENDING
- **Status Netlify:** belum terhubung
- **URL aktual dan commit deploy:** belum ada
- **Klaim yang boleh dibuat saat ini:** preview fungsional DXF (setelah Netlify terhubung). Dukungan DTM/STR Surpac
  belum boleh diklaim.

## Hambatan, pemilik tindakan, bagian lain yang dapat dilanjutkan

| Hambatan | Pemilik | Dapat dilanjutkan sementara |
|---|---|---|
| Sampel DTM/STR + DXF surface yang sama + kontrol site | Engineer geoteknik/survey | Semua alur DXF, titik/bor, penampang |
| Koneksi Netlify, Deploy Preview, URL produksi | Pemilik repo | CI GitHub Actions sudah memeriksa build dan e2e |
| Benchmark laptop kerja | Engineer | Angka container di atas sebagai indikasi |
| Merge ke `main` | Pemilik repo | — |
