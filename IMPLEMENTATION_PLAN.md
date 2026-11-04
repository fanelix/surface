# Rencana implementasi · Topografi 3D dan penampang geoteknik 2D

**Pelaksana:** Claude Code, OpenAI Codex, atau DeepSeek. Pilih satu untuk memulai. Semuanya memakai milestone M0–M8, data uji, dan kriteria lulus yang sama. Jika berpindah alat, lanjutkan dari branch kerja dan catatan di `docs/STATUS.md`. Paket ZIP memuat rencana ini dan data uji sintetis.

**Tujuan pengguna** — Seorang engineer membuka DXF atau DTM Surpac hingga 25 MB di browser, menambahkan titik dan lubang bor, kemudian menarik garis A–B dan memperoleh satu penampang 2D yang menampilkan seluruh objek beserta offsetnya.

**Arsitektur** — Aplikasi statis dengan perhitungan lokal. Satu Web Worker memegang mesh berpresisi penuh dan indeks spasial. Viewer Three.js dan grafik SVG menerima hasil dari model koordinat yang sama. React + TypeScript + Vite, Vitest untuk pengujian numerik, Playwright untuk alur browser. GitHub menyimpan kode dan data sintetis. Netlify membangun dan menyajikan aplikasi.

**Dasar desain** — Rencana Aplikasi Topografi dan Penampang, 4 November 2026. Seluruh aturan fungsional yang diperlukan sudah dicantumkan di sini. Versi awal memuat satu surface aktif, satu garis lurus A–B yang dapat digeser, dan lubang bor lurus. Data operasional berada di memori sesi browser. Memuat ulang halaman mengakhiri sesi tersebut.

## 1. Cara mulai melalui browser

1. Buat atau pilih repo khusus di GitHub. Untuk repo baru, inisialisasi dengan README agar ada branch pertama. Unduh dan ekstrak paket. Unggah **isi** folder hasil ekstraksi ke root repo melalui **Add file → Upload files**. Di root harus terlihat `IMPLEMENTATION_PLAN.md` dan `tests/fixtures/synthetic/`. GitHub tidak otomatis menguraikan ZIP yang diunggah.
2. Pilih cara kerja dari tabel berikut. Gunakan satu branch untuk rangkaian pekerjaan yang akan diteruskan. Pilih branch atau commit terbaru setiap kali membuka sesi di alat lain.
3. Tempel **prompt pembuka** di bawah. Jika hanya memakai Markdown, buat fixture dari spesifikasi bagian 6 sebelum M1. Untuk sampel DTM/STR site yang tidak boleh dibagikan, engineer menjalankan uji penerimaan secara lokal melalui browser.
4. Setelah M0 menghasilkan kerangka yang bisa dibangun, hubungkan repo ke Netlify sesuai M7. Uji perubahan pada Deploy Preview. Pemilik repo menyetujui merge ke branch produksi.

| Alat / lingkungan | Cara mulai | Siapa yang menerapkan perubahan dan menjalankan tes |
|---|---|---|
| Claude Code | Buka sesi pada repo GitHub yang dipilih, lalu berikan prompt pembuka. | Agen mengedit branch kerja. Jalankan tes di sesi atau lewat CI untuk commit tersebut. |
| OpenAI Codex | Buka tugas coding di workspace yang memuat repo, atau pilih repo dan environment pada Codex cloud. Berikan prompt pembuka dengan akses edit. | Agen mengedit repo dan menjalankan perintah yang tersedia. Gunakan hasil CI untuk tes yang membutuhkan runner lain. |
| DeepSeek di coding agent | Pilih DeepSeek sebagai model pada coding agent yang terhubung ke workspace repo. Periksa apakah lingkungan menyediakan edit file dan eksekusi perintah. | Agen memakai kemampuan yang tersedia. Jika akses eksekusi terbatas, arahkan tes ke CI. |
| DeepSeek Chat atau sesi chat tanpa akses repo | Lampirkan rencana, fixture yang diperlukan, dan file sumber untuk milestone aktif. Pada sesi lanjutan sertakan juga status dan SHA branch terbaru. | Chat menyiapkan perubahan per file. Pemilik menerapkannya melalui editor GitHub dan membuka PR. GitHub Actions menjalankan tes. Gunakan log hasilnya untuk iterasi berikutnya. |

### Prompt pembuka untuk ketiga alat

```text
Baca IMPLEMENTATION_PLAN.md, instruksi repo, dan docs/STATUS.md jika sudah ada. Mulai dari milestone pertama yang dependensinya siap. Nyatakan kemampuan sesi yang tersedia: baca/tulis repo, jalankan tes, dan akses GitHub. Gunakan branch kerja yang dipilih.

Jika memiliki workspace, terapkan kode dan tes, perbaiki kegagalan, lalu lanjutkan ke milestone berikutnya yang siap. Jika hanya memiliki chat, tangani satu milestone per iterasi. Minta hanya file sumber yang belum diberikan dan diperlukan. Untuk tiap perubahan berikan path, jenis perubahan, dan isi file siap ditempel ke editor GitHub atau patch bila pengguna dapat menerapkannya. Sertakan tes, perintah CI dan hasil yang diharapkan. Tunggu log dari commit yang memuat perubahan sebelum menandai tes lulus.

Gunakan tests/fixtures/synthetic/ dan expected.json sebagai pembanding independen. Jika sampel asli belum ada, catat SURPAC_SITE_PENDING dan lanjutkan DXF, viewer 3D, penampang 2D, CSV serta preview. Rilis penuh memerlukan verifikasi DTM/STR sesuai M3 dan M8.

Perbarui docs/STATUS.md atau berikan isi pembaruannya untuk diterapkan pemilik repo. Pisahkan perubahan yang masih berupa usulan, perubahan yang sudah diterapkan, dan hasil yang sudah teruji. Cantumkan SHA, log CI, PR, serta URL preview hanya jika tersedia. Pemilik repo menyetujui merge produksi.
```

