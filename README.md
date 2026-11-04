# surface — Topografi 3D dan penampang geoteknik 2D

Aplikasi statis (React + TypeScript + Vite) untuk membuka surface DXF (3DFACE/POLYFACE) di browser,
menambahkan titik dan lubang bor, menarik garis A–B, lalu membaca penampang 2D beserta offset seluruh objek.
Semua pemrosesan berlangsung lokal di browser; isi file tidak dikirim ke server.

- Rencana: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)
- Status dan kelanjutan sesi: [`docs/STATUS.md`](docs/STATUS.md)
- Data uji sintetis: [`tests/fixtures/synthetic/`](tests/fixtures/synthetic/)

## Menjalankan

Node sesuai `.nvmrc` (22.23.4).

```bash
npm ci
npm run dev          # server pengembangan
npm run check        # typecheck + lint + unit test + build
npm run test:e2e     # Playwright (chromium), membangun dan menjalankan preview lokal
npm run gen:bench    # membangkitkan DXF 0,5 / 5 / ~25 MB di tests/fixtures/large/ (diabaikan git)
npm run bench        # tolok ukur impor dan profil, 3 pengulangan (sintaks env POSIX; di Windows pakai WSL/Git Bash)
```

Uji terhadap Deploy Preview: `E2E_BASE_URL=https://<url-preview> npx playwright test`.

Uji penerimaan site (Surpac DTM/STR, titik kontrol): [`docs/acceptance.md`](docs/acceptance.md).

Data site asli (DTM/STR/DXF) jangan di-commit; simpan di `private/` yang diabaikan git.
