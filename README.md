# co-jsu-desktop

Portal Kurikulum Politeknik — Course Outline (Lampiran 4 / PLSP-04),
Jadual Spesifikasi Ujian Pentaksiran Berterusan (JSU PB) dan Laporan CQI
(PBCLOGSA & CORR panitia).

Tauri 2 desktop app (React + TypeScript) dengan backend FastAPI + SQLite
yang dibungkus sebagai sidecar.

**Versi semasa: 1.0.0** — lihat [CHANGELOG.md](./CHANGELOG.md) untuk sejarah perubahan.

## Versi & keluaran

Versi diambil daripada `package.json` dan disuntik ke UI semasa build (`__APP_VERSION__`),
jadi nombor pada kepala/pengaki tetingkap sentiasa sama dengan keluaran yang dipasang.
Naikkan versi di **empat** tempat sebelum membuat keluaran baharu:

1. `package.json` (+ `package-lock.json`)
2. `src-tauri/tauri.conf.json`
3. `src-tauri/Cargo.toml`
4. `backend_api.py` (`FastAPI(..., version=...)`)

Kemudian bina pemasang, tag dan terbitkan:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\package-portable.ps1
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

Kemudian muat naik `.exe`/`.msi` daripada `src-tauri\target\release\bundle\` ke
GitHub Release bagi tag tersebut.

Keluaran terkini: <https://github.com/wilsonintai76/cms-jkm-pkd/releases>

## Run in development

Rust builds on Windows need the MSVC linker (`link.exe`) and the Windows SDK
(`kernel32.lib`, `INCLUDE`, `LIB`). These only exist inside a Visual Studio
Developer environment, so start the app with the helper script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Prerequisite: Visual Studio Build Tools 2022 with the *Desktop development with C++*
workload and a Windows 10/11 SDK. Running `npm run tauri dev` from a plain terminal
fails with `linker "link.exe" not found` / `LNK1181: cannot open input file 'kernel32.lib'`.

The dev script also builds the backend sidecar on first run (see below). The app
starts it automatically, so you no longer need a second terminal for
`python backend_api.py`. If you *do* start the backend manually first, the sidecar
cannot bind port 8765 and exits; the app just talks to your manual instance.

## Build a Windows installer

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

This packages `backend_api.py` into a single exe with PyInstaller, registers it as a
Tauri sidecar, then builds the app. Output:

- `src-tauri\target\release\bundle\nsis\co-jsu-desktop_<version>_x64-setup.exe`
- `src-tauri\target\release\bundle\msi\co-jsu-desktop_<version>_x64_en-US.msi`

Re-running the script skips PyInstaller unless `backend_api.py` changed; pass
`-ForceBackend` to force it or `-SkipBackend` to reuse the existing sidecar.

The installed app starts the API sidecar itself and stops it on exit. Bundled
runs keep `co_jsu_records.db` and the uploaded logo in
`%LOCALAPPDATA%\co-jsu-desktop\` (a packaged exe unpacks to a temp folder that is
deleted on exit, so nothing writable can live next to it). Running `backend_api.py`
directly still uses the project's `data/` and `logo/` folders.

## Portable copy (no install)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-portable.ps1
```