**Untuk pengguna yang bekerja lewat browser.** Pada mode chat, terapkan perubahan di branch kerja, buka PR, lalu baca hasil pada tab **Checks**. Kirim kembali SHA, nama cek, dan pesan kesalahan pertama jika ada. Jika M0 memerlukan pembuatan lockfile untuk repo baru, jalankan langkah itu di workspace agen yang memiliki npm, atau gunakan workspace pengembangan berbasis browser yang memiliki npm dan simpan lockfile ke branch. Setelah lockfile tersedia, CI dapat memakai `npm ci`.

## 2. Kontrak pengguna dan keputusan implementasi

| Bagian | Perilaku yang harus dapat diuji |
|---|---|
| Surface | DXF ASCII triangulasi 3DFACE atau POLYFACE segitiga, atau satu pasangan .dtm + .str Surpac pada varian yang diverifikasi. Tolak ukuran > 25.000.000 byte per berkas surface sebelum membaca isi. Dua file pasangan masing-masing boleh tepat 25 MB. |
| Koordinat | Easting, Northing, dan elevasi memakai meter serta datum yang sama. Tampilkan identitas grid/datum yang diisi atau dikonfirmasi pengguna. Jika DXF tanpa unit, minta konfirmasi meter. Peringatkan bila unit bukan meter atau batas koordinat mencurigakan. Hindari menebak EPSG dan menukar E/N otomatis. |
| Input titik | Nama Titik, Easting, Northing, Elevation. Sediakan formulir manual dan CSV. Plot nama dan posisi asli di 3D. |
| Input bor | Nama Titik Bor, Easting, Northing, Elevation collar, Kedalaman sepanjang lubang (MD), Azimuth, Dip. Sediakan formulir dan CSV. Gambarkan collar, toe, serta lintasan lurus di 3D. |
| Garis penampang | Tampak atas dengan utara di atas, timur di kanan. Dua klik A lalu B atau satu gerak tarik A ke B dengan mode gambar aktif. Pegangan A/B dapat digeser. Beri arah, panjang, tombol Balik A/B, Batal dan Fit. Tampilkan E/N kedua ujung. |
| Penampang | Sumbu X = chainage horizontal dari A (m). Sumbu Y = elevasi asli (mRL bila datum RL dikonfirmasi). Profil TIN terpotong pada celah. Default skala horizontal dan vertikal setara, atau tampilkan faktor pembesaran vertikal yang dihitung bila skala disesuaikan. |
| Semua objek | Saat filter mati, semua titik dan semua lintasan bor valid diproyeksikan, termasuk di luar A/B dan di luar cakupan mesh. Sumbu menampung seluruh objek. Daerah di luar ujung garis diarsir. Ujung profil topografi tetap dibatasi A/B. |
| Offset | Label menyebut magnitude dan kata kiri/kanan/tepat pada bidang. Untuk bor tampilkan offset collar dan toe serta penanda potong. Seleksi objek menyinkronkan grafik dengan baris tabel yang memuat nilai numerik. |
| Tampilan | Antarmuka berbahasa Indonesia, nama objek apa adanya. Panel Data / Topografi / Penampang dan tabel dapat dipakai saat layar laptop 1366 × 768. Simbol, teks, dan pola garis membedakan profil, proyeksi, dan titik potong. |

### Tanggung jawab dan dependensi

- **Pelaksana milestone** menyiapkan kode, fixture tambahan, tes, CI, dan konfigurasi Netlify. Pada mode chat, pemilik repo menerapkan perubahan yang diusulkan. Pelaksana mencatat perintah yang benar-benar dijalankan beserta hasil lokal atau log CI pada SHA yang diuji.
- **Engineer geoteknik/survey** menyediakan satu pasangan DTM/STR kecil dari Surpac, DXF triangulasi dari surface yang sama, versi/opsi ekspor, grid/datum, minimal tiga titik kontrol yang tidak segaris, serta satu profil A–B lengkap dengan koordinat kedua ujung dan titik patah bench. Bila berkas site tidak dapat dibagikan, engineer menjalankan uji browser dan mengembalikan hasil tanpa koordinat sensitif.
- **Pemilik repo/Netlify** memilih repo, menghubungkan layanan dari dashboard dan menyetujui merge produksi. M0–M7 dapat menghasilkan preview berbasis DXF. Rilis yang menyatakan dukungan format Surpac site harus lulus M3 dan M8.

## 3. Struktur repo dan antarmuka antarmodul

Pakai struktur ini untuk repo baru. Jika repo telah berisi aplikasi, dokumentasikan padanan nama file dan pertahankan titik masuk yang dipakai pengguna.

| Lokasi yang diusulkan | Tanggung jawab |
|---|---|
| `src/domain/types.ts`, `coordinates.ts` | Tipe mesh, titik, bor, section, laporan validasi, transformasi koordinat dunia/layar |
| `src/import/surface.ts`, `dxf.ts`, `surpac.ts`, `objects.ts` | Batas byte, pengenalan format, parser, validasi CSV/form dan pelaporan per baris atau per muka |
| `src/geometry/section.ts`, `borehole.ts`, `profile.ts`, `mesh-index.ts` | Empat modul murni untuk basis A–B, toe/interseksi, pemotongan TIN serta indeks spasial |
| `src/worker/geometry.worker.ts`, `protocol.ts` | Pemilik mesh dan perhitungan berat, pembatalan, identitas versi surface serta permintaan |
| `src/ui/ImportPanel.tsx`, `ObjectPanel.tsx`, `TerrainView.tsx`, `SectionView.tsx`, `ObjectTable.tsx`, `App.tsx` | Alur kerja pengguna, kamera, input garis, gambar 2D, seleksi, tabel dan pesan status |
| `tests/unit/`, `tests/e2e/`, `tests/fixtures/synthetic/` | Tes fungsi, tes lintas antarmuka, data contoh tetap dan hasil pembanding |
| `docs/STATUS.md`, `docs/acceptance.md`, `.github/workflows/ci.yml`, `netlify.toml` | Catatan kelanjutan, hasil pembandingan site, pemeriksaan PR dan build hosting |

