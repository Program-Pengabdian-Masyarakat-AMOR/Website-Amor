# AMOR — Backend

Backend untuk website AMOR. Perannya:

- **Jembatan Firebase ↔ web.** Membaca telemetri IoT dari Firebase Realtime Database dan
  merelaynya ke frontend lewat REST + **Socket.io**; menulis perintah kontrol web ke `/input/...`.
- **API** untuk auth, monitoring, kontrol, health check, anggota, dan penjualan.
- **Basis data** (Prisma) untuk data non-realtime: user, anggota, penjualan, log produksi, dll.

Kontrak endpoint & bentuk data mengikuti `frontend/src/mocks/README.md` — jadi frontend cukup
mengarahkan base URL ke backend ini tanpa mengubah komponen.

## Teknologi

Express · Socket.io · firebase-admin · Prisma (SQLite untuk dev) · JWT + bcrypt.

## Menjalankan

Butuh Node.js 18+.

```bash
npm install
cp .env.example .env      # lalu isi nilainya (lihat di bawah)

npm run prisma:generate   # generate Prisma Client
npm run prisma:migrate    # buat tabel SQLite (prisma/dev.db)
npm run seed              # isi data awal + akun login

npm run dev               # server di http://localhost:4000
```

### Isi `.env`

- `JWT_SECRET` — string acak panjang.
- `DATABASE_URL` — biarkan `file:./dev.db` untuk dev.
- **Firebase** (dari service account JSON):
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (tempel apa adanya,
    dalam tanda kutip, biarkan `\n`), `FIREBASE_DATABASE_URL`.

> Tanpa kredensial Firebase, server tetap jalan memakai **simulator telemetri** (untuk dev),
> sehingga endpoint & socket tetap hidup.

## Akun contoh (hasil seed)

| Username | Kata sandi | Peran |
| --- | --- | --- |
| `admin` | `admin123` | admin |
| `operator_rw04` | `operator123` | operator |

## Struktur Firebase yang dibaca/ditulis

**IoT → Web (dibaca):** `berat/`, `gas/status_gas`, `suhu/`, `status/status_sistem`, `hasil_akhir/`.
**Web → IoT (ditulis):** `/input/pirolisis/{suhu_bawah,suhu_atas}`, `/input/tungku/{suhu_bawah,suhu_atas}`,
`/input/kontrol/{blower,feeder}`.

## Menyambungkan frontend

Di `frontend/`, set `VITE_API_BASE_URL=http://localhost:4000/api`, matikan MSW, dan arahkan
socket ke backend. Detail langkah ada di `frontend/src/mocks/README.md`.

## Endpoint

`POST /api/auth/login` · `GET /api/sensor-data/latest` · `GET/POST /api/production-logs` ·
`GET /api/health-status` · `GET /api/predictions` · `GET /api/control` ·
`PUT /api/control/setpoint` · `PUT /api/control/kontrol` · CRUD `/api/members` ·
CRUD `/api/sales` + `GET /api/sales/summary`.

Socket: event `sensor-update` & `health-update`.

## Catatan

- Prediksi yield (`predicted_yield`) masih `null` sampai model ONNX terpasang (tahap lanjutan).
- Saat sesi selesai (`status_sistem` `running` → `idle`), backend otomatis mencatat log produksi,
  health, dan prediksi dari `hasil_akhir`.