Creates `release\co-jsu-desktop-portable\` containing `co-jsu-desktop.exe`,
`backend_api.exe`, a `Mula co-jsu-desktop.bat` launcher and a short readme.

Copy the folder anywhere (USB drive included) and double-click the `.bat`. There is
no installer, no registry entry and no admin prompt; the app starts the backend
sidecar itself. Data still goes to `%LOCALAPPDATA%\co-jsu-desktop\`, so it survives
moving or deleting the folder. Requirement: Windows 10/11 x64 with the WebView2
runtime (preinstalled on Windows 11 and updated Windows 10).

## Laporan CQI (PBCLOGSA + CORR panitia)

Menu **5. Laporan CQI** menghasilkan *Borang Pelaporan Penambahbaikan Kualiti
Berterusan (CQI)* rasmi PKS daripada dua dokumen sumber:

| Fail | Kandungan yang dibaca |
| --- | --- |
| PBCLOGSA (`.pdf`, satu atau lebih) | satu baris per pelajar: metric no., nama, kelas, CLO1–CLO4, PLO, CA, FE, CA‑FE, CA+FE, gred |
| CORR panitia (`.pdf`) | maklumat kursus, 5 petunjuk prestasi + sasaran, taburan gred, pencapaian CLO/PLO + deskriptor, refleksi |

Pengekstrakan berjalan di backend (`POST /api/cqi/extract`) dan membaca nilai
mengikut **kedudukan lajur** (PyMuPDF word coordinates), bukan susunan teks. Ini
penting kerana laporan PBCLOGSA menyambung satu seksyen ke muka surat berikutnya
dan nama pelajar boleh melimpah ke baris kedua.

Program diambil daripada nombor metric (`05DKM25F2001` → `DKM`), jadi pelajar
program lain yang menumpang kelas yang sama diasingkan ke laporan CQI program
masing-masing. Sesi semasa dibaca daripada dokumen; sesi terdahulu dan sesi
hadapan dikira automatik (boleh ditukar).

Aliran kerja: **1** muat naik → **2** semak Template CORR setiap program
(termasuk semakan silang angka CORR vs PBCLOGSA) → **3** isi Borang CQI
(2 muka surat, pilihan muka surat 3 = lampiran markah) → **Cetak / PDF**.

**Maklumat Kepala Laporan** (kod kursus, nama kursus, jabatan, nama penyelaras dan
tanda CLO4) diisi automatik daripada kursus Course Outline/JSU yang sedang dibuka,
jadi laporan CQI menyambung data kursus yang sama. Nilai yang sudah diisi tidak
ditimpa semasa anda menyunting kursus; butang **Dari Kursus** mengisi semula semua
medan itu bila perlu. Nama pemegang tempat seperti "PENSYARAH" diabaikan.

**Sesi akademik** (sesi semasa, terdahulu dan hadapan) ditetapkan sekali di menu
**6. Tetapan & Logo** → *Sesi Akademik Semasa* (format `II : 2025/2026`). Laporan CQI
menggunakannya secara automatik; sesi yang dibaca daripada dokumen CORR/PBCLOGSA
masih diutamakan untuk laporan tersebut.

**Identiti dokumen** (institusi dan jabatan) juga ditetapkan sekali di menu
**6. Tetapan & Logo** → *2. Identiti Dokumen*. Semua rekod kursus menggunakan nilai
yang sama, jadi medan ini tidak lagi ditaip dalam setiap kursus: Course Outline,
JSU dan kepala Laporan CQI mengikut tetapan itu, dan menukarnya di Tetapan terus
mengemas kini kursus yang sedang dibuka serta jabatan pada kepala Laporan CQI.
Untuk rekod lama yang belum ada tetapan, medan ini diisi daripada kursus yang
dibuka — klik **Simpan Tetapan** untuk mengekalkannya.

Butiran borang:
- Bahagian A: lajur sesi terdahulu boleh ditaip, lajur sesi semasa dikira
  automatik, lajur analisis (naik/turun) dikira daripada kedua-duanya.
  **Isi dari CORR** mengisi lajur terdahulu daripada CORR yang dimuat naik.
- Bahagian B/C/D/E: teks boleh ditaip terus pada borang (medan bergaris titik).
  **Isi Cadangan Pintar** menjana punca/cadangan/cadangan CA‑FE daripada markah.
- Semua teks dicetak melalui CSS `@page` sifar margin, jadi tiada kepala/halaman
  pelayar dan setiap muka surat A4 dipisahkan secara automatik.

Rekod disimpan dalam jadual `cqi_reports` (satu rekod per kod kursus) dan boleh
dibuka semula dari senarai **Rekod CQI Tersimpan**. Endpoint:
`GET/POST /api/cqi`, `GET/DELETE /api/cqi/{kod}`, `POST /api/cqi/extract`.

## Maklumat Kursus (menu 2)

Menu **2. Maklumat Kursus (13 Item)** ialah tempat tunggal untuk identiti kursus, dan
nilainya mengalir ke Course Outline, JSU dan Laporan CQI:

| Bahagian | Medan |
| --- | --- |
| Kod Dokumen | kod dokumen rasmi (PLSP-04 …) — institusi & jabatan diambil daripada Tetapan |
| Item 1–5 | nama, kod, semester/tahun ditawarkan, kredit, pra-syarat, pemberat CA/FE, sinopsis |
| Item 6–7 | CLO (kod, pernyataan, taksonomi, PLO) |
| Item 9 & 11 | keperluan khas, maklumat tambahan |
| Item 10 | rujukan utama dan tambahan (satu baris satu rujukan) |
| Item 13 | kaedah penilaian (nama, bilangan, peratus) |
| Pengesahan | penyelaras kursus, tarikh sedia, pengesah, tarikh sah |

Jabatan dan nama penyelaras inilah yang mengisi **Maklumat Kepala Laporan** CQI, jadi
kedua-duanya tidak perlu ditaip semula dalam modul CQI.

## Semak SLT (Course Outline → tab 3)

Tab **3. Semak SLT** memaparkan semula jadual SLT rasmi daripada data kursus supaya
boleh dibanding terus dengan silibus:

| Jadual | Kandungan |
| --- | --- |
| Taburan SLT mengikut topik | julat minggu, jam kuliah (L) dan kendiri (IL) setiap topik + jumlah |
| Penilaian | setiap CA (peratus, masa penilaian, pembelajaran kendiri, SLT), penilaian akhir dan grand total |
| Jam kontak | jumlah L + masa penilaian CA, dibahagi minggu pengajian (boleh diubah, lalai 14) |

Empat semakan dipaparkan hijau/amber: jumlah SLT = kredit × 40, SLT topik + CA + FE
= jumlah SLT, peratus CA + FE = 100%, dan setiap topik mempunyai jam kuliah. Jam
kendiri yang tidak sama dengan jam kuliah ditanda amber kerana silibus biasanya
menetapkan kedua-duanya sama. Nilai SLT disunting di tab 1.

### Minggu automatik

Lajur **Minggu** dalam Item 12 (Jadual Mingguan) dikira automatik daripada taburan
SLT, iaitu `jam kuliah terkumpul ÷ jam kontak seminggu` (jumlah SLT kontak ÷ minggu
pengajian). Contoh untuk 3 jam/minggu: 4.5 jam → `M1-M2`, 3 jam → `M3`, 6 jam →
`M6-M7`. Julat ini dikemas kini serta-merta apabila jam SLT atau minggu pengajian
berubah, dan digunakan dalam pratonton/cetakan Lampiran 4. Tanda **Minggu auto**
pada Item 12 boleh dimatikan untuk menaip julat minggu sendiri (`week_auto`).

## Bundle layout

| Path | Purpose |
| --- | --- |
| `backend_api.py` | FastAPI + SQLite backend (also used directly in development) |
| `src/` | React UI |
| `src/lib/calc.ts` | SLT totals, JSU computation, `computeSltReview` |
| `src-tauri/src/lib.rs` | Starts/stops the backend sidecar with the window |
| `src-tauri/binaries/` | PyInstaller output (generated, git-ignored) |
| `scripts/dev.ps1` | Dev run with the MSVC environment loaded |
| `scripts/build.ps1` | Sidecar + installer build |
| `scripts/package-portable.ps1` | Portable no-install folder |

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
