# AMOR — Arsitektur Pull & Push Data

Browser **tidak pernah** berbicara langsung dengan Firebase. Semua lalu lintas data melewati
backend (Express + Socket.IO) yang memegang kredensial Firebase Admin.

- **PULL** = data diambil / didengarkan dari sumbernya (IoT → Firebase → Backend → Browser).
- **PUSH** = data dikirim ke tujuan (Browser → Backend → Firebase → IoT, serta Backend → Browser via socket).

> Render: GitHub, VS Code (ekstensi Markdown Mermaid), atau https://mermaid.live

---

## 1. Arsitektur keseluruhan

```mermaid
flowchart LR
    subgraph LAPANGAN["Lapangan · Reaktor pirolisis"]
        IOT["Mikrokontroler IoT<br/>sensor suhu pirolisis & tungku,<br/>load cell, MQ-2 gas,<br/>aktuator blower & feeder"]
    end

    subgraph FIREBASE["Firebase Realtime Database"]
        MON[("monitoring/<br/>telemetri")]
        INP[("input/<br/>setpoint & kontrol")]
        INFO[(".info/connected")]
    end

    subgraph SERVER["Server amor.co.id"]
        NGINX["nginx<br/>file statis SPA + reverse proxy /api & socket"]
        subgraph BACKEND["Backend Node.js"]
            BR["firebaseBridge<br/>listener + penulis Firebase"]
            AI["AI engine ONNX<br/>yield · feeder · health"]
            API["REST API /api<br/>JWT + role guard"]
            SIO["Socket.IO<br/>JWT di handshake"]
        end
        DB[("Database Prisma<br/>ProductionLog, HealthStatus,<br/>Prediction, FeederMovement,<br/>Sale, Member, User, SiteContent")]
    end

    subgraph BROWSER["Browser"]
        ADM["Admin"]
        OPR["Operator"]
        MGT["Management"]
        PUB["Pengunjung landing page"]
    end

    IOT -->|"PUSH telemetri"| MON
    INP -->|"PULL setpoint & perintah"| IOT

    MON -->|"PULL on('value')"| BR
    INP -->|"PULL on('value')"| BR
    INFO -->|"PULL status koneksi"| BR
    BR -->|"PUSH update()"| INP

    BR <--> AI
    BR -->|"simpan sesi / health / prediksi / gerak feeder"| DB
    API <--> DB
    API <--> BR
    BR -->|"emit event"| SIO

    NGINX --- API
    NGINX --- SIO

    SIO -->|"PUSH realtime"| ADM
    SIO -->|"PUSH realtime"| OPR
    ADM -->|"PULL REST"| NGINX
    OPR -->|"PULL + PUSH REST"| NGINX
    MGT -->|"PULL + PUSH REST"| NGINX
    PUB -->|"PULL REST publik"| NGINX
```

## 2. Struktur node Firebase

```mermaid
flowchart TB
    ROOT(("RTDB root"))
    ROOT --> MON["monitoring/ — ditulis IoT, dibaca backend"]
    ROOT --> INP["input/ — ditulis backend, dibaca IoT"]

    MON --> M1["suhu_pirolisis : number °C"]
    MON --> M2["suhu_tungku : number °C"]
    MON --> M3["berat_sampah · berat_minyak · berat_sampah_total : number kg"]
    MON --> M4["status_gas : boolean"]
    MON --> M5["status_sistem : IDLE | PROCESS | FINISH"]
    MON --> M6["berat_sampah_total_akhir · berat_minyak_total_akhir : number kg"]
    MON --> M7["waktu_proses : number ms"]

    INP --> I1["pirolisis_bawah · pirolisis_atas : integer °C"]
    INP --> I2["tungku_bawah · tungku_atas : integer °C"]
    INP --> I3["blower · feeder : boolean"]
    INP --> I4["alarm : boolean"]
```

## 3. PULL — telemetri IoT sampai ke layar

