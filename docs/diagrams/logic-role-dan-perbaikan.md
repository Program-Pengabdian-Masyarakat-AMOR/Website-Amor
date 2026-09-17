# AMOR — Diagram Logic Role, Login & Perbaikan Bug

Dokumen ini menggambarkan logic pembaruan: 3 role (admin, operator, management), login berbasis role
di alamat tersamar, pembagian section dashboard, edit data publik landing page, serta perbaikan
bug timer refresh dan bug keuangan yang mentok di April.

> Render: GitHub, VS Code (ekstensi Markdown Mermaid), atau https://mermaid.live

---

## 1. Alur login berbasis role (URL tersamar)

```mermaid
flowchart TD
    A([Pengguna membuka website]) --> B{Alamat yang dibuka}
    B -->|"/"| L[Landing page publik<br/>tanpa tombol Masuk]
    B -->|"/login atau alamat lain"| NF[Halaman 404]
    B -->|"/dashboard tanpa sesi"| NF
    B -->|"/administrator/login"| F[Form login]

    F --> R[Pilih role:<br/>Admin / Operator / Management]
    R --> U[Isi username + kata sandi]
    U --> V{Validasi form di browser}
    V -->|role / field kosong| F
    V -->|lengkap| P["POST /api/auth/login<br/>{ username, password, role }"]

    P --> RL{Rate limit<br/>maks 10x / menit / IP}
    RL -->|terlampaui| E429[429 Terlalu banyak percobaan] --> F
    RL -->|aman| C{"User ada?<br/>bcrypt cocok?<br/>user.role == role dipilih?"}
    C -->|tidak| E401["401 'Role, username, atau<br/>kata sandi tidak sesuai'"] --> F
    C -->|ya| T["JWT { sub, username, role }<br/>berlaku 12 jam"]

    T --> S[Simpan token + role<br/>di localStorage]
    S --> D["/dashboard → beranda sesuai role"]
```

## 2. Pembagian section per role

```mermaid
flowchart LR
    subgraph ADMIN["ADMIN · monitoring & health check"]
        A1["Status Sistem<br/>/dashboard"]
        A2["Health Check<br/>/dashboard/health"]
        A3["Data & Rekap (unduh CSV)<br/>/dashboard/rekap"]
        A4["Anggota<br/>/dashboard/members"]
    end
    subgraph OPERATOR["OPERATOR · operasional mesin"]
        O1["Dashboard operasional<br/>/dashboard"]
        O2["Monitoring & Log<br/>/dashboard/monitoring"]
        O3["Kontrol mesin + mode AI feeder<br/>/dashboard/kontrol"]
    end
    subgraph MANAGEMENT["MANAGEMENT · penjualan & data publik"]
        M1["Dashboard penjualan<br/>/dashboard"]
        M2["Penjualan (CRUD)<br/>/dashboard/sales"]
        M3["Data Publik landing page<br/>/dashboard/konten"]
    end
```

## 3. Hak akses API per role (dikunci di backend)

| Endpoint | Admin | Operator | Management | Publik |
|---|:-:|:-:|:-:|:-:|
| `GET /sensor-data/latest`, `/production-logs`, `/health-status`, `/predictions`, `/feeder-logs`, `/control`, `/ai/status`, `/ai/monthly-health` | ✅ | ✅ | ❌ | ❌ |
| `POST /production-logs` | ✅ | ✅ | ❌ | ❌ |
| `PUT /control/setpoint`, `PUT /control/kontrol`, `PUT /ai/feeder-mode` | ❌ | ✅ | ❌ | ❌ |
| `GET /system/status`, `GET /recap/:jenis`, `* /members`, `POST /ai/warmup` | ✅ | ❌ | ❌ | ❌ |
| `* /sales`, `GET /sales/summary`, `PUT /site-content/:key` | ❌ | ❌ | ✅ | ❌ |
| `GET /site-content/:key` | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/login` | ✅ | ✅ | ✅ | ✅ |

## 4. Penjaga akses (frontend + backend)

```mermaid
flowchart TD
    N[Pengguna membuka /dashboard/xxx] --> T{Punya token?}
    T -->|tidak| NF[Redirect /404<br/>alamat login tidak terbongkar]
    T -->|ya| RR{"Role boleh membuka<br/>halaman ini? (App.jsx)"}
    RR -->|tidak| H["Redirect /dashboard<br/>(beranda role sendiri)"]
    RR -->|ya| PG[Render halaman + menu Sidebar sesuai role]

    PG --> API["Request API + Bearer token"]
    API --> JWT{"requireAuth:<br/>JWT valid?"}
    JWT -->|tidak / kedaluwarsa| X401[401 → hapus sesi →<br/>/administrator/login]
    JWT -->|ya| ROLE{"requireRole:<br/>role diizinkan?"}
    ROLE -->|tidak| X403[403 Akses ditolak]
    ROLE -->|ya| OK[Data dikirim]
