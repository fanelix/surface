# Status implementasi

**Pelaksana / mode (sesi terbaru 2026-11-13):** Claude Code, agen repo di sesi cloud (baca/tulis repo, jalankan tes,
akses GitHub via MCP; host `slopeview.netlify.app` diizinkan). Lihat *Sesi Claude 2026-11-13* di bawah.

**Pelaksana / mode (sesi lanjutan 2026-11-05):** OpenAI Codex, agen repo. Kemampuan terverifikasi: baca/tulis
checkout lokal; akses GitHub dengan izin `pull`/`push`; membaca PR, status CI, job dan log Actions; menjalankan
typecheck, lint, Vitest, build dan Playwright. Runtime verifikasi utama Node 22.23.4, npm 10.9.9,
Playwright 1.63.0 / Chromium headless shell 153.0.8010.12. Tidak ada akses dashboard Netlify.

**Branch produksi:** `main` di `1b810bb` (merge PR #3, 2026-11-13); sebelumnya `50e7461`.
**Branch kerja:** `claude/amazing-feynman-aaof72`; head awal sesi `cfa0e54c30590cd6dbe8ff37abf7d11579919fe4`.
Commit kode adapter terakhir `1d100f1`; perubahan sesi ini hanya dokumentasi. PR #3 tetap terbuka; **belum di-merge**.

**SHA yang benar-benar diuji / tautan cek:**

| SHA | Isi | CI (GitHub Actions) | Hasil |
|---|---|---|---|
| `cfa0e54` (head PR #3 saat awal sesi) | adapter M3 + serah terima | [run 41964695917](https://github.com/fanelix/surface/actions/runs/41964695917) (PR, run 28) | **sukses**: check + e2e. Log checkout menunjukkan merge uji `9fd098fdcb30f9048fc7928203f6e7991c644ab6` = head `cfa0e54` + base `50e7461`; bukan merge ke `main`. Unit 141 lulus, 4 skip site, 1 todo; E2E 20 lulus, 1 skip bench |
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

## Sesi Claude 2026-11-13

### Merge PR #3 dan verifikasi produksi (2026-11-13)

- [fanelix/surface#3](https://github.com/fanelix/surface/pull/3) **di-merge** ke `main` sebagai `1b810bb` atas
  permintaan pemilik, setelah CI hijau di head `308028e` (check + e2e, run push 43363231555 dan PR 43363241352;
  check Netlify *Header rules* sukses, lainnya netral); merge commit dikunci ke head itu.
- **Produksi** <https://slopeview.netlify.app/> menyajikan build baru ~10 s setelah merge. Aset `index-BnZjTC8f.js`,
  `index-DU_fLwUX.css`, `geometry.worker-w5oahgS5.js` **identik byte-per-byte** dengan `npm run build` lokal dari
  `main` `1b810bb`.
- **E2E terhadap produksi** (`E2E_BASE_URL=https://slopeview.netlify.app npx playwright test --retries=0`):
  **20 lulus, 1 skip** (bench), termasuk dua tes M3 (pasangan DTM/STR, STR hilang) dan render WebGL.
- **Smoke test produksi dengan berkas site asli** (dipilih lokal di browser, tidak diunggah): DTM+STR impor
  677–751 ms (3×), A–B digambar ulang → 1 bagian profil, 0 rentang ambigu, pembaruan 68 ms; `pa_tes_3d.dxf`
  diterima (827 ms, unit inci → konfirmasi meter); DXF sintetis ~50 MB diterima (1,94 s, +259 MB RSS). **0 request
  ke origin lain**, 0 error halaman.
- CI push ke `main` untuk `1b810bb`: [run 43369676174](https://github.com/fanelix/surface/actions/runs/43369676174)
  sedang berjalan saat catatan ini dibuat; periksa hasilnya di tab Actions.

### Keputusan pemilik repo (2026-11-13)

- **Dikecualikan dari penerimaan:** jumlah segitiga, batas E/N/Z, ≥ 3 titik kontrol, grid/datum.
- **Batas ukuran surface dinaikkan dari 25.000.000 menjadi 50.000.000 byte per berkas** (menggantikan angka di
  IMPLEMENTATION_PLAN.md bagian 2 dan M2), karena ekspor DXF 3D site `pa_tes_3d.dxf` berukuran 26.044.478 byte.
- **Laptop kerja target:** RAM 16 GB, GPU NVIDIA GTX 1050 Ti. **Pengukuran di laptop tidak dilakukan** (keputusan
  pemilik, 2026-11-13); angka kinerja container menjadi acuan indikatif.
- **Surface acuan penampang = DTM/STR Surpac** (`pa_tes.dtm` + `pa_tes.str`), bukan DXF 3D (keputusan pemilik,
  2026-11-13). DXF 3D tetap dibaca aplikasi, tetapi triangulasinya lebih kasar (±48% titik) sehingga profilnya bisa
  berbeda hingga beberapa meter dari DTM (`docs/acceptance.md` §4a).

### Diterapkan

- `MAX_SURFACE_BYTES = 50_000_000` (`src/import/surface.ts`), teks panel impor, tes batas (49.999.999 / 50.000.000
  diterima, 50.000.001 ditolak tanpa dibaca; 26.044.478 diterima; pasangan DTM/STR per anggota), dataset tolok ukur
  `large_50mb.dxf` di `npm run gen:bench` dan `tests/e2e/bench.spec.ts`.
- `tests/unit/surpac-site.test.ts` (lokal): blok baru DXF 3D vs DTM/STR (vertex berimpit ≤ 1 mm).
- `docs/acceptance.md`: §1 data diterima/dikecualikan, §4 baris dikecualikan, §4a pembandingan DXF 3D vs DTM/STR,
  §5 hasil impor 2026-11-13.

### Teruji (lokal, container sesi ini)

- **DXF 3D site** `pa_tes_3d.dxf` (privat, tidak di-commit): 64.858 segitiga, 0 ditolak; **32.904/32.906 vertex
  berimpit dengan vertex mesh DTM/STR (maks 0,90 mm E/N, 0,51 mm Z)** → pembaca DTM/STR terkonfirmasi oleh ekspor
  3DFACE Surpac yang independen. Selisih profil antar kedua surface (p95 1,06 m) berasal dari triangulasi DXF yang
  lebih kasar, bukan pembaca (detail `docs/acceptance.md` §4a).
- **Browser (build lokal):** `pa_tes_3d.dxf` kini diterima, impor 607 ms; DTM+STR 635 ms; DXF sintetis ~50 MB
  1.447 ms; puncak tambahan RSS Chromium +56 / +39 / +260 MB; 0 request eksternal, 0 error halaman.
- **Tolok ukur** (`BENCH=1`, 3×, Xeon 2,1 GHz 4 core, bukan laptop target): lihat tabel *Kinerja*.

### Belum / PENDING

- M8: profil A–B acuan Surpac (dari DTM), titik/bor acuan, toleransi lapangan, versi Surpac/opsi ekspor.
- Selesai sejak catatan awal: surface acuan diputuskan (DTM/STR); pengukuran laptop dikecualikan; PR #3 di-merge dan
  produksi diverifikasi (lihat di atas).

## Verifikasi sesi Codex (2026-11-05)

### Diterapkan

- Memperbarui status CI, kemampuan sesi dan serah terima di dokumen ini. CI pada head awal sudah hijau;
  tidak ada perbaikan kode atau perubahan konfigurasi aplikasi/CI yang diperlukan.
- `docs/acceptance.md` §2 dan §4 menandai toleransi serta pembandingan M8 sebagai **PENDING** secara eksplisit.
  Tidak menambah angka acuan, selisih atau PASS/FAIL. Memperbaiki pemisah kolom header selisih absolut.
- Berkas site tidak dilampirkan pada sesi ini. Tidak ada data site atau koordinat site baru yang disimpan/di-commit.

### Teruji

- **CI PR #3:** run 41964695917 sudah `completed/success`. Log kedua job dibaca melalui GitHub:
  [check, job 127038879268](https://github.com/fanelix/surface/actions/runs/41964695917/job/127038879268)
  dan [e2e, job 127039176621](https://github.com/fanelix/surface/actions/runs/41964695917/job/127039176621).
- **Lokal pada `cfa0e54`:** `npm ci` exit 0; `npm run check` exit 0 (141 lulus, 4 skip site, 1 todo; typecheck,
  lint dan build sukses). `npx playwright test` exit 0: **20 lulus, 1 skip** (bench), termasuk render WebGL.
- `npx vitest run tests/unit/surpac-site.test.ts` exit 0 tetapi **4 skip**, karena `private/site/` tidak tersedia.
  Ini **bukan** verifikasi ulang sampel `pa_tes`; angka site di bagian historis berasal dari sesi Claude sebelumnya.
- **Produksi:** HTTP 200. Build dilakukan di worktree terpisah dari `main` `50e7461`, dengan lockfile yang sama
  dan Node/npm sesuai `.nvmrc`. Ketiga aset yang dirujuk HTML/worker produksi identik byte-per-byte dengan build:

| Aset produksi = build `main` | Byte | SHA-256 kedua salinan |
|---|---:|---|
| `index-C176yzGm.js` | 840.331 | `666901ad3ed22bd5fce7dcf3c20b0edd3898c8cd029c2f8c5cbabcd762d9354b` |
| `index-DU_fLwUX.css` | 5.311 | `655d332efaaa5c09b9e16c56c52201ea206a43e643cdcc39cabead9f4e4fb6de` |
| `geometry.worker-Dkjs1ykF.js` | 28.449 | `c4d6bb612b07e5951e2f5a4c86c1ef3c49b71b6d0dc3c7f8d90c9bd316c78e9c` |

Kesamaan ini membuktikan kesetaraan aset aplikasi dengan build `main`; tidak membuktikan metadata commit internal
deploy Netlify, yang tidak tersedia melalui dashboard pada sesi ini. Header `nosniff` dan `no-referrer` hadir.

- **E2E produksi dari suite `main` `50e7461`:** **18 lulus, 1 skip** (bench), 0 gagal, termasuk WebGL;
  waktu 3,0 menit, tanpa retry. Hasil ini memakai adapter proxy sementara yang dijelaskan di bawah.
- **Audit jaringan produksi:** impor DXF sintetis + dua CSV, A–B, seleksi BH-01, orbit 3D dan tunggu 6 s.
  Lima GET same-origin saat memuat halaman (`/`, JS, CSS, worker dan `/.netlify/scripts/hud?variant=public`);
  **0 request selama alur kerja**, 0 origin lain, 0 non-GET/ber-body, 0 WebSocket, 0 request gagal,
  0 error/warning console. Profil sintetis cocok dengan `expected.json`.
- **Deploy Preview:** check Netlify `success`, URL yang dikembalikan GitHub
  <https://deploy-preview-3--slopeview.netlify.app> masih **HTTP 401** dari container; alur aplikasi preview belum diuji.

### Batas lingkungan pengujian

Unduhan Chromium melalui CDN Playwright mengembalikan HTML `Site Unavailable`; headless shell versi yang tepat
diambil dari penyimpanan resmi Chrome for Testing, diperiksa ukuran/MD5 terhadap header upstream dan integritas ZIP.
Browser lokal kemudian berjalan normal. Perintah E2E produksi standar sempat gagal saat navigasi
(`ERR_EMPTY_RESPONSE`): Chromium tidak otomatis memakai proxy environment. Setelah proxy dipasang eksplisit,
terlihat `ERR_CERT_AUTHORITY_INVALID` dari sertifikat proxy. Adapter Playwright **sementara, diabaikan git**
memakai proxy environment dan `ignoreHTTPSErrors: true`. Audit jaringan memakai pengaturan sesi yang sama.
Tidak ada perubahan ini dalam konfigurasi aplikasi atau CI; validitas rantai sertifikat TLS publik bukan hasil uji sesi ini.

| Perintah sesi ini | Checkout | Hasil / exit code |
|---|---|---|
| `npm ci` | branch kerja `cfa0e54` | 0 |
| `npm run check` | branch kerja `cfa0e54` | 0; 141 unit lulus, 4 skip, 1 todo; typecheck/lint/build lulus. Dijalankan pada Node awal 24.22.1 lalu ulang dengan Node 22.23.4 sesuai repo |
| `npx playwright test` | branch kerja `cfa0e54` | 0; 20 lulus, 1 skip |
| `npx vitest run tests/unit/surpac-site.test.ts` | branch kerja `cfa0e54` | 0; 4 skip, bukan PASS site |
| `npm run build` | worktree `main` `50e7461` | 0; Node 22.23.4; 3/3 hash aset sama dengan produksi |
| `E2E_BASE_URL=https://slopeview.netlify.app npx playwright test` | worktree `main` `50e7461` | 1; 18 gagal navigasi sebelum alur aplikasi karena proxy browser belum dipasang; 1 skip |
| `E2E_BASE_URL=https://slopeview.netlify.app npx playwright test --config private/verification/production.config.ts` | worktree `main` `50e7461` | 0; **18 lulus, 1 skip**; adapter sementara mewarisi suite repo, menambah `proxy` environment dan `ignoreHTTPSErrors: true` saja |
| `node private/verification/production-audit.mjs` | worktree `main` `50e7461` | 0; audit sintetis di atas, konfigurasi proxy/sertifikat sesi yang sama |

Adapter dan log mentah hanya berkas sesi lokal diabaikan git, bukan dependensi repo. Tidak ada perubahan fixture atau
ekspektasi tes produksi. Pada lingkungan tanpa proxy, mulai kembali dengan perintah standar.

### Usulan / pekerjaan PENDING

- M8: tunggu angka Surpac, grid/datum, ≥3 kontrol, profil A–B, titik/bor acuan, DXF muka segitiga dari surface yang sama,
  serta toleransi proyek yang ditetapkan engineer **sebelum** menghitung selisih.
- M7: uji laptop target, periksa HUD/badge Netlify dan akses Deploy Preview bersama pemilik. Kehadiran skrip HUD
  diperiksa ulang; posisi badge yang menutupi tabel pada sesi sebelumnya belum dinilai ulang secara visual.
- Merge PR #3 menunggu persetujuan pemilik repo. Sesi ini tidak melakukan merge atau mengaktifkan auto-merge.

## Verifikasi produksi Netlify (historis: 2026-11-04, sesi Claude)

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

## Serah terima ke pelaksana berikutnya (diperbarui Codex, 2026-11-05)

> **Pembaruan 2026-11-13 (Claude):** pada sesi ini `private/site/` berisi `pa_tes.dtm`, `pa_tes.str`, `pa_tes.dxf`,
> `pa_tes.ssi` dan `pa_tes_3d.dxf`; `tests/unit/surpac-site.test.ts` **5/5 lulus**. Container lain tidak memiliki
> berkas ini — minta pemilik melampirkan ulang. Batas ukuran sekarang 50.000.000 byte (keputusan pemilik). Butir di
> bawah adalah catatan 2026-11-05; untuk keadaan terbaru lihat *Sesi Claude 2026-11-13*.

- **Branch kerja:** `claude/amazing-feynman-aaof72`; head awal sesi `cfa0e54`, kode adapter `1d100f1`.
  Baca SHA head dokumentasi terbaru dari remote; jangan menganggap SHA awal sesi sebagai head berikutnya.
- **PR terbuka:** [fanelix/surface#3](https://github.com/fanelix/surface/pull/3). CI untuk head awal `cfa0e54`
  **hijau** (check + E2E, run 41964695917); kedua log sudah dibaca. Perubahan sesi ini hanya dua dokumen.
  Periksa CI pada head terbaru sebelum melanjutkan. **Jangan merge tanpa persetujuan pemilik.**
- **Produksi:** <https://slopeview.netlify.app/> menjawab HTTP 200; tiga hash aset sama dengan build `main`
  `50e7461`; E2E **18 lulus, 1 skip**; audit jaringan sintetis 0 request selama alur kerja.
  Lihat hasil dan batas proxy di *Verifikasi sesi Codex*.
  Produksi tetap versi sebelum adapter Surpac PR #3; tes produksi memakai suite dari `main`, bukan dua tes Surpac baru.
- **Deploy Preview:** <https://deploy-preview-3--slopeview.netlify.app> masih HTTP 401. Check deploy GitHub sukses
  tidak berarti alur aplikasi preview sudah diuji.
- **Data site TIDAK ada di repo maupun sesi ini.** Bila pemilik melampirkan ulang `pa_tes.dtm`, `.str`, `.dxf`,
  simpan hanya di `private/site/` (sudah terverifikasi diabaikan git), lalu jalankan
  `npx vitest run tests/unit/surpac-site.test.ts`. Saat ini 4 skip; jangan menyebutnya PASS.
  Jangan pernah meng-commit data site, koordinatnya, screenshot atau trace yang memuatnya.
- **M8 PENDING:** tidak ada angka Surpac atau persetujuan toleransi baru. Isi §4 hanya setelah engineer memberi
  data; tetapkan toleransi §2 terlebih dahulu. Toleransi sintetis bukan toleransi proyek.
- **Langkah berikutnya:** periksa CI head terbaru; pemilik memutuskan merge PR #3; engineer melengkapi M8 dan
  benchmark laptop. Setelah merge yang disetujui, ulangi build `main`, hash aset, E2E, audit jaringan dan smoke test site.

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

## Perintah historis, hasil/exit code (lokal, sesi Claude sebelumnya)

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
- **Batas byte (sejak 2026-11-13: 50.000.000):** 26.044.478, 49.999.999 dan 50.000.000 dibaca; 50.000.001 ditolak
  tanpa pembacaan (spy). Pasangan DTM/STR: dua berkas tepat 50.000.000 byte dibaca; satu anggota 50.000.001 → tidak ada
  yang dibaca. (Sebelumnya 25.000.000 dengan uji 24.999.999/25.000.000/25.000.001.)

## Kinerja (indikatif — container sesi, BUKAN laptop target)

Pengukuran historis sesi Claude sebelumnya: Chromium 153 headless, WebGL SwiftShader (perangkat lunak), Intel Xeon 2,8 GHz 4 core, RAM 17 GB, Linux. Tiga
pengulangan. Impor: pemilihan berkas → frame pertama. Profil: pelepasan pegangan B → grafik.

| Dataset | Byte | Segitiga | Impor median / maks | Profil median / maks |
|---|---:|---:|---|---|
| small_500kb.dxf | 489.882 | 2.450 | 130 ms / 132 ms | 6,8 ms / 18,6 ms |
| medium_5mb.dxf | 4.931.696 | 24.642 | 536 ms / 558 ms | 7,0 ms / 7,5 ms |
| large_25mb.dxf | 24.733.962 | 123.008 | 1.508 ms / 1.617 ms | 39 ms / 234 ms |

Pengukuran 2026-11-13 (sesi Claude; Chromium 153 headless, SwiftShader, Intel Xeon 2,1 GHz 4 core, RAM 17 GB):

| Dataset | Byte | Segitiga | Impor median / maks | Profil median / maks |
|---|---:|---:|---|---|
| small_500kb.dxf | 489.882 | 2.450 | 82 ms / 99 ms | 12 ms / 14 ms |
| medium_5mb.dxf | 4.931.696 | 24.642 | 255 ms / 321 ms | 6 ms / 16 ms |
| large_25mb.dxf | 24.733.962 | 123.008 | 687 ms / 752 ms | 13 ms / 13 ms |
| **large_50mb.dxf** | 49.638.319 | 246.402 | **1.398 ms / 1.587 ms** | 53 ms / 147 ms |

Puncak tambahan memori total proses Chromium (RSS, sampel 50 ms) saat impor `large_50mb.dxf`: **+260 MB**.
Target awal (median ≤ 15 s impor, ≤ 1 s profil) terpenuhi di lingkungan ini. Laptop target (RAM 16 GB,
GTX 1050 Ti): pengukuran **PENDING**.

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

- **Status Surpac site:** varian teks `pa_tes` terverifikasi struktur/topologi **dan dikonfirmasi oleh ekspor 3DFACE
  Surpac independen** (2026-11-13, 5/5 tes site lokal lulus). Jumlah segitiga, batas, 3 kontrol, grid dikecualikan
  pemilik; profil A–B acuan, titik/bor acuan dan toleransi **PENDING**
- **Status QA laptop target:** **dikecualikan** pemilik (2026-11-13); spesifikasi tercatat (16 GB RAM, GTX 1050 Ti),
  kinerja hanya diukur di container (DXF ~50 MB impor median 1,40 s, profil 53 ms)
- **Status Netlify:** produksi `1b810bb` terverifikasi (aset identik, e2e 20/20, smoke test site asli, 0 request keluar); Deploy Preview masih HTTP 401 dari container
- **URL aktual dan kesetaraan aset:** <https://slopeview.netlify.app/> — build identik dengan `main` `50e7461`;
  metadata SHA commit deploy internal Netlify tidak tersedia pada sesi Codex
- **Klaim yang boleh dibuat saat ini:** aplikasi produksi di URL di atas membaca DXF 3DFACE/POLYFACE dan pasangan
  Surpac DTM/STR teks (varian `pa_tes`, dikonfirmasi ekspor 3DFACE Surpac ≤ 1 mm di vertex), hingga 50.000.000 byte per
  berkas. Surface acuan penampang: DTM/STR. Belum boleh diklaim: kesesuaian profil terhadap profil acuan Surpac dan
  toleransi lapangan (M8). Kinerja di laptop target tidak diukur (dikecualikan pemilik); angka container bersifat indikatif.

## Hambatan, pemilik tindakan, bagian lain yang dapat dilanjutkan

| Hambatan | Pemilik | Dapat dilanjutkan sementara |
|---|---|---|
| Profil A–B acuan Surpac dari DTM, titik/bor acuan, toleransi lapangan | Engineer geoteknik/survey | Impor DTM/STR (acuan) dan DXF 3D `pa_tes` sudah berjalan di produksi dan saling cocok ≤ 1 mm di vertex |
| Badge/HUD Netlify menutupi tabel; verifikasi Deploy Preview | Pemilik repo | Produksi lulus e2e dan audit jaringan |