```mermaid
sequenceDiagram
    autonumber
    participant IoT as Perangkat IoT
    participant FB as Firebase monitoring/
    participant BR as Backend · firebaseBridge
    participant AI as AI engine ONNX
    participant DB as Database
    participant SIO as Socket.IO
    participant FE as Browser (admin / operator)

    IoT->>FB: tulis telemetri (tiap siklus sensor)
    FB-->>BR: on('value') → snapshot monitoring
    BR->>BR: debounce 250 ms → buildTelemetry()<br/>(+ session_started_at, prediksi live)
    BR->>SIO: emit sensor-update & health-update
    SIO-->>FE: PUSH realtime ke klien ber-JWT valid
    BR->>AI: evaluasi feeder + prediksi yield (tiap 5 dtk saat running)
    AI-->>SIO: yield-prediction / ai-feeder-decision
    BR->>BR: akumulasi rata-rata per menit
    BR->>SIO: emit temp-log (tiap 60 dtk)

    alt status_sistem berubah ke FINISH
        BR->>AI: prediksi final + health sesi
        BR->>DB: simpan ProductionLog, Prediction, HealthStatus
    end

    Note over FE: Buka / refresh halaman
    FE->>BR: GET /api/sensor-data/latest (PULL)
    BR-->>FE: { latest, series 30 menit }
    FE->>BR: GET /api/production-logs, /health-status, /feeder-logs (PULL riwayat dari DB)
```

## 4. PUSH — perintah dari web sampai ke mesin

```mermaid
sequenceDiagram
    autonumber
    actor OP as Operator
    participant FE as Browser · Kontrol
    participant API as Backend REST
    participant BR as firebaseBridge
    participant FB as Firebase input/
    participant IoT as Perangkat IoT
    participant DB as Database
    participant SIO as Socket.IO

    OP->>FE: Ubah setpoint / blower / feeder / alarm
    FE->>API: PUT /api/control/setpoint atau /control/kontrol
    API->>API: requireAuth + requireRole('operator')<br/>validasi 0–1200 °C, bawah lebih kecil dari atas
    API->>BR: setSetpoint() / setKontrol()
    BR->>FB: update({ pirolisis_bawah, …, blower, feeder, alarm })
    FB-->>IoT: PULL oleh perangkat → aktuator bergerak
    BR->>BR: catat last_write_at / last_write_error
    opt perubahan feeder
        BR->>DB: simpan FeederMovement (manual / ai / interlock)
        BR->>SIO: emit feeder-movement
        SIO-->>FE: PUSH log gerak feeder
    end
    BR->>BR: reevaluasi guard AI feeder dengan setpoint baru
    API-->>FE: state kontrol terbaru
    FB-->>BR: on('value') input/ → sinkron state kontrol
```

## 5. PULL & PUSH data aplikasi per role

```mermaid
flowchart LR
    subgraph ADMIN
        A1["Status Sistem"] -->|"PULL tiap 15 dtk"| S1["GET /system/status<br/>Firebase · DB · AI · server"]
        A1 -.->|"PUSH socket"| S2["sensor-update"]
        A2["Data & Rekap"] -->|"PULL"| S3["GET /recap/production|health|feeder<br/>?dari&sampai → CSV di browser"]
        A3["Health Check"] -->|"PULL"| S4["GET /health-status, /predictions,<br/>/sensor-data/latest, /control"]
        A4["Anggota"] -->|"PULL + PUSH"| S5["GET/POST/PUT/DELETE /members"]
    end
    subgraph OPERATOR
        O1["Dashboard / Monitoring"] -->|"PULL"| S6["GET /sensor-data/latest,<br/>/production-logs, /feeder-logs"]
        O1 -.->|"PUSH socket"| S7["sensor-update, temp-log,<br/>feeder-movement"]
        O2["Kontrol"] -->|"PUSH"| S8["PUT /control/setpoint,<br/>/control/kontrol, /ai/feeder-mode"]
    end
    subgraph MANAGEMENT
        M1["Penjualan"] -->|"PULL + PUSH"| S9["GET/POST/PUT/DELETE /sales,<br/>GET /sales/summary"]
        M2["Data Publik"] -->|"PUSH"| S10["PUT /site-content/landing-stats"]
    end
    subgraph PUBLIK
        P1["Landing page"] -->|"PULL"| S11["GET /site-content/landing-stats"]
    end
```

## 6. Pemantauan koneksi Firebase (health check admin)

```mermaid
stateDiagram-v2
    [*] --> Off: kredensial Firebase kosong
    [*] --> Simulator: development tanpa Firebase
    [*] --> Tersambung: .info/connected = true

    Tersambung --> Terputus: .info/connected = false
    Terputus --> Tersambung: .info/connected = true

    state Tersambung {
        [*] --> DataSegar
        DataSegar --> DataBasi: monitoring tidak berubah lebih dari 120 dtk
        DataBasi --> DataSegar: snapshot monitoring baru
        DataBasi: Data basi - overall WARNING
        DataSegar: Data segar - overall NORMAL bila DB dan AI sehat
    }

    Off: Off - overall CRITICAL
    Terputus: Terputus - overall CRITICAL
```
