# Uji penerimaan site (M3 / M8)

Status (2026-11-13): **varian teks DTM/STR terverifikasi secara struktural** pada sampel site `pa_tes` (M3) **dan
dikonfirmasi oleh ekspor 3DFACE Surpac yang independen** (`pa_tes_3d.dxf`, §4a). Atas keputusan pemilik repo
(2026-11-13), jumlah segitiga, batas E/N/Z, ≥ 3 titik kontrol, dan grid/datum **dikecualikan** dari penerimaan.
Profil A–B acuan Surpac, titik/bor acuan, dan toleransi lapangan masih **PENDING** (M8).
Dokumen ini diisi bersama engineer geoteknik/survey. Koordinat site sengaja tidak dicantumkan; cukup jumlah,
selisih bertanda/absolut, dan hasil PASS/FAIL. Berkas site disimpan hanya di `private/site/` (diabaikan git).

## 1. Data yang dibutuhkan dari engineer

| Butir | Keterangan | Status |
|---|---|---|
| Pasangan DTM + STR kecil dari Surpac | Teks; sebutkan versi Surpac dan opsi ekspor | **Diterima** `pa_tes.dtm` (7.056.450 B) + `pa_tes.str` (3.415.052 B); versi Surpac & opsi ekspor belum disebut |
| DXF triangulasi dari surface yang sama | 3DFACE atau POLYFACE segitiga, ASCII | **Diterima** `pa_tes_3d.dxf` (26.044.478 B, AC1024, layer `1_0`, 64.858 3DFACE segitiga, `$INSUNITS = 1` inci padahal koordinat meter). TIN yang lebih ringan dari titik STR yang sama (§4a). `pa_tes.dxf` sebelumnya hanya string/titik → `DXF_CONTOURS_ONLY` |
| Grid / datum | Nama grid, datum horizontal, datum elevasi (RL?) | **Dikecualikan** pemilik repo (2026-11-13) |
| ≥ 3 titik kontrol tidak segaris | E, N, Z referensi | **Dikecualikan** pemilik repo (2026-11-13) |
| Satu profil A–B dari Surpac | E/N kedua ujung + elevasi crest, toe, titik patah bench | PENDING |
| Satu titik dan satu lubang bor yang diketahui | Konvensi dip, utara grid, MD, offset kiri/kanan | PENDING |
| Gaya Surpac (`.ssi`) | Tidak dibutuhkan aplikasi | Diterima `pa_tes.ssi` (hanya gaya tampilan; tidak dibaca) |
| Laptop kerja target | Spesifikasi untuk QA | Diterima: RAM 16 GB, GPU NVIDIA GTX 1050 Ti (CPU/browser belum disebut). Pengukuran di laptop itu **PENDING** |

## 2. Toleransi lapangan (ditetapkan SEBELUM melihat selisih)

| Besaran | Toleransi proyek | Dasar (presisi ekspor) | Disetujui oleh / tanggal |
|---|---|---|---|
| Elevasi profil (m) | PENDING | PENDING | PENDING |
| Chainage titik patah (m) | PENDING | PENDING | PENDING |
| Posisi titik kontrol E/N (m) | PENDING | PENDING | PENDING |

Toleransi sintetis 0,01 m (IMPLEMENTATION_PLAN.md bagian 6) **tidak** menggantikan toleransi proyek.

## 3. Metadata format (M3)

