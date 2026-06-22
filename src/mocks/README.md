# Kontrak Mock API — AMOR (FASE 1)

Dokumen ini adalah **kontrak resmi** antara frontend (FASE 1, mock via MSW) dan backend (FASE 2, Express asli).
Backend FASE 2 **wajib mengikuti bentuk request/response di sini persis** — saat backend siap, transisi cukup:

1. Matikan MSW (hapus blok `enableMocking()` di `src/main.jsx`, atau set `VITE_USE_MOCKS=false`).
2. Arahkan base URL di `src/services/api.js` ke backend (`VITE_API_BASE_URL`).
3. Ganti fake-socket (`src/services/socket.js`) → `socket.io-client` asli.

Tidak ada komponen yang perlu diubah.

- **Base path:** `/api`
- **Auth:** header `Authorization: Bearer <token>` pada endpoint privat.
- **Format:** JSON, `Content-Type: application/json`. Angka desimal pakai titik (JSON), pemformatan `id-ID` dilakukan di UI.
- **Sumber data mock:** `src/mocks/data/*.js` · **Handler:** `src/mocks/handlers.js`

---

## Skema entitas (bentuk objek)

> camelCase tidak dipakai di sini — field mengikuti penamaan kontrak (`snake_case`/Indonesia) seperti di `docs/CLAUDE.md`.

### users *(password tidak pernah dikirim ke FE)*
`{ id, username, role: "admin"|"operator", created_at }`

### sensor_logs
`{ id, device_id, timestamp, berat_input, suhu_reaktor, gas_level, status_proses: "running"|"idle"|"finished" }`

### production_logs
`{ id, session_id, berat_input_total, berat_output_minyak, yield_percent, suhu_avg, suhu_max, durasi_menit, created_at }`
Rumus: `yield_percent = (berat_output_minyak / berat_input_total) * 100`

### health_status
`{ id, session_id, status: "normal"|"warning"|"critical", keterangan, created_at }`

### predictions
`{ id, session_id, predicted_yield, actual_yield }`

### members
`{ id, nama, nim_nip, jabatan, kontak, foto, created_at }`

### oil_sales
`{ id, tanggal, jumlah_liter, harga_per_liter, total_harga, pembeli, created_at }`
Rumus: `total_harga = jumlah_liter * harga_per_liter`

---

## Endpoint

### `POST /api/auth/login` · publik
Req: `{ username, password }`
Res `200`: `{ token, role }` — mock menerima kombinasi valid apa pun (cocok ke seed bila ada, selain itu `role: "operator"`).
Res `400`: `{ message }` bila username/password kosong.

### `GET /api/sensor-data/latest` · privat
Res `200`: `{ latest: sensor_logs, series: sensor_logs[] }`
`series` = tren intra-sesi (dipakai grafik Monitoring). Live update dikirim lewat socket `sensor-update`.

### `GET /api/production-logs` · privat
Res `200`: `production_logs[]` (urut terbaru dulu).

### `POST /api/production-logs` · privat
Req: subset `production_logs` (tanpa `id`/`created_at`).
Res `201`: objek `production_logs` yang tersimpan.
*(FASE 2: endpoint ini memicu prediksi ONNX + perhitungan health, lalu emit `health-update`.)*

### `GET /api/health-status` · privat
Res `200`: `{ current: health_status, history: health_status[] }` (history urut terbaru dulu).

### `GET /api/predictions` · privat
Res `200`: `predictions[]`. **UI wajib menampilkan disclaimer "preliminary".**

### `GET/POST/PUT/DELETE /api/members` · privat
- `GET` → `members[]`
- `POST` (body tanpa `id`) → `201` objek baru
- `PUT /api/members/:id` (body field yang diubah) → objek ter-update · `404 { message }` bila tidak ada
- `DELETE /api/members/:id` → `{ id }`

### `GET/POST/PUT/DELETE /api/sales` · privat
- `GET` → `oil_sales[]`
- `POST` (body tanpa `id`/`total_harga`) → `201`; server menghitung `total_harga`
- `PUT /api/sales/:id` → objek ter-update (server hitung ulang `total_harga`) · `404 { message }` bila tidak ada
- `DELETE /api/sales/:id` → `{ id }`

### `GET /api/sales/summary` · privat
Query (opsional): `dari=YYYY-MM-DD`, `sampai=YYYY-MM-DD` (filter inklusif terhadap `tanggal`).
Res `200`:
```json
{
  "periode": { "dari": "2026-06-01", "sampai": "2026-06-30" },
  "jumlah_transaksi": 8,
  "total_liter": 128.0,
  "total_pendapatan": 768200
}
```

---

## Real-time (socket)

Antarmuka `src/services/socket.js` dibuat identik dengan `socket.io-client` (`on`/`off`/`emit`/`disconnect`).

| Event | Payload | Keterangan |
|---|---|---|
| `sensor-update` | mirip `sensor_logs` | di-emit tiap ~3 detik selama ada listener |
| `health-update` | mirip `health_status` | dihitung dari ambang di `src/lib/thresholds.js` |

FASE 2: cukup ganti implementasi util ini dengan koneksi `io(BASE_URL)` asli; event & bentuk payload tetap sama.

---

## Aturan health check (rule-based)

Dipakai mock & UI; logika final ada di backend FASE 2 (`src/lib/thresholds.js`):
`0 pelanggaran → normal · 1 → warning · ≥2 → critical`. Pemicu: suhu > batas, gas terdeteksi, durasi di luar rentang, yield di bawah ambang.
