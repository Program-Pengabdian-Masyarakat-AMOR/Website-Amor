# Kontrak Mock API — AMOR (FASE 1)

Dokumen ini adalah **kontrak resmi** antara frontend (mock via MSW) dan backend.
Ada **dua arah data**:

1. **IoT → Web** — perangkat mengirim telemetri ke **Firebase RTDB**; **backend** membacanya
   (Firebase Admin SDK) lalu merelay ke FE via REST + Socket.io.
2. **Web → IoT** — FE mengirim setpoint/kontrol ke backend; **backend** menuliskannya ke Firebase
   `/input/...` yang dibaca perangkat.

FE **tidak** bicara langsung ke Firebase — semua lewat backend (`src/services/api.js` + `src/services/socket.js`).
Saat backend siap: matikan MSW, arahkan base URL, ganti fake-socket → socket.io-client. Komponen tak berubah.

- **Base path:** `/api` · **Auth:** `Authorization: Bearer <token>` untuk endpoint privat.
- **Sumber data mock:** `src/mocks/data/*.js` · **Handler:** `src/mocks/handlers.js`

---

## Struktur Firebase (acuan perangkat & backend)

**IoT → Web** (perangkat menulis, backend membaca):
Semua telemetri ada di SATU node `monitoring/`:
```
monitoring/
  suhu_pirolisis (number, °C)  suhu_tungku (number, °C)
  berat_sampah (number)  berat_minyak (number)  berat_sampah_total (number)
  status_gas (boolean)                  // true = gas terdeteksi
  status_sistem (string)                // "IDLE" | "PROCESS" | "FINISH"
  berat_sampah_total_akhir (number)  berat_minyak_total_akhir (number)  waktu_proses (number, detik)
```
Backend menormalkan `status_sistem`: `PROCESS→running`, `IDLE→idle`, `FINISH→finished`.
Saat `FINISH`, backend mencatat log produksi dari field `*_akhir` + `waktu_proses`.

**Web → IoT** (backend menulis ke node `input`, **key datar** sesuai firmware):
```
input/pirolisis_bawah   Integer
input/pirolisis_atas    Integer
input/tungku_bawah      Integer
input/tungku_atas       Integer
input/blower            Boolean
input/feeder            Boolean
```

---

## Skema objek (yang dilihat FE)

### telemetri (IoT → Web, real-time)
```
{ timestamp, suhu_pirolisis, suhu_tungku,
  berat_sampah, berat_minyak, berat_sampah_total,
  status_gas: boolean, status_sistem: "idle"|"running"|"finished" }
```

### production_logs (hasil akhir per sesi, saat FINISH)
Field mentah dari `monitoring/`: `berat_sampah_total_akhir`, `berat_minyak_total_akhir`, `waktu_proses` (detik).
Field turunan backend: `session_id`, `yield_percent`, `suhu_pirolisis_avg`, `suhu_tungku_avg`, `created_at`.
```
{ id, session_id, berat_sampah_total, berat_minyak_total, yield_percent,
  waktu_proses_detik, suhu_pirolisis_avg, suhu_tungku_avg, created_at }
```
Rumus: `yield_percent = (berat_minyak_total / berat_sampah_total) * 100`. UI menampilkan `waktu_proses_detik` sebagai menit.

### control (Web → IoT)
```
{ pirolisis: { bawah, atas }, tungku: { bawah, atas }, blower: boolean, feeder: boolean }
```

### health_status · predictions · members · oil_sales · users
`health_status`: `{ id, session_id, status: "normal"|"warning"|"critical", keterangan, created_at }`
`predictions`: `{ id, session_id, predicted_yield, actual_yield }`
`members`: `{ id, nama, nim_nip, jabatan, kontak, foto, created_at }`
`oil_sales`: `{ id, tanggal, jumlah_liter, harga_per_liter, total_harga, pembeli, created_at }`
`users` *(password tak pernah ke FE)*: `{ id, username, role: "admin"|"operator", created_at }`

---

## Endpoint

### Auth
`POST /api/auth/login` · publik → `{ token, role }` (mock terima kombinasi valid apa pun) · `400 { message }` bila kosong.

### Telemetri & produksi (IoT → Web)
- `GET /api/sensor-data/latest` → `{ latest: telemetri, series: telemetri[] }`
- `GET /api/production-logs` → `production_logs[]`
- `POST /api/production-logs` → `201` objek tersimpan *(FASE 2: memicu prediksi ONNX + health)*

### Health & prediksi
- `GET /api/health-status` → `{ current, history }` (`current` dihitung dari telemetri terhadap setpoint)
- `GET /api/predictions` → `predictions[]` — **UI wajib menampilkan disclaimer "preliminary"**

### Kontrol (Web → IoT)
- `GET /api/control` → objek control saat ini (read-back)
- `PUT /api/control/setpoint` body `{ pirolisis:{bawah,atas}, tungku:{bawah,atas} }` (integer) → setpoint terbaru (ditulis key datar ke Firebase)
- `PUT /api/control/kontrol` body `{ blower?:boolean, feeder?:boolean }` → control terbaru (ditulis `input/blower`, `input/feeder`)

### Anggota & penjualan
- `GET/POST /api/members` · `PUT/DELETE /api/members/:id`
- `GET/POST /api/sales` · `PUT/DELETE /api/sales/:id` (server hitung `total_harga`)
- `GET /api/sales/summary?dari&sampai` → `{ periode, jumlah_transaksi, total_liter, total_pendapatan }`

---

## Real-time (socket)

Antarmuka `src/services/socket.js` identik `socket.io-client` (`on`/`off`/`emit`/`disconnect`).

| Event | Payload |
|---|---|
| `sensor-update` | objek telemetri |
| `health-update` | `{ status, keterangan, ... }` dihitung dari `src/lib/thresholds.js` |

FASE 2: ganti util ini dengan `io(BASE_URL)`; event & bentuk payload tetap sama.

---

## Aturan health check (rule-based)

Ada di `src/lib/thresholds.js` (mock & UI memakai aturan yang sama; final di backend).
Prinsip proses: **makin panas → pembakaran makin sempurna → gas makin minim**. Jadi suhu dinilai
terhadap **pita target** (setpoint `bawah`–`atas`), bukan sekadar batas atas.

Alert & severity (suhu **pirolisis & tungku** dinilai terhadap pita target masing-masing):
- `status_gas === true` → gas terdeteksi → **critical** (bahaya nyata).
- `suhu_pirolisis` / `suhu_tungku` **< bawah** (saat running) → pembakaran belum optimal → **warning**.
- `suhu_pirolisis` / `suhu_tungku` **> atas** (saat running) → overheat → **warning**.

Suhu hanya dievaluasi saat `status_sistem = running`; saat idle/finished dianggap aman.
Status keseluruhan = severity tertinggi: ada `critical` → **critical**; ada alert lain → **warning**; tidak ada → **normal**.
**Suhu di luar pita hanya memicu peringatan (warning) — TIDAK pernah menghentikan proses.** Hanya gas yang critical.
