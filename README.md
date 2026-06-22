# AMOR — Website Pemantauan Pirolisis

**AMOR** (Automated Monitoring & Oil-conversion Reporting) adalah website company profile sekaligus
dashboard pemantauan untuk mesin pirolisis yang mengolah sampah plastik menjadi minyak. Dibuat untuk
Program Pengabdian Masyarakat Tahun ke-3.

Website ini menampilkan profil program ke publik, dan menyediakan dashboard internal untuk memantau
kondisi mesin secara real-time, mencatat health check, mengelola anggota, serta mencatat penjualan
hasil olahan.

## Fitur

- **Landing page** — profil program, cara kerja pirolisis, dokumentasi kegiatan, dan kontak.
- **Login** — autentikasi pengelola (operator/admin) dengan halaman dashboard yang terproteksi.
- **Dashboard** — ringkasan status mesin, tren produksi, ringkasan penjualan, dan alert terbaru.
- **Monitoring & Log** — pembacaan sensor (berat, suhu, gas) secara langsung + grafik tren dan riwayat sesi.
- **Health Check** — status kondisi mesin berbasis aturan ambang, riwayat per sesi, dan perkiraan yield.
- **Anggota** — kelola data tim pelaksana & operator (tambah/ubah/hapus).
- **Penjualan** — catat penjualan minyak, ringkasan per periode, dan grafik bulanan.

## Teknologi

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/)
- [React Router](https://reactrouter.com/) untuk routing
- [Tailwind CSS](https://tailwindcss.com/) untuk styling
- [Recharts](https://recharts.org/) untuk grafik
- [MSW](https://mswjs.io/) untuk mock API selama pengembangan

## Menjalankan secara lokal

Butuh [Node.js](https://nodejs.org/) versi 18 ke atas.

```bash
# pasang dependency
npm install

# jalankan server pengembangan
npm run dev
```

Buka `http://localhost:5173` di browser.

Untuk mencoba dashboard, masuk dengan salah satu akun contoh:

| Username        | Kata sandi    | Peran    |
| --------------- | ------------- | -------- |
| `admin`         | `admin123`    | Admin    |
| `operator_rw04` | `operator123` | Operator |

## Perintah lain

```bash
npm run build     # build untuk produksi
npm run preview   # pratinjau hasil build
npm run lint      # cek kualitas kode
```

## Struktur proyek

```
src/
├── components/    # komponen UI yang dipakai ulang (kartu, tabel, grafik, modal, dll)
├── context/       # AuthContext untuk status login
├── hooks/         # hook khusus (fetch data, animasi, toast)
├── lib/           # helper format angka/tanggal & aturan health check
├── mocks/         # mock API (MSW) + data contoh
├── pages/         # halaman publik & dashboard
└── services/      # pembungkus fetch & koneksi real-time
```

## Catatan

Saat ini data masih menggunakan **mock API** agar pengembangan antarmuka bisa berjalan tanpa server.
Detail kontrak datanya ada di [`src/mocks/README.md`](src/mocks/README.md). Integrasi dengan backend
asli (API + database + model prediksi) dilakukan pada tahap berikutnya tanpa mengubah antarmuka.

Angka prediksi yield bersifat sementara dan akan semakin akurat seiring bertambahnya data produksi nyata.