| Butir | Nilai |
|---|---|
| Versi Surpac / mode ekspor | Belum disebut. Header DTM: `pa_tes.str,<angka 10 digit>;algorithm=standard;fields=x,y`; header STR: `pa_tes,05-Nov-26,,pa_tes.ssi`. Mohon konfirmasi engineer |
| Susunan field E/N/Z pada STR | `string, Y, X, Z, , D1` → **N = kolom 2, E = kolom 3**. Bukti: 68.829 dari 68.854 titik unik ekspor DXF cocok persis; 0 cocok bila E/N ditukar |
| Penomoran vertex DTM → titik STR | **Nomor urut record STR setelah record sumbu; record pemisah ikut dinomori** (tidak pernah dirujuk). Dari 5 hipotesis hanya ini yang lolos: 0 rujukan ke pemisah, 0 segitiga degenerat, 412.366/412.366 pasangan tetangga berada di sisi berlawanan tepi bersama (0 tumpang tindih) |
| Pemisah string / record kontrol | Baris 2 STR = record sumbu `0, 0.000 × 6`; pemisah `0, 0.000, 0.000, 0.000,`; penutup `0, …, END`. 554 record `0` setelah sumbu |
| Pengelompokan OBJECT / TRISOLATION | 1 `OBJECT, 1`; 1 `TRISOLATION, 1, neighbours=yes,validated=true,closed=no,algorithm=retriangulation` |
| Struktur referensi segitiga | `id, v1, v2, v3, n1, n2, n3,` — 137.512 segitiga, id 1…137.512 berurutan; `n` = id segitiga tetangga (0 = tepi; 170 tepi batas) |
| Blok titik di awal DTM | 173 record sebelum `OBJECT`: 171 salinan titik STR + 2 record `0`; tidak diperlukan untuk geometri (diabaikan, dicatat sebagai info) |
| Varian biner? | Tidak; DTM dan STR teks ASCII dengan CRLF |

## 4. Pembandingan (M8)

**PENDING (pemeriksaan sesi Codex, 2026-11-05):** belum ada angka acuan Surpac atau persetujuan toleransi proyek
baru dari engineer pada sesi ini. Tidak ada pembandingan atau penetapan PASS/FAIL. Isi referensi dan hasil hanya
setelah engineer memberikan angka Surpac dan menetapkan toleransi §2 **sebelum** selisih dihitung. Angka hasil
aplikasi yang sudah tercantum berasal dari sesi sebelumnya (§5), bukan referensi Surpac atau validasi ulang sesi ini.
Koordinat site tetap tidak boleh ditulis dalam dokumen yang di-commit.

Masukkan A/B identik di Surpac dan aplikasi (panel **Terapkan E/N**). Bandingkan DXF dengan DTM/STR **serta**
masing-masing dengan Surpac.

| Kontrol | Referensi Surpac | Aplikasi (DXF) | Aplikasi (DTM/STR) | Selisih bertanda | Selisih absolut | PASS/FAIL |
|---|---|---|---|---|---|---|
| Jumlah segitiga | Dikecualikan (pemilik, 2026-11-13) | 64.858 (`pa_tes_3d.dxf`) | 137.512 | — | — | Dikecualikan |
| Batas E/N/Z | Dikecualikan (pemilik, 2026-11-13) | dicatat lokal | dicatat lokal | — | — | Dikecualikan |
| Kontrol 1–3 Z | Dikecualikan (pemilik, 2026-11-13) | | | — | — | Dikecualikan |
| Profil: crest | PENDING | | | | | PENDING |
| Profil: toe | PENDING | | | | | PENDING |
| Profil: ujung segmen dalam mesh | PENDING | | | | | PENDING |
| Bor: MD potong / Z potong / offset | PENDING | | | | | PENDING |
| Jumlah objek (filter mati) | PENDING | | | | | PENDING |

## 4a. DXF 3D (`pa_tes_3d.dxf`) vs DTM/STR (`pa_tes`) — pembanding independen (2026-11-13)

Dua ekspor Surpac yang berbeda jalur dibaca oleh dua pembaca aplikasi yang berbeda (DXF 3DFACE vs DTM/STR), lalu
dibandingkan dengan kode geometri aplikasi. Hanya statistik; tanpa koordinat site.