Kontrak berikut menetapkan makna data. Nama implementasi boleh mengikuti konvensi repo jika pemetaannya dicatat.

```ts
type XY = { e: number; n: number }
type ENZ = XY & { z: number }
type NamedPoint = ENZ & { id: string; name: string }
type Borehole = { id: string; name: string; collar: ENZ; md: number; azDeg: number; dipDeg: number }
type Section = { a: XY; b: XY }
type Projected = { s: number; o: number; z: number }
type Mesh = { xyz: Float64Array; triangles: Uint32Array } // E,N,Z triples and 0-based indices
type ProfileVertex = { s: number; z: number }
type Profile = { parts: ProfileVertex[][]; ambiguous: [number, number][] }
type PlaneHit =
  | { kind: 'none' | 'in-plane' }
  | { kind: 'touch' | 'cross'; md: number; s: number; z: number; onAB: boolean }

projectPoint(p: ENZ, section: Section): Projected
boreholeToe(hole: Borehole): ENZ
intersectBorehole(hole: Borehole, section: Section): PlaneHit
sliceSurface(mesh: Mesh, index: MeshIndex, section: Section): Profile
```

`MeshIndex` berisi bounding box segitiga pada bidang E/N dan operasi pencarian kandidat. Setiap perubahan A/B memakai indeks yang sama sampai surface berubah. Validasi menghasilkan daftar masalah dengan kode, severity, pesan Indonesia dan lokasi (file, layer, baris atau face ID). Pertahankan nilai sumber pada pratinjau.

**Worker.** Pesan minimal `loadSurface`, `selectSurface`, `computeSection`, dan `cancel`; balasan `choices`, `progress`, `surfaceReady`, `sectionReady`, atau `error`. Sertakan `surfaceVersion` dan `requestId`. Worker mempertahankan mesh Float64 dan hanya mengirim buffer render terpisah dengan origin lokal. Hindari memindahkan buffer mesh utama sampai terlepas dari pemiliknya. Saat impor rumit dibatalkan, worker baru untuk kandidat dapat dihentikan dan surface aktif sebelumnya dipertahankan. Hasil perhitungan yang terlambat diabaikan berdasarkan versi dan request. Untuk pembatalan komputasi panjang, proses per batch dan beri giliran event loop atau terminasi worker kandidat.

## 4. Aturan geometri yang harus diimplementasikan

### 4.1 Koordinat dunia, kamera, dan garis A–B

Gunakan angka 64-bit untuk hitungan mesh, elevasi, dan geometri. Tetapkan origin lokal dekat pusat surface untuk GPU. Dengan Three.js sumbu Y ke atas, salah satu pemetaan konsisten adalah `worldToRender(E,N,Z) = (E−E0, Z−Z0, −(N−N0))`. Balikkan pemetaan saat picking. Di tampak atas gunakan kamera ortografis dan bidang E/N untuk menggambar, agar pengguna bisa menempatkan A/B di luar mesh maupun di celah. Pengujian harus meliputi koordinat dunia jutaan meter.

Untuk A dan B berbeda, tetapkan `L = hypot(Eb−Ea, Nb−Na)`, `uE = (Eb−Ea)/L`, `uN = (Nb−Na)/L`. Untuk titik P, `dE = Ep−Ea`, `dN = Np−Na`.

```text
chainage s = dE·uE + dN·uN
offset   o = uE·dN − uN·dE
posisi 2D  = (s, Zp)
```

Sisi kiri bernilai positif bila melihat A → B. Gunakan jarak bertanda ke **garis tak berhingga** agar titik sebelum A dan sesudah B tidak ditumpuk di ujung. Pada pembalikan garis, `s' = L−s`, `o' = −o`, Z tetap. Bedakan toleransi numerik (awalnya 10⁻⁶ m untuk perbandingan jarak lokal) dari toleransi uji 0,01 m. Untuk luas/arah gunakan toleransi berskala sesuai dimensi. Tolak garis ketika L berada dalam toleransi nol dan beri pesan untuk memindahkan B.

### 4.2 Penampang surface dari segitiga asli

1. Validasi tiga indeks, angka finite dan luas proyeksi horizontal. Segitiga vertikal/degenerat ditandai serta dikeluarkan dari profil topografi 2.5D. Tampilkan jumlah muka terdampak. Jika tidak tersisa topografi yang dapat dipotong, beri pesan.
2. Cari segitiga kandidat melalui indeks spasial lalu klip **seluruh segmen horizontal AB** terhadap segitiga pada bidang E/N. A dan B yang berada di dalam segitiga adalah titik potong yang sah. Bila AB berimpit dengan sisi, pertahankan interval yang tumpang tindih.
3. Interpolasikan Z di ujung setiap interval secara barycentric atau dengan persamaan bidang segitiga. Urutkan menurut s. Gabungkan duplikat tepi bersama dengan s dan Z setara. Pertahankan patahan bench dan gap. Jangan menggambar garis penghubung menyeberangi area tanpa segitiga. Jika interval yang sama mempunyai Z berbeda, pecah profil dan tampilkan rentang ambigu beserta pilihan layer/objek untuk diperiksa.
4. Profil hanya berlaku pada `0 ≤ s ≤ L`. Tampilan boleh diperluas untuk menampilkan objek di luar A/B. Uji potongan searah maupun berlawanan, kedua ujung dalam satu segitiga, menyentuh satu vertex, tepat di edge bersama, celah dan surface bertumpuk. Sentuhan tunggal dapat menjadi satu marker, tanpa segmen rekaan.

### 4.3 Geometri lubang bor dan perpotongan bidang

Definisikan MD sebagai panjang sepanjang bor. Azimuth diukur searah jarum jam dari utara grid. Dip diukur dari horizontal, negatif ke bawah dan −90° vertikal ke bawah. Saat impor boleh memilih konvensi sumber “positif ke bawah”, lalu ubah tanda seluruh batch tepat sekali sebelum membangun lintasan. Tampilkan konvensi aktif. Gunakan radian dalam trigonometri.

