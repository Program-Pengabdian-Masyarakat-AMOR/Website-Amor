# AMOR — Backend

Backend AMOR menjadi jembatan Firebase ↔ web, API aplikasi, penyimpanan Prisma, inference ONNX, dan kontrol AI feeder.

## Dynamic-setpoint AI

Setpoint suhu yang disimpan operator sekarang menjadi konteks dinamis untuk tiga subsistem AI:

- **Feeder:** `feeder_policy.onnx` menilai state relatif terhadap pita setpoint aktif. Keputusan ONNX kemudian diperiksa safety interlock dan **lightweight MPC** memilih hold / half pulse / full pulse.
- **Yield:** prediksi memakai suhu absolut, adherence ke setpoint aktif, pusat pita, progress, projected recovery, dan filter temperatur sesi **mean + EWMA**.
- **Health:** setiap ProductionLog menyimpan snapshot/rata-rata setpoint sesi sehingga monthly health menilai adherence terhadap target yang benar-benar dipakai pada saat produksi.

Hard safety tetap independen dari AI. Gas, status mesin, hard cutoff pirolisis, batas tungku, cooldown, dan manual override tidak boleh digantikan oleh model.

## Menjalankan

Butuh Node.js 18+.

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:deploy
npm run seed
npm run dev
```

Untuk database development baru, `npm run prisma:migrate` juga dapat dipakai. Migration `20260814133000_dynamic_setpoint_ai` menambahkan snapshot suhu terfilter dan setpoint ke `ProductionLog`.

## Model AI

Backend membaca:

```text
models/
├── yield_predictor.onnx
├── feeder_policy.onnx
├── monthly_health.onnx
└── model_manifest.json
```

Jika `onnxruntime-node` atau model tidak tersedia, backend memiliki fallback numerik dengan kontrak fitur yang sama. Status engine/model dapat dibaca dari endpoint AI status.

Model saat ini synthetic reference-informed dan belum production-calibrated. Gunakan **OBSERVE** untuk pengumpulan data real sebelum commissioning AUTO.

## Konfigurasi penting

Lihat `.env.example`. Kelompok konfigurasi baru meliputi:

- `AI_PYRO_MODEL_*` / `AI_FURNACE_MODEL_*`: guard envelope model;
- `AI_PYRO_HIGH_CUTOFF_C`, `AI_FEEDER_MIN_FURNACE_C`, `AI_FEEDER_MAX_FURNACE_C`: hard safety;
- `AI_MPC_*`: horizon dan bootstrap thermal response lightweight MPC;
- `AI_TEMP_EWMA_ALPHA`: filter temperatur untuk yield prediction.

Koefisien `AI_MPC_PYRO_DROP_C` dan `AI_MPC_FURNACE_DROP_C` **harus dikalibrasi dari step-response mesin nyata** sebelum mode AUTO dipakai sebagai operasi normal.

## Firebase

**IoT → Web:** telemetry suhu, berat, gas, status proses, hasil akhir.

**Web → IoT:** setpoint pirolisis/tungku, blower, feeder, dan alarm melalui bridge backend. Saat setpoint berubah, feeder AI langsung dievaluasi ulang; pulse AUTO yang tidak lagi aman akan ditahan/dimatikan.

## Endpoint utama

- `POST /api/auth/login`
- `GET /api/sensor-data/latest`
- `GET/POST /api/production-logs`
- `GET /api/health-status`
- `GET /api/predictions`
- `GET /api/control`
- `PUT /api/control/setpoint`
- `PUT /api/control/kontrol`
- endpoint AI/status/feeder-mode yang didaftarkan di routes AI

Socket utama mencakup `sensor-update`, `health-update`, `yield-prediction`, `ai-feeder-mode`, dan `ai-feeder-decision`.