| Pemeriksaan | Hasil |
|---|---|
| Struktur | DXF: 64.858 segitiga, 32.906 vertex, 0 ditolak/vertikal/quad. DTM/STR: 137.512 segitiga, 68.842 vertex. DXF = TIN lebih ringan (±48% titik) dari titik STR yang sama |
| **Vertex DXF berimpit dengan vertex mesh DTM/STR** (cari ≤ 1 mm) | **32.904 / 32.906 (100,0%)**; maks selisih E/N **0,90 mm**, maks selisih Z **0,51 mm** — sisa pembulatan floating-point DXF (mis. akhiran `…00048828` = 1/2048). Diuji otomatis di `tests/unit/surpac-site.test.ts` (lokal) |
| Z permukaan DTM/STR di posisi vertex DXF | median 0,007 mm; p99 0,47 mm; 25 dari 32.843 > 1 cm. Ke-25 titik itu tetap berimpit dengan vertex DTM (≤ 0,5 mm, ΔZ ≤ 0,4 mm); selisih muncul karena Z diinterpolasi di posisi yang bergeser ≤ 0,5 mm pada segitiga DTM yang sangat curam → artefak pengukuran, bukan kesalahan pembaca |
| Z permukaan DXF di posisi vertex DTM | median 4,5 mm; p95 0,26 m; p99 0,84 m; maks 4,68 m → DXF memotong sudut crest/toe karena tidak memuat ±52% titik |
| Profil, 40 garis (20 B–T, 20 S–U), sampel tiap 0,5 m (49.344 sampel) | median 0,008 mm; p95 1,06 m; p99 2,44 m; maks 6,88 m; 329 sampel hanya ada di salah satu mesh (tepi) |

Kesimpulan teknis: pembaca DTM/STR (penomoran vertex, urutan Y/X, Z) **terkonfirmasi** oleh ekspor 3DFACE Surpac
pada tingkat ≤ 1 mm. Selisih profil yang besar berasal dari perbedaan **triangulasi** antar kedua ekspor, bukan dari
pembaca. Surface mana yang menjadi acuan desain/penampang, dan toleransi profilnya, adalah keputusan engineer (§2).

## 5. Hasil aplikasi pada sampel site `pa_tes` (2026-11-05, container sesi agen)

| Pemeriksaan | Hasil |
|---|---|
| Impor lewat aplikasi (browser, pilih `.dtm` + `.str` sekaligus) | 137.512 segitiga, 68.842 vertex unik, 0 muka ditolak, 0 dikeluarkan dari profil; impor 512–534 ms (3×) |
| Mesh adapter vs parser referensi independen di tes | identik (137.512/137.512 segitiga) |
| Konsistensi TIN | 412.366 pasangan tetangga, 0 tumpang tindih |
| Penampang melintang | 1 bagian profil, tanpa rentang ambigu; pembaruan 63 ms di browser |
| Data keluar dari browser | tidak ada request selain aset statis |
| Tes otomatis | `tests/unit/surpac-site.test.ts` (lokal; di-skip bila `private/site/` tidak ada) |

**Tambahan 2026-11-13** (build lokal dengan batas 50.000.000 byte; Chromium headless, container 4 core Xeon 2,1 GHz):

| Berkas | Impor | Segitiga | Puncak tambahan memori Chromium (RSS) |
|---|---|---:|---|
| `pa_tes_3d.dxf` (26.044.478 B) | 607 ms; unit inci → aplikasi meminta konfirmasi meter | 64.858 | +56 MB |
| `pa_tes.dtm` + `pa_tes.str` | 635 ms | 137.512 | +39 MB |

Yang masih dibutuhkan untuk menutup M3/M8: satu profil A–B acuan dari Surpac, satu titik/bor acuan, toleransi
lapangan, keputusan surface acuan (DTM vs DXF 3D), serta versi Surpac/opsi ekspor. Jumlah segitiga, batas E/N/Z,
≥ 3 titik kontrol, dan grid/datum dikecualikan pemilik (2026-11-13).

## 6. Hasil sintetis yang sudah teruji (pembanding, bukan pengganti site)

Fixture `tests/fixtures/synthetic/surpac/bench.{dtm,str}` (dibangkitkan `scripts/gen-surpac-fixture.py` dengan tata
letak varian terverifikasi) menghasilkan mesh **identik** dengan `bench_3dface.dxf` dan profil sesuai `expected.json`.
Lihat juga `docs/STATUS.md` → *Fixture dan angka yang diperiksa*.