```text
dE = MD · cos(dip) · sin(azimuth)
dN = MD · cos(dip) · cos(azimuth)
dZ = MD · sin(dip)
toe = collar + (dE,dN,dZ)
```

Proyeksikan collar dan toe secara terpisah. Gambar garis putus-putus di antara hasil proyeksi, simpan MD asli. Jika kedua proyeksi berimpit, tampilkan satu simbol dengan keterangan “proyeksi berimpit” dan detail kedua ujung. Penempatan titik/collar memakai Z asli meskipun Z surface pada chainage tersebut berbeda.

| Offset collar dan toe | Perilaku |
|---|---|
| Keduanya nol dalam toleransi | Seluruh lubang berada di bidang; bedakan bagian pada rentang A–B atau pada perpanjangan berdasarkan chainage. |
| Satu ujung nol | Tandai satu sentuhan pada collar (MD 0) atau toe (MD penuh). |
| Berlainan tanda | Fraksi sepanjang bor `t = oCollar / (oCollar − oToe)`. Hitung `mdHit = t·MD`, `sHit = sc + t(st−sc)`, `zHit = zc + t(zt−zc)`. Tandai apakah sHit berada dalam A–B atau pada perpanjangan. |
| Selain itu | Seluruh bor tetap diproyeksikan. Keterangan menyebut “tidak memotong bidang”. |

Filter opsional menggunakan setengah lebar koridor `w ≥ 0` di kedua sisi garis, independen dari panjang A–B. Titik lolos bila `abs(o) ≤ w`. Bor lurus lolos bila interval `[min(oc,ot),max(oc,ot)]` beririsan dengan `[−w,+w]`, termasuk kedua ujung yang sama-sama jauh tetapi lintasannya menyeberang. Default filter mati.

### 4.4 CSV, formulir dan integritas sesi

- Kolom kanonik tersedia pada fixture CSV. Sediakan pemetaan header nama Indonesia/Inggris agar urutan kolom bebas. Baca UTF-8/BOM dan nilai bertanda kutip. Izinkan pemisah koma atau titik koma. Tampilkan pemisah dan format angka pada pratinjau. Koma desimal hanya diterima bila tidak ambigu, misalnya titik koma sebagai pemisah kolom.
- Nama bertipe teks, dipangkas pada kedua ujung, harus terisi. Pertahankan angka nol awal. Angka lain harus finite. MD > 0, dip ∈ [−90°,90°], azimuth ∈ [0°,360°] dan 360° disimpan sebagai 0°. Tolak nilai di luar rentang dengan baris dan alasan. Arah azimuth tidak menggeser E/N pada lubang vertikal. Validasi formulir dan CSV memakai fungsi yang sama.
- Nama menjadi kunci duplikat dalam jenis objek yang sama setelah trim dan normalisasi huruf untuk pencocokan. Baris valid pertama dipakai, duplikat sesudahnya ditolak. Nama tampilan asli dipertahankan, ID internal mencakup jenis. Antara titik dan bor, nama yang sama diizinkan.
- Tampilkan ringkasan diterima/ditolak dan alasan sebelum menerapkan batch valid. Batal tidak mengubah state. Reimpor tidak menciptakan duplikat. Mengganti surface memerlukan konfirmasi grid/datum jika objek dipertahankan dan harus menghitung ulang profil. Impor gagal, dibatalkan, atau terlambat tidak boleh merusak sesi aktif.

## 5. Urutan pekerjaan M0–M8

Kerjakan dependensi yang siap dengan urutan tabel. Untuk setiap milestone fungsional, tulis tes untuk hasil yang diminta, jalankan untuk melihat kegagalan, implementasikan, lalu jalankan ulang tes terarah dan `npm run check`. Catat perintah, exit status dan hasil penting di `docs/STATUS.md`. Simpan perubahan per milestone di branch kerja. Jika CI menjadi tempat pengujian, commit dahulu untuk memicu cek dan catat kelulusan setelah log untuk SHA tersebut tersedia. Untuk M0, mulai dari scaffold sebelum tersedia test runner.

| ID | Dependensi | Hasil yang dapat diperiksa |
|---|---|---|
| M0 | Repo yang dipilih | Kerangka yang dapat dibangun di CI |
| M1 | M0 | Rumus proyeksi, toe, interseksi dan koridor lulus fixture |
| M2 | M0 | Kedua jenis DXF menghasilkan mesh yang setara |
| M3 | M0 serta sampel atau spesifikasi Surpac yang dapat diverifikasi | Pembaca DTM/STR, deteksi varian, dan pembandingan terhadap Surpac |
| M4 | M1, M2 | Penampang TIN 2D yang mempertahankan bench dan celah |
| M5 | M1, M2, M4 | Viewer 3D dengan garis A–B manual dan profil sinkron |
| M6 | M1, M5 | Input manual/CSV, objek 3D dan semua proyeksi 2D |
| M7 | M0 untuk menghubungkan hosting; M5–M6 untuk uji alur lengkap | CI, Deploy Preview, uji browser dan tolok ukur |
| M8 | M3, M6, M7 dan data kontrol site | Keputusan rilis berdasarkan bukti pembanding dan uji produksi |

### M0 · Repositori, build dan pemeriksaan otomatis

- [ ] Inspeksi branch, perubahan lokal, instruksi repo, package manager dan lockfile. Gunakan repo yang dipilih. Jika baru, siapkan Vite + React + TypeScript strict. Pin versi Node LTS yang kompatibel dengan Vite pilihan di `.nvmrc` dan CI. Kunci versi terpasang dalam lockfile.
- [ ] Buat halaman dengan tindakan **Buka surface**, **Tambah titik**, **Tambah bor**, dan **Buat penampang**. Tombol yang belum dapat digunakan menjelaskan prasyarat. Tambahkan tes smoke yang membuka halaman.
- [ ] Sediakan script `dev`, `typecheck`, `lint`, `test` (Vitest run, tanpa watch), `build`, `preview`, `test:e2e`, dan `check` (typecheck + lint + unit test + build). Tambahkan `netlify.toml` dari M7 dan CI untuk PR. Pisahkan fixture sintetis dari direktori privat yang diabaikan git.
- [ ] Jalankan `npm ci && npm run check`. Dari clean checkout, build menghasilkan `dist/index.html`. Catat versi runtime dan commit. Buat `docs/STATUS.md` sebagai kendali sesi.

