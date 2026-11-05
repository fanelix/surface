# Status implementasi

**Pelaksana / mode:** Claude Code, agen repo di sesi cloud. Kemampuan: baca/tulis repo, menjalankan perintah dan tes
(Node 22.23.4, npm 10.9.9, Chromium + Playwright 1.63.0), akses GitHub melalui MCP (push branch, membaca run/log
Actions). Tidak ada akses dashboard Netlify.

**Branch produksi:** `main` di `a9e480f` (merge commit PR #1), CI hijau. Commit kode terakhir: `a34dc0d`.
**Branch kerja:** `claude/amazing-feynman-aaof72`, dibuat ulang dari `main` setelah merge untuk pekerjaan lanjutan.

**SHA yang benar-benar diuji / tautan cek:**

| SHA | Isi | CI (GitHub Actions) | Hasil |
|---|---|---|---|
| `a9e480f` (`main`) | merge commit PR #1, isi identik dengan `005d603` | [run 41853869598](https://github.com/fanelix/surface/actions/runs/41853869598) (push ke `main`) | **sukses**: check + e2e |
| `005d603` | dokumentasi STATUS (head PR saat merge) | [run 41853202652](https://github.com/fanelix/surface/actions/runs/41853202652) (push), [run 41853212294](https://github.com/fanelix/surface/actions/runs/41853212294) (PR) | **sukses** keduanya: check + e2e |
| `a34dc0d` | + `readAB` atomik di e2e (perbaikan tes rapuh) | [run 41852776746](https://github.com/fanelix/surface/actions/runs/41852776746) (push), [run 41852786406](https://github.com/fanelix/surface/actions/runs/41852786406) (PR) | **sukses** keduanya: check + e2e **18 lulus, 1 skip, 0 flaky**; action v7 tanpa peringatan Node 20 |
| `856c4e0` | + action CI ke v7 (Node 24) | [run 41851899033](https://github.com/fanelix/surface/actions/runs/41851899033) (push), [run 41851907137](https://github.com/fanelix/surface/actions/runs/41851907137) (PR) | **sukses** keduanya; peringatan "Node.js 20 is deprecated" hilang dari log |
| `ab5f38e` | + hapus ZIP | [run 41851456743](https://github.com/fanelix/surface/actions/runs/41851456743) (push) sukses; [run 41851464417](https://github.com/fanelix/surface/actions/runs/41851464417) (PR) **gagal** | e2e "Batal di tengah gambar" gagal 2×, "geser B, balik arah" flaky: race baca A/B di tes (nilai campuran lama/baru), bukan bug aplikasi → diperbaiki di `a34dc0d` |
| `87f8ad1` | dokumentasi STATUS | [run 41851041547](https://github.com/fanelix/surface/actions/runs/41851041547) (push), [run 41851055154](https://github.com/fanelix/surface/actions/runs/41851055154) (PR) | **sukses** keduanya |
| `6aa19d2` | + perbaikan Batal saat menggambar, STATUS, acceptance | [run 41850442335](https://github.com/fanelix/surface/actions/runs/41850442335) | **sukses**: check + e2e **18 lulus, 1 skip** (bench) |
| `2ea4d7e` | M0–M2, M4–M6, M3 parsial, M7 bench | [run 41849840647](https://github.com/fanelix/surface/actions/runs/41849840647) | **sukses**: check (Vitest 132 + 4 todo) + e2e 17/17, bench di-skip |
| `c5b8755` | M0–M2, M4–M6 | [run 41849050929](https://github.com/fanelix/surface/actions/runs/41849050929) | **sukses**: check + e2e 17/17 (termasuk render WebGL) |
| `b70474d` | M0, M1, M2, M4 + perbaikan host preview | [run 41846428841](https://github.com/fanelix/surface/actions/runs/41846428841) | **sukses**: check + e2e |
| `aa9453c` | M0–M2 | [run 41845204613](https://github.com/fanelix/surface/actions/runs/41845204613) | **gagal** e2e: `Timed out waiting 180000ms from config.webServer` → diperbaiki di `b70474d` |
| `3af52a2`, `c40632e` | M1, M0 | run 2, 1 | dibatalkan oleh `cancel-in-progress` (job check `3af52a2` sukses sebelum batal) |

**PR:** [fanelix/surface#1](https://github.com/fanelix/surface/pull/1) **di-merge** ke `main` pada 2026-11-04 atas
permintaan pemilik repo (metode merge commit agar SHA per-milestone tetap ada di riwayat `main`; dikunci ke head
`005d603` yang terverifikasi). Pemantauan PR dihentikan. [fanelix/surface#2](https://github.com/fanelix/surface/pull/2)
(pembaruan STATUS) di-merge sebagai `50e7461`.

**URL produksi:** <https://slopeview.netlify.app/> — lihat bagian *Verifikasi produksi Netlify* di bawah.

## Verifikasi produksi Netlify (2026-11-04, dari container sesi ini)

- **Commit yang ter-deploy:** aset `index-C176yzGm.js`, `index-DU_fLwUX.css`, `geometry.worker-Dkjs1ykF.js` diunduh dari
  produksi dan **identik byte-per-byte** (`cmp`) dengan `npm run build` lokal dari `main` `50e7461` (Node 22.23.4). Kode
  aplikasi tidak berubah sejak `a34dc0d`; commit sesudahnya hanya dokumentasi.
- **Header:** `X-Content-Type-Options: nosniff` dan `Referrer-Policy: no-referrer` hadir → `netlify.toml` dari repo dipakai.
- **E2E terhadap produksi:** `E2E_BASE_URL=https://slopeview.netlify.app npx playwright test --retries=0` → **18 lulus,
  1 skip** (bench), 0 gagal; termasuk render WebGL dan tes tanpa data keluar.
- **Audit jaringan** (impor DXF + dua CSV + A–B + seleksi + orbit 3D, tunggu 6 s): **0 request selama alur kerja**;
  5 GET same-origin saat memuat halaman (`/`, JS, CSS, worker, `/.netlify/scripts/hud`); tidak ada request ke origin
  lain, tidak ada request non-GET/ber-body; tidak ada error/warning console. Profil bench
  `[[0,120],[20,120],[40,130],[55,130],[75,140],[100,140]]`.
- **Temuan:** Netlify menyisipkan skrip HUD (`/.netlify/scripts/hud?variant=public`) yang menampilkan badge
  "Powered by Netlify" di pojok kanan bawah. Pada 1366×768 badge itu **menutupi kolom Status baris terakhir tabel**
  yang terlihat. Bukan kode aplikasi; pemilik perlu memeriksa apakah badge/HUD dapat dimatikan di pengaturan situs Netlify.
- **Belum diverifikasi:** Deploy Preview untuk PR (belum ada PR yang dibuka sejak Netlify terhubung), smoke test dengan
  berkas site asli (M8), dan laptop target.

## Serah terima ke pelaksana berikutnya (2026-11-05)

- **Branch kerja:** `claude/amazing-feynman-aaof72`, head `1d100f1`, 2 commit di atas `main` `50e7461`.
- **PR terbuka:** [fanelix/surface#3](https://github.com/fanelix/surface/pull/3) — verifikasi produksi + M3 adapter Surpac.
  Saat serah terima: job `check` sukses di run push dan PR; job e2e masih berjalan; belum di-merge. Merge diputuskan
  pemilik repo.
- **Deploy Preview PR #3** (dari komentar Netlify bot): <https://deploy-preview-3--slopeview.netlify.app> untuk commit
  `1d100f1`. Dari container agen host ini menjawab **HTTP 401** (kemungkinan dilindungi login Netlify) → belum diuji.
  Check Netlify di PR: *Header rules* sukses, *Redirect rules* dan *Pages changed* netral.
- **Data site TIDAK ada di repo.** `pa_tes.dtm`, `pa_tes.str`, `pa_tes.dxf`, `pa_tes.ssi` hanya ada di container sesi
  sebelumnya (`private/site/`, diabaikan git) dan hilang bersama container. Untuk menjalankan
  `tests/unit/surpac-site.test.ts`, minta pemilik melampirkan ulang berkasnya lalu simpan di `private/site/` dengan nama
  tersebut. Jangan pernah meng-commit data site atau koordinatnya.
- **Jaringan container:** `slopeview.netlify.app` harus diizinkan di pengaturan Network access environment agar e2e
  terhadap produksi bisa dijalankan (`E2E_BASE_URL=https://slopeview.netlify.app npx playwright test`).
- **Langkah berikutnya yang siap:** (1) pantau PR #3 sampai CI hijau, minta persetujuan merge ke pemilik; (2) setelah
  merge, verifikasi produksi ulang (hash aset = build `main`, e2e, audit jaringan) dan catat SHA deploy; (3) M8: isi
  `docs/acceptance.md` §4 begitu engineer memberi angka Surpac, kontrol, profil A–B, toleransi, dan DXF muka segitiga.

## Perubahan yang diusulkan namun belum diterapkan

- Pembandingan DTM/STR dan DXF-TIN terhadap Surpac (M8) setelah engineer memberi kontrol, profil acuan, dan
  DXF muka segitiga dari surface yang sama.

## Diterapkan atas permintaan pemilik

- `Paket_Claude_Code_Topografi.zip` dihapus dari root. Sebelum dihapus, kedelapan isinya (`IMPLEMENTATION_PLAN.md` dan
  tujuh berkas `tests/fixtures/synthetic/`) diverifikasi identik byte-per-byte (`cmp`) dengan berkas di repo.

- CI memakai `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7` (semua `runs.using: node24`,
  diverifikasi dari `action.yml` tiap tag). `upload-artifact@v5` masih `node20`, sehingga minimal v6 diperlukan. Perubahan
  breaking v5–v7 tidak mengenai workflow ini: tidak ada `pull_request_target`/`registry-url`, `cache: npm` eksplisit.

## Milestone selesai (diterapkan dan teruji)

| Milestone | Status | Bukti |
|---|---|---|
| M0 | Selesai | `npm ci && npm run check` dari clean clone lokal exit 0, `dist/index.html` ada; CI hijau sejak `b70474d` |
| M1 | Selesai | `tests/unit/geometry.test.ts` 34 tes |
| M2 | Selesai | `tests/unit/dxf.test.ts` 29 tes |
| M3 | **Adapter terverifikasi struktural; pembandingan Surpac PENDING** | Varian teks `pa_tes` dibaca: 137.512 segitiga, 0 ditolak, TIN konsisten (`docs/acceptance.md` §3, §5). `tests/unit/surpac.test.ts` 22 tes (fixture sintetis identik dengan `bench_3dface.dxf`) + `tests/unit/surpac-site.test.ts` 4 tes lokal; 1 `it.todo` untuk pembandingan Surpac (M8) |
| M4 | Selesai | `tests/unit/profile.test.ts` 21 + `tests/unit/worker.test.ts` 13 tes |
| M5 | Selesai (preview DXF) | `tests/e2e/section.spec.ts` 11 tes, termasuk render WebGL terpisah dan Batal di tengah gambar |
| M6 | Selesai | `tests/unit/objects.test.ts` 19 + `tests/e2e/objects.spec.ts` 6 tes |
| M7 | **Parsial** | CI + e2e + `netlify.toml` + bench selesai; Netlify terhubung, produksi lulus e2e 18/18 dan audit jaringan; Deploy Preview PR dan benchmark laptop target masih menunggu |
| M8 | Belum | Bergantung M3, data kontrol site, dan Netlify |

## Milestone aktif dan checkbox berikutnya

1. **Pemilik repo (M7):** periksa badge/HUD Netlify yang menutupi tabel; pastikan Deploy Preview aktif untuk PR. PR
   berikutnya akan memverifikasi Deploy Preview.
2. **Selesai:** e2e dan audit jaringan terhadap produksi (lihat *Verifikasi produksi Netlify*).
3. **Engineer (M3/M8):** sampel DTM/STR `pa_tes` sudah diterima dan terbaca. Lengkapi `docs/acceptance.md`: angka Surpac
   (jumlah segitiga, batas E/N/Z), DXF muka segitiga dari surface yang sama, grid/datum, 3 kontrol, satu profil A–B, satu
   bor; tetapkan toleransi lapangan sebelum membandingkan.
4. **Engineer (M7):** `npm run gen:bench && npm run bench` di laptop kerja target, atau ukur langsung di aplikasi (panel
   Surface menampilkan *Impor sampai frame pertama* dan *Pembaruan profil terakhir*).

## Perintah yang dijalankan, hasil/exit code (lokal, container sesi ini)

| Perintah | Hasil |
|---|---|
| `npm ci && npm run check` (clean clone `c40632e`) | exit 0 |
| `npm run check` (`2ea4d7e`) | exit 0 — typecheck, lint 0 peringatan, Vitest **132 lulus + 4 todo** (7 berkas), build |
| `npx playwright test` (`2ea4d7e`) | exit 0 — **17 lulus, 1 skip** (bench, butuh `BENCH=1`) |
| `npx playwright test` (setelah perbaikan Batal) | exit 0 — **18 lulus, 1 skip**; tes baru terbukti gagal tanpa perbaikan (`stroke-dasharray "6 4"` tertinggal) |
| `npx playwright test -g "Batal di tengah\|geser B" --repeat-each=15 --workers=4 --retries=0` (sebelum perbaikan `readAB`) | **1 gagal / 30** — race CI tereproduksi |
| sama, `-g "Batal di tengah\|geser B\|dua klik" --repeat-each=20` (setelah perbaikan `readAB`, `a34dc0d`) | **60/60 lulus**; suite penuh 18 lulus, 1 skip; `npm run check` exit 0 |
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

- **Status Surpac site:** varian teks `pa_tes` **terbaca dan konsisten** (struktur/topologi); pembandingan terhadap angka
  Surpac (jumlah segitiga, batas, 3 kontrol, profil) **PENDING**
- **Status QA laptop target:** PENDING
- **Status Netlify:** produksi terverifikasi dengan data sintetis (e2e + audit jaringan); Deploy Preview belum diverifikasi
- **URL aktual dan commit deploy:** <https://slopeview.netlify.app/> — build identik dengan `main` `50e7461`
- **Klaim yang boleh dibuat saat ini:** preview fungsional DXF di URL di atas, plus pembacaan DTM/STR Surpac teks
  **pratinjau** (varian `pa_tes` terverifikasi struktural, belum dibandingkan dengan Surpac). Rilis penuh dukungan Surpac
  butuh pembandingan M3/M8 dengan kontrol site.

## Hambatan, pemilik tindakan, bagian lain yang dapat dilanjutkan

| Hambatan | Pemilik | Dapat dilanjutkan sementara |
|---|---|---|
| Angka Surpac untuk `pa_tes` (jumlah segitiga, batas), ≥ 3 kontrol, profil A–B, grid/datum, toleransi, DXF muka segitiga | Engineer geoteknik/survey | Impor DTM/STR `pa_tes` sudah berjalan di aplikasi |
| Badge/HUD Netlify menutupi tabel; verifikasi Deploy Preview | Pemilik repo | Produksi lulus e2e dan audit jaringan |
| Benchmark laptop kerja | Engineer | Angka container di atas sebagai indikasi |