```

## 5. Edit data produksi di landing page (management)

```mermaid
sequenceDiagram
    autonumber
    actor M as Management
    participant FE as Dashboard · Data Publik
    participant BE as Backend API
    participant DB as Database (SiteContent)
    actor P as Pengunjung
    participant LP as Landing page

    M->>FE: Buka /dashboard/konten
    FE->>BE: GET /api/site-content/landing-stats
    BE->>DB: cari key "landing-stats"
    DB-->>BE: baris / kosong
    BE-->>FE: items (atau nilai awal bila belum pernah diubah)
    M->>FE: Ubah angka, satuan, keterangan,<br/>urutan, tampil/sembunyi
    FE->>FE: Validasi (angka & keterangan wajib, 1–4 item)
    FE->>BE: PUT /api/site-content/landing-stats (JWT management)
    BE->>BE: requireRole('management') + sanitasi input
    BE->>DB: upsert { value JSON, updatedBy }
    BE-->>FE: data terbaru + updated_at/by

    P->>LP: Buka amor.co.id
    LP->>BE: GET /api/site-content/landing-stats (publik)
    BE-->>LP: items
    LP->>LP: Tampilkan item visible<br/>(gagal fetch → pakai nilai cadangan)
```

## 6. Perbaikan bug timer proses yang reset saat refresh

**Sebelum:** timer dihitung dari jam browser saat halaman pertama kali melihat status `running`,
sehingga refresh = timer kembali `00:00`.
**Sesudah:** backend mencatat `startedAt` saat sesi mulai dan mengirim `session_started_at`
di setiap telemetri; browser menghitung `sekarang − session_started_at`.

```mermaid
sequenceDiagram
    autonumber
    participant IoT as Perangkat IoT
    participant FB as Firebase RTDB
    participant BE as Backend (firebaseBridge)
    participant FE as Browser · Monitoring

    IoT->>FB: monitoring/status_sistem = "PROCESS"
    FB-->>BE: on('value')
    BE->>BE: startSession() → startedAt = 10:00:00
    BE-->>FE: sensor-update { status_sistem: running,<br/>session_started_at: 10:00:00 }
    FE->>FE: timer = sekarang − 10:00:00

    Note over FE: Pengguna menekan refresh (10:25:00)
    FE->>BE: GET /api/sensor-data/latest
    BE-->>FE: latest { session_started_at: 10:00:00 }
    FE->>FE: timer langsung 25:00 (tidak reset)

    IoT->>FB: status_sistem = "FINISH"
    FB-->>BE: on('value')
    BE->>BE: finalizeSession() → simpan ProductionLog
    BE-->>FE: sensor-update { status_sistem: finished }
    FE->>FE: timer berhenti → tampil durasi terakhir
```

## 7. Perbaikan bug keuangan yang mentok di April

**Sebelum:** pilihan periode ditulis mati (`April`, `Mei`, `Juni`, `Apr–Jun 2026`) dan kartu
"Bulan ini" dikunci ke Juni 2026, sehingga transaksi Juli dst. tidak pernah terlihat.
**Sesudah:** periode dihitung dari kalender.

```mermaid
flowchart TD
    O[Buka halaman Penjualan] --> D["Default = tahun & bulan berjalan<br/>(new Date())"]
    D --> Y["Pilihan tahun = tahun yang punya transaksi<br/>+ tahun berjalan"]
    Y --> PB{"Pilih bulan<br/>Jan…Des atau Setahun"}
    PB -->|bulan| R1["dari = YYYY-MM-01<br/>sampai = hari terakhir bulan itu<br/>(kabisat otomatis)"]
    PB -->|setahun| R2["dari = YYYY-01-01<br/>sampai = YYYY-12-31"]
    R1 --> Q["GET /api/sales/summary?dari&sampai"]
    R2 --> Q
    Q --> K[Kartu liter & pendapatan periode]
    R1 --> TB["Tabel: filter tanggal diawali YYYY-MM"]
    R2 --> TB2["Tabel: filter tanggal diawali YYYY-"]
    Y --> G["Grafik 12 bulan tahun terpilih<br/>bulan tanpa transaksi = 0"]
```