### M1 · Geometri titik dan lubang bor

- [ ] Implementasikan kontrak `projectPoint`, `boreholeToe`, `intersectBorehole` dan filter koridor pada fungsi murni. Bedakan nilai tak terdefinisi dari nilai nol. Gunakan nama yang eksplisit untuk depth dan koordinat.
- [ ] Buat `tests/unit/geometry.test.ts` yang membaca nilai tetap dari `expected.json`. Tambahkan orientasi utara, timur dan oblique, pembalikan garis, A=B, bor vertikal, bor mendatar yang proyeksinya satu titik, sentuhan tepat di toe, dan koridor ±0 m. Salah satu uji oblique: A=(0,0), B=(3,4), P=(−4,3,10) harus memberi s=0, o=+5.
- [ ] Jalankan `npm test -- tests/unit/geometry.test.ts`. Kasus BH-01 harus memberi s=50, offset +12/−8, MD potong=24, Z potong=113,2153903. Simpan hasil numerik sebelum melanjutkan.

### M2 · Parser DXF dan pemeriksaan mesh

- [ ] Implementasikan pemeriksaan ukuran berbasis `File.size` sebelum `arrayBuffer()/text()`. Isi uji untuk 24.999.999, 25.000.000 dan 25.000.001 byte. Spy pembaca isi harus membuktikan file terlalu besar ditolak tanpa pembacaan.
- [ ] Coba parser DXF yang kompatibel dengan browser pada dua file acuan. Periksa apakah VERTEX face records dan flag indeks dipertahankan. Bila suatu library membuang konektivitas, baca entitas ASCII yang dibutuhkan secara eksplisit. Pisahkan layer; tampilkan pilihan bila ada beberapa kandidat. Ukur file dari byte aktual.
- [ ] **3DFACE** memakai vertex dunia dan muka tiga titik (sudut keempat sama dengan ketiga pada ekspor standar). **POLYFACE** memakai POLYLINE dengan bit 64 dan record VERTEX hingga SEQEND. Gunakan nilai absolut referensi indeks satu-basis; tanda negatif adalah flag sisi tersembunyi. Resolusikan daftar face setelah pengumpulan vertex. Muka empat vertex berbeda di luar cakupan versi awal harus dilaporkan.
- [ ] Cegah indeks di luar rentang, vertex non-finite dan segitiga rusak masuk hitungan. Cacat struktural fatal membatalkan impor. Bila hanya sebagian muka rusak, tampilkan ringkasan dan minta pengguna memilih melanjutkan dengan muka valid. Beri pesan spesifik untuk DXF biner, kontur saja, layer kosong, atau file salah label. Jangan membentuk TIN baru dari garis kontur.
- [ ] Jalankan `npm test -- tests/unit/dxf.test.ts`. Untuk dua file bench acuan hasilnya harus setara: 10 segitiga, 12 koordinat vertex unik secara geometris, bounds dari bagian 6 dan indeks valid. Bandingkan segitiga setelah mengabaikan urutan vertex/face. File celah menghasilkan 8 segitiga.

### M3 · Pasangan Surpac DTM/STR

- [ ] Buat pintu impor dua file yang dipilih sekaligus, bebas urutan. Cocokkan referensi STR pada DTM jika varian menyediakannya. Jika referensi tidak tersedia, cocokkan nama dasar dan minta konfirmasi pada kasus ambigu. Tangani perbedaan kapitalisasi dan periksa ukuran tiap anggota secara terpisah.
- [ ] Identifikasi varian dari struktur isi dan dokumentasi/ekspor yang diketahui. Catat versi Surpac, mode ekspor, susunan field E/N/Z, penomoran vertex, pemisah string, pengelompokan objek/trisolation dan struktur referensi segitiga. Jangan menafsirkan record kontrol sebagai vertex atau menggunakan posisi baris sebagai ID tanpa bukti. Jika ada beberapa objek, pengguna memilih objek permukaan.
- [ ] Implementasikan adapter varian yang terverifikasi ke mesh yang sama dengan DXF. Uji STR hilang, nama referensi salah, indeks putus, record kontrol, E/N tertukar dan varian biner yang belum didukung. Pesan pemulihan harus spesifik, misalnya “Pilih STR pasangan” atau “Ekspor kembali sebagai DXF muka segitiga dari Surpac”.
- [ ] Untuk pasangan asli atau ekspor uji dari Surpac, bandingkan jumlah segitiga, batas E/N/Z, tiga kontrol dan satu penampang di M8. Simpan metadata format dan selisih di `docs/acceptance.md` sesuai izin data. Jalankan `npm test -- tests/unit/surpac.test.ts`. Jika contoh terverifikasi belum tersedia, pisahkan tes deteksi/error yang lulus dari jalur impor yang masih belum terbukti. Tandai `SURPAC_SITE_PENDING` dan lanjut M4–M7. DXF fallback tidak menutup M3.

### M4 · Mesin penampang dan worker

