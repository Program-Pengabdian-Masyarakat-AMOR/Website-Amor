import { useMemo, useState } from 'react';
import Topbar from '../../components/layout/Topbar';
import DataTable from '../../components/DataTable';
import HealthStatusBadge from '../../components/HealthStatusBadge';
import Reveal from '../../components/Reveal';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { formatAngka, formatJam, formatTanggal, menitDariMs } from '../../lib/format';
import { tanggalHariIni, tanggalMundur } from '../../lib/periode';
import { downloadCsv } from '../../lib/csv';

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
const PREVIEW_ROWS = 100;
const sesiLabel = (id) => (id ? String(id).replace('SES-', '#') : '—');
const waktu = (iso) => `${formatTanggal(iso)} · ${formatJam(iso)}`;
const iso = (v) => (v ? new Date(v).toISOString() : '');

// Kolom tabel (render) + kolom CSV (value) per jenis rekap.
const JENIS = {
  production: {
    label: 'Sesi produksi',
    desc: 'Hasil tiap sesi pirolisis beserta prediksi yield AI dan status health.',
    columns: [
      { key: 'sesi', header: 'Sesi · Waktu', render: (r) => <div><b className="font-semibold">{sesiLabel(r.session_id)}</b><br /><span className="text-tinta-40 text-[12.5px]">{waktu(r.created_at)}</span></div> },
      { key: 'sampah', header: 'Sampah (kg)', align: 'right', cellClass: 'tnum', render: (r) => formatAngka(r.berat_sampah_total) },
      { key: 'minyak', header: 'Minyak (kg)', align: 'right', cellClass: 'tnum', render: (r) => formatAngka(r.berat_minyak_total) },
      { key: 'yield', header: 'Yield (%)', align: 'right', cellClass: 'tnum font-semibold', render: (r) => formatAngka(r.yield_percent) },
      { key: 'pred', header: 'Prediksi AI (%)', align: 'right', cellClass: 'tnum', render: (r) => formatAngka(r.predicted_yield) },
      { key: 'pir', header: 'Pirolisis (°C)', align: 'right', cellClass: 'tnum', render: (r) => formatAngka(r.suhu_pirolisis_avg) },
      { key: 'tun', header: 'Tungku (°C)', align: 'right', cellClass: 'tnum', render: (r) => formatAngka(r.suhu_tungku_avg) },
      { key: 'durasi', header: 'Durasi (mnt)', align: 'right', cellClass: 'tnum', render: (r) => menitDariMs(r.waktu_proses_ms) },
      { key: 'health', header: 'Health', render: (r) => (r.health_status ? <HealthStatusBadge status={r.health_status} size="sm" /> : '—') },
    ],
    csv: [
      { header: 'session_id', value: (r) => r.session_id },
      { header: 'waktu', value: (r) => iso(r.created_at) },
      { header: 'berat_sampah_kg', value: (r) => r.berat_sampah_total },
      { header: 'berat_minyak_kg', value: (r) => r.berat_minyak_total },
      { header: 'yield_persen', value: (r) => r.yield_percent },
      { header: 'prediksi_yield_ai_persen', value: (r) => r.predicted_yield },
      { header: 'suhu_pirolisis_avg_c', value: (r) => r.suhu_pirolisis_avg },
      { header: 'suhu_tungku_avg_c', value: (r) => r.suhu_tungku_avg },
      { header: 'setpoint_pirolisis_bawah_c', value: (r) => r.pirolisis_setpoint?.bawah },
      { header: 'setpoint_pirolisis_atas_c', value: (r) => r.pirolisis_setpoint?.atas },
      { header: 'setpoint_tungku_bawah_c', value: (r) => r.tungku_setpoint?.bawah },
      { header: 'setpoint_tungku_atas_c', value: (r) => r.tungku_setpoint?.atas },
      { header: 'durasi_menit', value: (r) => menitDariMs(r.waktu_proses_ms) },
      { header: 'status_health', value: (r) => r.health_status },
    ],
    ringkas: (rows) => {
      const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
      return [
        ['Jumlah sesi', formatAngka(rows.length)],
        ['Total sampah diolah', `${formatAngka(sum('berat_sampah_total'))} kg`],
        ['Total minyak', `${formatAngka(sum('berat_minyak_total'))} kg`],
        ['Rata-rata yield', rows.length ? `${formatAngka(sum('yield_percent') / rows.length)} %` : '—'],
      ];
    },
  },
  health: {
    label: 'Riwayat health',
    desc: 'Catatan status kesehatan mesin per sesi dan evaluasi bulanan AI.',
    columns: [
      { key: 'waktu', header: 'Waktu', render: (r) => <span className="whitespace-nowrap">{waktu(r.created_at)}</span> },
      { key: 'sesi', header: 'Sesi', render: (r) => sesiLabel(r.session_id) },
      { key: 'status', header: 'Status', render: (r) => <HealthStatusBadge status={r.status} size="sm" /> },
      { key: 'ket', header: 'Keterangan', render: (r) => <span className="text-tinta-60 text-[13px]">{r.keterangan}</span> },
    ],
    csv: [
      { header: 'waktu', value: (r) => iso(r.created_at) },
      { header: 'session_id', value: (r) => r.session_id },
      { header: 'status', value: (r) => r.status },
      { header: 'keterangan', value: (r) => r.keterangan },
    ],
    ringkas: (rows) => {
      const n = (s) => rows.filter((r) => r.status === s).length;
      return [
        ['Jumlah catatan', formatAngka(rows.length)],
        ['Normal', formatAngka(n('normal'))],
        ['Warning', formatAngka(n('warning'))],
        ['Critical', formatAngka(n('critical'))],
      ];
    },
  },
  feeder: {
    label: 'Gerak feeder',
    desc: 'Setiap perubahan ON/OFF feeder, baik manual, AI, maupun interlock keamanan.',
    columns: [
      { key: 'waktu', header: 'Waktu', render: (r) => <span className="whitespace-nowrap">{waktu(r.created_at)}</span> },
      { key: 'aksi', header: 'Feeder', render: (r) => <span className={`badge ${r.action === 'on' ? 'b-normal' : 'b-warning'}`}><span className="pip" />{String(r.action).toUpperCase()}</span> },
      { key: 'sumber', header: 'Sumber', render: (r) => <span className="capitalize">{r.source}</span> },
      { key: 'pir', header: 'Pirolisis (°C)', align: 'right', cellClass: 'tnum', render: (r) => formatAngka(r.suhu_pirolisis) },
      { key: 'tun', header: 'Tungku (°C)', align: 'right', cellClass: 'tnum', render: (r) => formatAngka(r.suhu_tungku) },
      { key: 'alasan', header: 'Alasan', render: (r) => <span className="text-tinta-60 text-[13px]">{r.reason}</span> },
    ],
    csv: [
      { header: 'waktu', value: (r) => iso(r.created_at) },
      { header: 'aksi', value: (r) => r.action },
      { header: 'sumber', value: (r) => r.source },
      { header: 'suhu_pirolisis_c', value: (r) => r.suhu_pirolisis },
      { header: 'suhu_tungku_c', value: (r) => r.suhu_tungku },
      { header: 'berat_sampah_kg', value: (r) => r.berat_sampah },
      { header: 'ai_score', value: (r) => r.ai_score },
      { header: 'alasan', value: (r) => r.reason },
    ],
    ringkas: (rows) => {
      const n = (f) => rows.filter(f).length;
      return [
        ['Jumlah gerakan', formatAngka(rows.length)],
        ['Manual', formatAngka(n((r) => r.source === 'manual'))],
        ['AI', formatAngka(n((r) => r.source === 'ai'))],
        ['Interlock', formatAngka(n((r) => r.source === 'interlock'))],
      ];
    },
  },
};

