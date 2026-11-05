# Uji penerimaan site (M3 / M8)

Status (2026-11-05): **varian teks DTM/STR terverifikasi secara struktural** pada sampel site `pa_tes` (M3).
Pembandingan terhadap Surpac (kontrol, penampang, toleransi lapangan) masih **PENDING** (M8).
Dokumen ini diisi bersama engineer geoteknik/survey. Koordinat site sengaja tidak dicantumkan; cukup jumlah,
selisih bertanda/absolut, dan hasil PASS/FAIL. Berkas site disimpan hanya di `private/site/` (diabaikan git).

## 1. Data yang dibutuhkan dari engineer

| Butir | Keterangan | Status |
|---|---|---|
| Pasangan DTM + STR kecil dari Surpac | Teks; sebutkan versi Surpac dan opsi ekspor | **Diterima** `pa_tes.dtm` (7.056.450 B) + `pa_tes.str` (3.415.052 B); versi Surpac & opsi ekspor belum disebut |
| DXF triangulasi dari surface yang sama | 3DFACE atau POLYFACE segitiga, ASCII | **Belum sesuai**: `pa_tes.dxf` (AC1032) berisi 512 POLYLINE 3D + 40 LINE + 66.410 POINT (string/titik STR), bukan TIN; `$INSUNITS = 1` (inci). Aplikasi menolaknya sebagai `DXF_CONTOURS_ONLY`. Mohon ekspor DTM sebagai DXF muka segitiga (3DFACE) |
| Grid / datum | Nama grid, datum horizontal, datum elevasi (RL?) | PENDING |
| ≥ 3 titik kontrol tidak segaris | E, N, Z referensi | PENDING |
| Satu profil A–B dari Surpac | E/N kedua ujung + elevasi crest, toe, titik patah bench | PENDING |
| Satu titik dan satu lubang bor yang diketahui | Konvensi dip, utara grid, MD, offset kiri/kanan | PENDING |
| Gaya Surpac (`.ssi`) | Tidak dibutuhkan aplikasi | Diterima `pa_tes.ssi` (hanya gaya tampilan; tidak dibaca) |

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
| Jumlah segitiga | PENDING | — (DXF bukan TIN) | 137.512 | | | PENDING |
| Batas E min/maks | PENDING | | | | | PENDING |
| Batas N min/maks | PENDING | | | | | PENDING |
| Batas Z min/maks | PENDING | | | | | PENDING |
| Kontrol 1 Z | PENDING | | | | | PENDING |
| Kontrol 2 Z | PENDING | | | | | PENDING |
| Kontrol 3 Z | PENDING | | | | | PENDING |
| Profil: crest | PENDING | | | | | PENDING |
| Profil: toe | PENDING | | | | | PENDING |
| Profil: ujung segmen dalam mesh | PENDING | | | | | PENDING |
| Bor: MD potong / Z potong / offset | PENDING | | | | | PENDING |
| Jumlah objek (filter mati) | PENDING | | | | | PENDING |

## 5. Hasil aplikasi pada sampel site `pa_tes` (2026-11-05, container sesi agen)

| Pemeriksaan | Hasil |
|---|---|
| Impor lewat aplikasi (browser, pilih `.dtm` + `.str` sekaligus) | 137.512 segitiga, 68.842 vertex unik, 0 muka ditolak, 0 dikeluarkan dari profil; impor 512–534 ms (3×) |
| Mesh adapter vs parser referensi independen di tes | identik (137.512/137.512 segitiga) |
| Konsistensi TIN | 412.366 pasangan tetangga, 0 tumpang tindih |
| Penampang melintang | 1 bagian profil, tanpa rentang ambigu; pembaruan 63 ms di browser |
| Data keluar dari browser | tidak ada request selain aset statis |
| Tes otomatis | `tests/unit/surpac-site.test.ts` (lokal; di-skip bila `private/site/` tidak ada) |

Yang masih dibutuhkan untuk menutup M3/M8: jumlah segitiga dan batas E/N/Z menurut Surpac, ≥ 3 titik kontrol,
satu profil A–B dari Surpac, grid/datum, toleransi lapangan, dan DXF muka segitiga dari surface yang sama.

## 6. Hasil sintetis yang sudah teruji (pembanding, bukan pengganti site)

Fixture `tests/fixtures/synthetic/surpac/bench.{dtm,str}` (dibangkitkan `scripts/gen-surpac-fixture.py` dengan tata
letak varian terverifikasi) menghasilkan mesh **identik** dengan `bench_3dface.dxf` dan profil sesuai `expected.json`.
Lihat juga `docs/STATUS.md` → *Fixture dan angka yang diperiksa*.