- [ ] Tulis `tests/unit/profile.test.ts` untuk profil bench dan gap dari bagian 6. Tambahkan segitiga tunggal pada bidang Z=100+E+2N dengan vertex lokal (0,0,100), (10,0,110), (0,10,120). A=(1,1) dan B=(2,1) harus memberi satu interval sepanjang 1 m, Z=103 dan Z=104.
- [ ] Terapkan indeks spasial 2D, clipping dan interpolasi dari bagian 4.2. Kembalikan bagian profil yang terpisah dan interval ambigu. Tambahkan uji tepat di edge bersama, di luar mesh, hanya menyentuh vertex, dan segitiga overlap dengan elevasi berbeda. Pastikan pergantian orientasi A/B membalik urutan profil.
- [ ] Pasang worker dengan versi mesh dan request. Gabungkan event saat A/B digeser agar antrean tetap pendek; gerakan terakhir wajib menghasilkan profil terbaru. Uji dua permintaan saat balasan lama tiba belakangan serta impor baru yang gagal ketika model lama aktif.
- [ ] Jalankan `npm test -- tests/unit/profile.test.ts tests/unit/worker.test.ts`. Untuk fixture gap, hasil hanya mencakup dua interval [0,40] dan [55,100] m. Simpan angka profil dan jumlah bagian sebagai bukti.

### M5 · Viewer 3D dan interaksi garis manual

- [ ] Tampilkan mesh dengan orbit, pan, zoom, fit-to-surface, panah utara dan tampak atas. Bedakan mode navigasi dan menggambar. Ringkas nama surface/layer, jumlah segitiga, range E/N/Z, status unit dan jumlah masalah impor.
- [ ] Hubungkan kamera atas dan picking ke world coordinates. Implementasikan klik A lalu B dan drag A→B tanpa menghitung klik ganda dari drag. Pegangan hanya aktif di mode edit. Escape membatalkan perubahan sementara. A/B dapat ditempatkan di luar mesh.
- [ ] Tampilkan profil SVG dengan sumbu, unit, identitas A–B, arah dan indikator skala vertikal. Profil dengan gap menjadi beberapa SVG path. Saat A–B di luar surface, tampilkan pesan “Tidak ada perpotongan topografi”, sambil tetap memungkinkan proyeksi objek dari M6.
- [ ] Jalankan `npm run test:e2e -- tests/e2e/section.spec.ts` pada browser dengan WebGL yang berfungsi. Uji impor fixture, top view, gambar, geser B, balik arah dan batalkan. Gunakan nilai A/B aktual dari UI saat menguji drag dan bandingkan angka; sediakan pengisian E/N A/B sebagai cara presisi untuk mereproduksi penampang Surpac. Jika WebGL tidak tersedia beri pesan jelas, lalu pisahkan status pengujian geometri dari pengujian render 3D.

### M6 · Titik, bor, label dan tabel sinkron

- [ ] Bangun formulir dan impor CSV dengan pratinjau, mapping, pilihan dip, serta hasil validasi per baris. Uji nama sama antarjenis, nama duplikat dalam satu jenis, Z=0, NaN, depth negatif, koma desimal Indonesia, nilai berpetik, serta reimpor satu file yang sama.
- [ ] Render titik dan lintasan bor pada E/N/Z asli, serta panel 2D dengan kedua offset, titik perpotongan yang sah, nama, chainage dan MD. Tabel minimal memuat jenis/ID/nama, s collar atau titik, Z, offset, dan untuk bor s/Z/offset toe serta MD dan status potong. Seleksi tabel menyorot garis atau simbol dan membuka label lengkap. Tampilkan objek yang saling menimpa sebagai baris berbeda.
- [ ] Implementasikan seluruh objek aktif secara default, arsir perpanjangan, filter koridor dan penghitung ditampilkan/valid/ditolak. Saat A/B berubah, semua proyeksi dan isi tabel diperbarui bersama. Tombol fit semua menampilkan objek luar rentang.
- [ ] Jalankan `npm test -- tests/unit/objects.test.ts` dan `npm run test:e2e -- tests/e2e/objects.spec.ts`. Uji kedua CSV, satu titik manual, dan satu bor manual. Sebelum penambahan manual, harus terlihat 9 objek valid; koridor ±5 m menghasilkan tepat 6 dengan ID di bagian 6.

### M7 · Kinerja, CI, dan Deploy Preview GitHub → Netlify

- [ ] Simpan pengaturan minimal ini dalam `netlify.toml` di root repo. Jika repo monorepo, sesuaikan base directory ke aplikasi. Branch produksi dipilih di dashboard. Aplikasi ini cukup satu rute utama.
```toml
[build]
  command = "npm run build"
  publish = "dist"
```
- [ ] Di GitHub Actions, jalankan clean checkout, versi Node yang dipin, `npm ci`, `npm run check`, `npx playwright install --with-deps chromium`, lalu `npm run test:e2e`. Konfigurasikan Playwright `webServer` terhadap build/preview lokal beserta baseURL. Jangan mengganti semua tes viewer dengan mock. Tangkap screenshot/trace yang gagal hanya untuk data sintetis.
- [ ] Pemilik membuka Netlify → **Add new project → Import an existing project → GitHub**, memilih repo, branch produksi `main` (atau branch produksi repo), build/publish sesuai file di atas. Pastikan deploy preview untuk PR aktif. Agen yang memiliki akses GitHub atau pemilik repo membuat PR dari branch kerja ke branch produksi dan menyalin URL aktual dari hasil cek Netlify. Jangan menebak domain.
- [ ] Jalankan benchmark desktop pada laptop kerja: 1 file kecil, 1 menengah, dan dataset valid yang mendekati/tepat 25 MB. Gunakan mesh yang sungguh memiliki banyak segitiga, bukan padding untuk tes performa. Ukuran tepat/lebih 1 byte dapat diuji terpisah untuk batas baca. Untuk kombinasi Surpac, uji pasangan dengan **masing-masing** file mendekati batas bila tersedia.
- [ ] Ukur dari pemilihan file (atau konfirmasi terakhir bila perlu memilih layer) sampai frame pertama yang dapat diinteraksikan; untuk profil ukur dari pelepasan handle sampai grafik terakhir muncul. Pisahkan waktu dialog pengguna. Untuk tiap dataset, catat ukuran, segitiga, browser, CPU/RAM/GPU, tiga pengulangan, median, maksimum, dan memori puncak bila tersedia. Target awal median ≤15 detik impor dan ≤1 detik pembaruan profil; laporkan maksimum dan potensi macet untuk ditinjau. Jika gagal, profilkan decoding/indexing/rendering sebelum mengubah akurasi.
- [ ] Pada preview terbit, lakukan smoke test memakai file lokal. Periksa koneksi jaringan saat impor: tidak ada isi file, nama objek atau koordinat dikirim keluar. Pastikan worker dan asset 3D termuat, impor gagal bisa dipulihkan, serta tidak ada error console yang menghentikan alur. Simpan bukti dan URL preview di status.

