# Changelog

Semua perubahan penting bagi projek ini direkod di sini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/ms/1.1.0/) dan projek ini
mengikut [Semantic Versioning](https://semver.org/lang/ms/): `MAJOR.MINOR.PATCH`
(MAJOR = perubahan besar/breaking, MINOR = ciri baharu, PATCH = pembetulan pepijat).

## [1.0.0] - 2026-11-27

Keluaran rasmi pertama.

### Ditambah

- Import silibus **Course Information** (`.pdf`) melalui backend FastAPI + PyMuPDF yang
  mengekstrak kesemua 13 item silibus, membina Course Outline (Lampiran 4) dan JSU PB,
  serta menyimpan rekod ke SQLite. Fail `.json` juga diterima.
- **Course Outline (Lampiran 4 / PLSP-04)**: suntingan jadual mingguan, matriks SLT, pratonton
  rasmi 3 halaman, eksport Word (`.doc`) dan cetakan PDF A4 potret.
- **Jadual Spesifikasi Ujian (JSU PB)**: baris CLO/domain, markah topik, ringkasan pemberat
  dan cetakan rasmi.
- **Laporan CQI (PBCLOGSA & CORR panitia)**: pengekstrakan mengikut koordinat lajur daripada
  satu atau lebih laporan PBCLOGSA serta laporan CORR, analisis per program, borang CQI
  2 halaman (pilihan lampiran markah) dan simpanan dalam jadual `cqi_reports`.
- **Semak SLT** (Course Outline → tab 3): taburan SLT mengikut topik, penilaian CA/FE dan
  jumlah keseluruhan dalam bentuk jadual rasmi, bersama empat semakan automatik.
- **Minggu automatik**: julat minggu setiap topik dikira daripada jam kuliah ÷ jam kontak
  seminggu (`M1-M2`, `M3`, ...), dikemas kini serta-merta apabila SLT atau minggu pengajian
  berubah. Tanda "Minggu auto" boleh dimatikan untuk taip manual.
- Pakej **portable** (tanpa pemasangan) melalui `scripts/package-portable.ps1`.
- Versi aplikasi dipaparkan pada kepala dan pengaki tetingkap, disuntik daripada
  `package.json` semasa build.

### Nota teknikal

- Backend FastAPI dibungkus sebagai sidecar Tauri (PyInstaller `--onefile`) dan dihidupkan/
  dimatikan bersama tetingkap aplikasi.
- Data pengguna: `%LOCALAPPDATA%\co-jsu-desktop\co_jsu_records.db` (aplikasi terpasang) atau
  folder `data\` apabila `backend_api.py` dijalankan terus.
