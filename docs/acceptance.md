# Uji penerimaan site (M3 / M8)

Status: **SURPAC_SITE_PENDING** — belum ada sampel DTM/STR site, DXF dari surface yang sama, atau data kontrol.
Dokumen ini adalah templat yang diisi engineer geoteknik/survey. Jangan mencantumkan koordinat sensitif bila
data tidak boleh dibagikan; cukup selisih bertanda/absolut dan hasil PASS/FAIL.

## 1. Data yang dibutuhkan dari engineer

| Butir | Keterangan | Status |
|---|---|---|
| Pasangan DTM + STR kecil dari Surpac | Teks; sebutkan versi Surpac dan opsi ekspor | PENDING |
| DXF triangulasi dari surface yang sama | 3DFACE atau POLYFACE segitiga, ASCII | PENDING |
| Grid / datum | Nama grid, datum horizontal, datum elevasi (RL?) | PENDING |
| ≥ 3 titik kontrol tidak segaris | E, N, Z referensi | PENDING |
| Satu profil A–B dari Surpac | E/N kedua ujung + elevasi crest, toe, titik patah bench | PENDING |
| Satu titik dan satu lubang bor yang diketahui | Konvensi dip, utara grid, MD, offset kiri/kanan | PENDING |

## 2. Toleransi lapangan (ditetapkan SEBELUM melihat selisih)

| Besaran | Toleransi proyek | Dasar (presisi ekspor) | Disetujui oleh / tanggal |
|---|---|---|---|
| Elevasi profil (m) | | | |
| Chainage titik patah (m) | | | |
| Posisi titik kontrol E/N (m) | | | |

Toleransi sintetis 0,01 m (IMPLEMENTATION_PLAN.md bagian 6) **tidak** menggantikan toleransi proyek.

## 3. Metadata format (M3)

| Butir | Nilai |
|---|---|
| Versi Surpac / mode ekspor | |
| Susunan field E/N/Z pada STR | |
| Penomoran vertex DTM → titik STR | |
| Pemisah string / record kontrol | |
| Pengelompokan OBJECT / TRISOLATION | |
| Struktur referensi segitiga | |
| Varian biner? | |

## 4. Pembandingan (M8)

Masukkan A/B identik di Surpac dan aplikasi (panel **Terapkan E/N**). Bandingkan DXF dengan DTM/STR **serta**
masing-masing dengan Surpac.

| Kontrol | Referensi Surpac | Aplikasi (DXF) | Aplikasi (DTM/STR) | Selisih bertanda | |Selisih| | PASS/FAIL |
|---|---|---|---|---|---|---|
| Jumlah segitiga | | | | | | |
| Batas E min/maks | | | | | | |
| Batas N min/maks | | | | | | |
| Batas Z min/maks | | | | | | |
| Kontrol 1 Z | | | | | | |
| Kontrol 2 Z | | | | | | |
| Kontrol 3 Z | | | | | | |
| Profil: crest | | | | | | |
| Profil: toe | | | | | | |
| Profil: ujung segmen dalam mesh | | | | | | |
| Bor: MD potong / Z potong / offset | | | | | | |
| Jumlah objek (filter mati) | | | | | | |

## 5. Hasil sintetis yang sudah teruji (pembanding, bukan pengganti site)

Lihat `docs/STATUS.md` → bagian *Fixture dan angka yang diperiksa*.