### M8 · Verifikasi site dan rilis produksi

- [ ] Engineer membuka satu surface yang sama di Surpac dan preview, memilih objek dan datum yang sama, lalu memasukkan A/B yang identik. Rekam versi ekspor, jumlah segitiga, batas E/N/Z, tiga titik kontrol, dan elevasi profil pada crest, toe, dan ujung segmen yang berada di dalam mesh. Bandingkan DXF dengan DTM/STR serta dengan Surpac, bukan hanya DXF melawan DTM.
- [ ] Engineer dan survey menetapkan toleransi lapangan berdasar presisi ekspor **sebelum** melihat selisih hasil. Catat nilai referensi, nilai aplikasi, selisih bertanda/absolut dan hasil tiap kontrol. Selisih sintetis di bagian 6 wajib ≤0,01 m; toleransi tersebut tidak menggantikan toleransi proyek.
- [ ] Verifikasi hitungan bor dengan satu titik dan satu lubang yang dikenal, termasuk konvensi dip, utara grid, MD serta offset kiri/kanan. Cocokkan jumlah objek saat filter mati, posisi objek sebelum A/sesudah B dan kasus bor yang berpotongan di luar rentang.
- [ ] Setelah seluruh syarat rilis penuh terpenuhi, pemilik merge PR ke branch produksi. Netlify membangun ulang. Ulangi smoke test di **URL produksi aktual** pada commit yang sama, termasuk memilih pasangan asli secara lokal dan menggambar ulang A–B. Bila rilis gagal, pulihkan deploy stabil sebelumnya atau revert commit melalui PR. Catat versi yang benar-benar aktif.
- [ ] Serahkan URL, SHA yang diuji, varian format yang lulus, tes otomatis beserta hasil, perangkat/timing, perbedaan terhadap Surpac dan pekerjaan terbuka. Jika M3 atau data site masih pending, hasil yang boleh diklaim adalah **preview fungsional DXF** dengan status Surpac tertulis.

## 6. Paket uji yang dapat dijalankan dari hari pertama

Semua koordinat berikut sintetis. Gunakan toleransi absolut 0,01 m pada panjang/elevasi serta kesamaan tepat untuk jumlah, ID, dan status. Simpan angka penuh saat komputasi. Bulatkan dua desimal hanya pada tampilan.

| File di `tests/fixtures/synthetic/` | Fungsi |
|---|---|
| `bench_3dface.dxf` | Surface bench dalam DXF ASCII 3DFACE, layer TOPO, 10 segitiga. |
| `bench_polyface.dxf` | Surface identik berbentuk POLYFACE, termasuk satu indeks bertanda negatif. |
| `gap_3dface.dxf` | Surface dengan strip kosong antara s=40 dan s=55, 8 segitiga. |
| `points.csv`, `boreholes.csv` | Lima titik dan empat bor untuk pengujian tampilan dan tabel. |
| `points_invalid.csv` | Header pada baris 1. Baris 2 valid. Baris 3 kehilangan Northing, baris 4 duplikat ID baris 2 dan baris 5 memuat NaN. |
| `expected.json` | Hasil referensi tetap. Status BH-04 “extension-cross” pada berkas bermakna kind=cross dan onAB=false di API. |

**Definisi surface.** Origin horizontal sintetis E0=700000, N0=9100000. A=(E0,N0), B=(E0+100,N0). Pada tiap kolom berikut terdapat dua vertex pada N0−20 dan N0+20, dengan elevasi identik. Hubungkan tiap dua kolom menjadi dua segitiga dengan diagonal dari sudut barat daya ke timur laut. File gap menghilangkan dua muka antara kolom 40 dan 55. Profil dapat memiliki vertex tambahan pada diagonal internal; bandingkan nilai pada chainage acuan dan ketelitian seluruh segmen, tanpa memaksa jumlah vertex profil identik.

| Chainage/E relatif (m) | 0 | 20 | 40 | 55 | 75 | 100 |
|---|---:|---:|---:|---:|---:|---:|
| Z surface (m) | 120 | 120 | 130 | 130 | 140 | 140 |

**Titik.** Pada contoh A→B ke timur, chainage sama dengan E−E0 dan offset sama dengan N−N0. Lima titik dalam CSV harus menghasilkan tabel ini. P-01 dan P-05 memiliki simbol 2D bertumpuk, tetapi masing-masing tetap dapat dipilih.

| Nama | s (m) | Offset (m) | Z asli (m) |
|---|---:|---:|---:|
| P-01 | 30 | −10 | 128 |
| P-02 | −10 | +4 | 123 |
| P-03 | 110 | −2 | 136 |
| P-04 | 60 | 0 | 132 |
| P-05 | 30 | +15 | 128 |

**Bor.** Semua nilai s/o/Z di tabel berurutan sebagai chainage / offset / elevasi. Untuk merekonstruksi CSV, E collar=E0+s, N collar=N0+o.

| Bor | Collar s/o/Z (m) | MD, azimuth, dip | Toe s/o/Z (m) | Hasil pada bidang |
|---|---|---|---|---|
| BH-01 | 50 / +12 / 134 | 40 m, 180°, −60° | 50 / −8 / 99,35898 | Memotong dalam A–B, MD 24, s 50, Z 113,21539. Proyeksi bor vertikal. |
| BH-02 | 80 / 0 / 139 | 18 m, 0°, −90° | 80 / 0 / 121 | Seluruh bor pada bidang. |
| BH-03 | 20 / +6 / 130 | 20 m, 90°, −30° | 37,32051 / +6 / 120 | Sejajar bidang, seluruhnya pada offset +6 m. |
| BH-04 | 110 / −4 / 139 | 8 m, 0°, 0° | 110 / +4 / 139 | Memotong pada perpanjangan, MD 4, s 110, Z 139. Proyeksi kedua ujung berimpit. |