const PRESET = [
  { key: '7', label: '7 hari', range: () => [tanggalMundur(6), tanggalHariIni()] },
  { key: '30', label: '30 hari', range: () => [tanggalMundur(29), tanggalHariIni()] },
  { key: 'bulan', label: 'Bulan ini', range: () => [`${tanggalHariIni().slice(0, 7)}-01`, tanggalHariIni()] },
  { key: 'tahun', label: 'Tahun ini', range: () => [`${tanggalHariIni().slice(0, 4)}-01-01`, tanggalHariIni()] },
  { key: 'semua', label: 'Semua', range: () => ['', ''] },
];

// Admin: data lampau per rentang tanggal + unduh rekap CSV.
export default function Rekap() {
  const [jenis, setJenis] = useState('production');
  const [dari, setDari] = useState(tanggalMundur(29));
  const [sampai, setSampai] = useState(tanggalHariIni());
  const [preset, setPreset] = useState('30');

  const rentangValid = !dari || !sampai || dari <= sampai;
  const query = new URLSearchParams({ ...(dari && { dari }), ...(sampai && { sampai }) }).toString();
  const { data, loading, error } = useApi(
    () => (rentangValid ? api.get(`/recap/${jenis}${query ? `?${query}` : ''}`) : Promise.resolve({ rows: [] })),
    [jenis, query, rentangValid]
  );

  const def = JENIS[jenis];
  const rows = useMemo(() => data?.rows || [], [data]);
  const ringkasan = useMemo(() => def.ringkas(rows), [def, rows]);

  function pilihPreset(p) {
    const [d, s] = p.range();
    setDari(d);
    setSampai(s);
    setPreset(p.key);
  }

  function unduh() {
    const nama = `amor-rekap-${jenis}-${dari || 'awal'}_sd_${sampai || 'sekarang'}.csv`;
    downloadCsv(nama, def.csv, rows);
  }

  return (
    <>
      <Topbar crumb="Admin · Data & Rekap" title="Data Lampau & Rekap" />

      {/* Filter */}
      <Reveal className="card mb-5">
        <div className="p-[22px] flex flex-col gap-4">
          <div className="inline-flex flex-wrap gap-[2px] border border-border bg-permukaan rounded-[20px] p-[3px] self-start">
            {Object.entries(JENIS).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setJenis(k)}
                className={`text-[13.5px] font-semibold px-[14px] py-[7px] rounded-full transition-colors ${jenis === k ? 'bg-olive text-white' : 'text-tinta-60 hover:text-tinta'}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <p className="text-[13.5px] text-tinta-60 -mt-1">{def.desc}</p>

          <div className="flex items-end gap-3 flex-wrap">
            <label className="flex flex-col gap-[6px] text-[13px] font-semibold">
              Dari
              <input type="date" className="form-input !py-[8px] !w-auto" value={dari} max={sampai || undefined} onChange={(e) => { setDari(e.target.value); setPreset(null); }} />
            </label>
            <label className="flex flex-col gap-[6px] text-[13px] font-semibold">
              Sampai
              <input type="date" className="form-input !py-[8px] !w-auto" value={sampai} min={dari || undefined} onChange={(e) => { setSampai(e.target.value); setPreset(null); }} />
            </label>
            <div className="flex gap-[6px] flex-wrap">
              {PRESET.map((p) => (
                <button
                  key={p.key}
                  onClick={() => pilihPreset(p)}
                  className={`btn btn-sm border ${preset === p.key ? 'border-olive bg-olive-lembut text-olive' : 'border-border text-tinta-60 hover:text-tinta'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={unduh}
              disabled={loading || !!error || rows.length === 0}
              className="btn btn-primary px-[18px] py-[10px] text-[14px] ml-auto disabled:opacity-60 max-[640px]:ml-0 max-[640px]:w-full"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" {...svg} strokeWidth="1.9">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Unduh CSV ({formatAngka(rows.length)} baris)
            </button>
          </div>
          {!rentangValid && <p className="text-[13px] text-critical-teks">Tanggal “dari” tidak boleh setelah tanggal “sampai”.</p>}
        </div>
      </Reveal>

      {/* Ringkasan */}
      <Reveal delay={40} className="grid grid-cols-4 gap-4 mb-5 max-[900px]:grid-cols-2">
        {ringkasan.map(([k, v]) => (
          <div key={k} className="card px-5 py-4">
            <div className="text-[12.5px] text-tinta-60">{k}</div>
            <div className="font-body font-bold text-[22px] tnum mt-1">{loading ? '…' : v}</div>
          </div>
        ))}
      </Reveal>

      {/* Tabel */}
      <Reveal delay={80} className="card">
        <div className="card-hd">
          <h3 className="text-[16px] font-semibold">{def.label}</h3>
          <span className="text-[13px] text-tinta-60">
            {rows.length > PREVIEW_ROWS ? `Menampilkan ${PREVIEW_ROWS} dari ${formatAngka(rows.length)} baris · unduh CSV untuk semua` : `${formatAngka(rows.length)} baris`}
          </span>
        </div>
        <DataTable
          columns={def.columns}
          rows={rows.slice(0, PREVIEW_ROWS)}
          loading={loading}
          error={error}
          emptyMessage="Tidak ada data pada rentang tanggal ini."
        />
      </Reveal>
    </>
  );
}