**Pemeriksaan kombinasi.** Filter mati = 9 objek. Koridor ±5 m = 6 objek, yaitu P-02, P-03, P-04, BH-01, BH-02, BH-04. Balik A/B: P-01 menjadi s=70 m, o=+10 m; P-03 menjadi s=−10 m, o=+2 m. Untuk BH-01, MD dan Z potong tetap sama, offset collar berubah menjadi −12 m dan toe menjadi +8 m.

## 7. Daftar keputusan untuk hasil yang berisiko keliru

| Gejala atau kondisi | Respons perangkat lunak | Bukti |
|---|---|---|
| E/N tertukar, unit salah, datum tidak cocok | Tampilkan metadata, range dan titik kontrol; minta pemilihan/konfirmasi agar angka yang dimaksud dipakai. | Kontrol M2/M3/M8 dan uji round-trip picking M5. |
| Terlihat profil di lubang mesh atau dua lapisan bertumpuk | Pisahkan rentang yang valid; interval ambigu ditandai dan bisa ditelusuri ke layer. | Fixture gap dan tes overlap M4. |
| Titik tampak di permukaan walau elevasi aslinya berbeda | Gunakan Z sumber dan tampilkan nilai numeriknya pada tabel/tooltip. | P-01 dan P-05 pada s=30 memiliki Z=128 sementara Z surface=125. |
| Bor mendatar/tegak/menyeberang hilang saat diproyeksikan atau difilter | Pertahankan dua ujung 3D, tampilkan marker bila proyeksi berimpit, dan gunakan interval offset lintasan. | BH-01 sampai BH-04 pada M1 dan M6. |
| Hasil setelah drag berasal dari garis sebelumnya | Gunakan requestId/surfaceVersion dan hanya pasang hasil terakhir. | Tes urutan respons terbalik pada M4 dan uji drag cepat di M5/M7. |

## 8. Pencatatan, kelanjutan sesi dan definisi selesai

Gunakan format berikut pada `docs/STATUS.md` untuk melanjutkan pekerjaan di sesi baru atau berpindah antara Claude Code, Codex, dan DeepSeek. Sebelum berpindah, simpan perubahan pada branch yang bisa diakses pelaksana berikutnya. Jika ada usulan chat yang belum diterapkan, tandai terpisah agar pelaksana berikutnya dapat memeriksa isinya.

```markdown
# Status implementasi
Pelaksana / mode (agen repo atau chat):
Branch / SHA perubahan terakhir:
SHA yang benar-benar diuji / tautan cek jika tersedia:
Perubahan yang diusulkan namun belum diterapkan:
Milestone selesai:
Milestone aktif dan checkbox berikutnya:
Perintah yang dijalankan, hasil/exit code:
Fixture dan angka yang diperiksa:
Status Surpac site: PENDING / PASS / FAIL
Status QA laptop target: PENDING / PASS / FAIL
Status Netlify: belum terhubung / preview / produksi terverifikasi
URL aktual dan commit deploy bila tersedia:
Hambatan, pemilik tindakan, bagian lain yang dapat dilanjutkan:
```

**Prompt untuk sesi lanjutan**

```text
Lanjutkan implementasi dari IMPLEMENTATION_PLAN.md dan docs/STATUS.md di branch kerja terakhir. Periksa SHA kode dan SHA cek yang lulus. Jika hanya menerima berkas lewat chat, minta status, SHA, file terkait dan log CI terbaru. Cocokkan perubahan yang masih berupa usulan dengan isi branch sebelum menulis ulang. Lanjutkan checkbox pertama yang siap. Pertahankan status PENDING eksternal dan catat milestone independen yang dapat dikerjakan. Akhiri dengan status terbarui, bukti verifikasi, dan langkah berikutnya.
```

**Definisi selesai untuk versi produksi penuh**

- [ ] DXF 3DFACE, DXF POLYFACE dan DTM/STR varian Surpac site terbukti melalui jalur input normal; ukuran diuji per file.
- [ ] Pengguna memplot titik dan bor melalui formulir dan CSV, menarik A–B, menggeser atau membaliknya, serta membaca semua proyeksi pada grafik dan tabel.
- [ ] Geometri sintetis lulus toleransi, gap dan perpanjangan terwakili, dan perbandingan Surpac sesuai toleransi lapangan yang disetujui.
- [ ] CI lulus dari checkout bersih; pengujian browser, laptop target, hasil preview dan smoke test produksi dicatat dengan bukti. Angka kinerja yang belum diukur tetap dicatat sebagai target.
- [ ] Data mentah pengguna tetap di browser. Tautan aplikasi berasal dari deploy Netlify yang berhasil dan SHA-nya terdokumentasi.

## Referensi implementasi

- [OpenAI · Codex cloud dan repositori](https://developers.openai.com/codex/cloud/)
- [DeepSeek · pilihan integrasi coding agent](https://api-docs.deepseek.com/)
- [Claude Code di browser dan akses repo GitHub](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Netlify · integrasi Vite](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/)
- [Netlify · Deploy Previews untuk pull request](https://docs.netlify.com/deploy/deploy-types/deploy-previews/)
- [Autodesk · DXF 3DFACE](https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-747865D5-51F0-45F2-BEFE-9572DBC5B151.htm)
- [Autodesk · DXF Polyface Meshes](https://help.autodesk.com/cloudhelp/2016/ENU/AutoCAD-DXF/files/GUID-96B6288E-F413-46C0-968A-A314171C0AAE.htm)
- [Seequent Community · pasangan Surpac DTM/STR dan batasan varian biner](https://community.seequent.com/discussion/2150/importing-datamine-dm-and-surpac-dtm-files-into-leapfrog-geo)
