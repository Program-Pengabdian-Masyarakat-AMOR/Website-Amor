import { lazy, Suspense } from 'react';
import Topbar from '../../components/layout/Topbar';
import HealthStatusBadge from '../../components/HealthStatusBadge';
import DataTable from '../../components/DataTable';
import ChartFallback from '../../components/ChartFallback';
import Reveal from '../../components/Reveal';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { statusSuhu, hitungAlert, statusDariAlert } from '../../lib/thresholds';
import { formatAngka, formatJam, formatTanggal } from '../../lib/format';

const LineChart = lazy(() => import('../../components/LineChart'));

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

const STATUS_BIG = {
  normal: {
    word: 'Normal',
    ringWord: 'text-normal-teks',
    ring: 'border-normal text-normal',
    tint: 'from-normal-bg',
    icon: <path d="m20 6-11 11-5-5" />,
    desc: 'Semua parameter mesin berada dalam rentang aman. Proses berjalan normal.',
  },
  warning: {
    word: 'Warning',
    ringWord: 'text-warning-teks',
    ring: 'border-warning text-warning',
    tint: 'from-warning-bg',
    icon: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 2.4 18a1.8 1.8 0 0 0 1.6 2.7h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0z" /></>,
    desc: 'Mesin masih berjalan, tetapi ada beberapa hal yang perlu diperhatikan operator. Belum berbahaya, namun sebaiknya dicek.',
  },
  critical: {
    word: 'Critical',
    ringWord: 'text-critical-teks',
    ring: 'border-critical text-critical',
    tint: 'from-critical-bg',
    icon: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" /></>,
    desc: 'Beberapa parameter melewati batas aman. Operator perlu segera memeriksa kondisi reaktor.',
  },
};

const ICON = {
  gas: <><path d="M3 17a9 9 0 0 1 18 0" /><path d="M12 17a3 3 0 0 0 3-3c0-2-3-6-3-6s-3 4-3 6a3 3 0 0 0 3 3z" /></>,
  pir: <path d="M14 14.76V4.5a2.5 2.5 0 0 0-5 0v10.26a4.5 4.5 0 1 0 5 0z" />,
  tun: <path d="M14 14.76V4.5a2.5 2.5 0 0 0-5 0v10.26a4.5 4.5 0 1 0 5 0z" />,
};

function sesiLabel(id) {
  return id ? id.replace('SES-', '#') : '—';
}

export default function HealthCheck() {
  const health = useApi(() => api.get('/health-status'), []);
  const sensor = useApi(() => api.get('/sensor-data/latest'), []);
  const prediksi = useApi(() => api.get('/predictions'), []);
  const kontrol = useApi(() => api.get('/control'), []);

  const latest = sensor.data?.latest;
  const sp = kontrol.data;

  function paramSuhu(key, label, nilai, band) {
    const running = latest?.status_sistem === 'running';
    const st = statusSuhu(nilai, band);
    // Saat idle, suhu tidak dinilai (mesin belum memanaskan) → dianggap aman.
    const violated = running && st !== 'aman';
    const catatan = !running
      ? 'mesin idle — dinilai saat proses berjalan'
      : st === 'rendah'
        ? 'di bawah target — pembakaran belum optimal & gas berpotensi naik'
        : st === 'tinggi'
          ? 'melewati batas atas — risiko overheat'
          : 'berada di pita target';
    return {
      key,
      nama: `Suhu ${label}`,
      desc: band ? `Target ${band.bawah}–${band.atas} °C · ${catatan}.` : catatan,
      valLabel: 'saat ini',
      val: `${formatAngka(nilai)} °C`,
      violated,
      severity: 'warning', // suhu hanya memicu peringatan, tak pernah menghentikan proses
    };
  }

  // Parameter pemicu (rule-based) — dari telemetri terkini terhadap setpoint kontrol.
  const params =
    latest && sp
      ? [
          {
            key: 'gas',
            nama: 'Gas mudah terbakar terdeteksi',
            desc: 'Sensor MQ-2. Karena pembakaran makin sempurna saat suhu tinggi, gas biasanya muncul ketika suhu di bawah target.',
            valLabel: 'status',
            val: latest.status_gas ? 'Terdeteksi' : 'Aman',
            violated: latest.status_gas === true,
            severity: 'critical',
          },
          paramSuhu('pir', 'pirolisis (reaktor)', latest.suhu_pirolisis, sp.pirolisis),
          paramSuhu('tun', 'tungku (pembakaran)', latest.suhu_tungku, sp.tungku),
        ]
      : [];

  const alerts =
    latest && sp
      ? hitungAlert({ suhuPirolisis: latest.suhu_pirolisis, suhuTungku: latest.suhu_tungku, statusGas: latest.status_gas, statusSistem: latest.status_sistem, setpoint: sp })
      : [];
  const status = latest && sp ? statusDariAlert(alerts) : health.data?.current?.status || 'normal';
  const ui = STATUS_BIG[status];

  // Tabel riwayat
  const histColumns = [
    { key: 'sesi', header: 'Sesi', headClass: 'w-[110px]', render: (r) => <span className="font-semibold">{sesiLabel(r.session_id)}</span> },
    { key: 'status', header: 'Status', headClass: 'w-[130px]', render: (r) => <HealthStatusBadge status={r.status} /> },
    { key: 'ket', header: 'Keterangan', render: (r) => <span className="text-tinta-60 text-[13.5px]">{r.keterangan}</span> },
    {
      key: 'waktu',
      header: 'Waktu',
      align: 'right',
      headClass: 'w-[160px]',
      render: (r) => (
        <span className="text-tinta-40 text-[12.5px] whitespace-nowrap">
          {formatTanggal(r.created_at)} · {formatJam(r.created_at)}
        </span>
      ),
    },
  ];

  // Prediksi chart + statistik
  const predData = (prediksi.data || [])
    .slice()
    .reverse()
    .map((p) => ({ label: sesiLabel(p.session_id), prediksi: p.predicted_yield, aktual: p.actual_yield }));
  const predTerbaru = prediksi.data?.[0];
  const normalPreds = (prediksi.data || []).filter((p) => p.session_id !== 'SES-125');
  const selisihRata = normalPreds.length
    ? normalPreds.reduce((a, p) => a + Math.abs(p.predicted_yield - p.actual_yield), 0) / normalPreds.length
    : 0;

  return (
    <>
      <Topbar
        crumb="Beranda · Health Check"
        title="Health Check Mesin"
        live
      />

      {/* Status + parameter */}
      <div className="grid grid-cols-[1fr_1.18fr] gap-5 items-start mb-6 max-[1080px]:grid-cols-1">
        {/* Big status */}
        <Reveal className="card overflow-hidden h-full">
          {health.loading ? (
            <div className="p-8 text-tinta-40">Memuat status…</div>
          ) : (
            <div className={`p-7 flex flex-col h-full bg-gradient-to-b ${ui.tint} to-permukaan`}>
              <div className={`w-[104px] h-[104px] rounded-full grid place-items-center border-[3px] bg-white/[.55] mb-[22px] ${ui.ring}`}>
                <svg viewBox="0 0 24 24" className="w-[50px] h-[50px]" {...svg} strokeWidth="1.6">
                  {ui.icon}
                </svg>
              </div>
              <div className="text-[12px] tracking-[.1em] uppercase text-tinta-40 font-semibold">Kondisi mesin saat ini</div>
              <div className={`font-heading text-[42px] font-semibold leading-none mt-2 mb-[14px] ${ui.ringWord}`}>{ui.word}</div>
              <p className="text-[14.5px] text-tinta-60 max-w-[300px]">{ui.desc}</p>
              <div className="mt-auto pt-5 text-[12.5px] text-tinta-40 flex items-center gap-[7px]">
                <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" {...svg} strokeWidth="1.7">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                Pemeriksaan terakhir {latest ? `${formatJam(latest.timestamp)} WIB` : '—'}
              </div>
            </div>
          )}
        </Reveal>

        {/* Parameter pemicu */}
        <Reveal delay={90} className="card h-full">
          <div className="card-hd">
            <h3 className="text-[16px] font-semibold">Parameter pemicu status</h3>
            <span className="text-[13px] text-tinta-60">{params.length} parameter dipantau</span>
          </div>
          <div className="py-2">
            {(sensor.loading || kontrol.loading) && <div className="px-[22px] py-8 text-tinta-40">Memuat parameter…</div>}
            {params.map((p) => {
              const crit = p.violated && p.severity === 'critical';
              const warn = p.violated && p.severity !== 'critical';
              const icoTone = crit ? 'bg-critical-bg text-critical' : warn ? 'bg-warning-bg text-warning' : 'bg-normal-bg text-normal';
              const badgeTone = crit
                ? 'bg-critical-bg text-critical-teks border-[#ECC4BD]'
                : warn
                  ? 'bg-warning-bg text-warning-teks border-[#ECD7A6]'
                  : 'bg-normal-bg text-normal-teks border-[#CFE0C8]';
              const pipTone = crit ? 'bg-critical' : warn ? 'bg-warning' : 'bg-normal';
              const badgeLabel = crit ? 'Bahaya' : warn ? 'Perlu dicek' : 'Normal';
              return (
              <div key={p.key} className="flex gap-[14px] items-start px-[22px] py-[15px] border-b border-border last:border-b-0">
                <div className={`w-[34px] h-[34px] rounded-[10px] flex-none grid place-items-center ${icoTone}`}>
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" {...svg} strokeWidth="1.9">
                    {ICON[p.key]}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-semibold flex items-center gap-[9px] flex-wrap">
                    {p.nama}
                    <span className={`inline-flex items-center gap-[6px] px-[9px] py-[2px] rounded-full text-[11px] font-bold border ${badgeTone}`}>
                      <span className={`w-[6px] h-[6px] rounded-full ${pipTone}`} />
                      {badgeLabel}
                    </span>
                  </div>
                  <div className="text-[13px] text-tinta-60 mt-[3px]">{p.desc}</div>
                </div>
                <div className="text-right text-[13px] text-tinta-40 whitespace-nowrap">
                  {p.valLabel}
                  <b className="block text-[15px] text-tinta font-semibold tnum">{p.val}</b>
                </div>
              </div>
              );
            })}
          </div>
        </Reveal>
      </div>

      {/* Riwayat */}
      <Reveal delay={60} className="card mb-6">
        <div className="card-hd">
          <h3 className="text-[16px] font-semibold">Riwayat health check per sesi</h3>
          <span className="text-[13px] text-tinta-60">Reaktor AMOR</span>
        </div>
        <DataTable
          columns={histColumns}
          rows={health.data?.history || []}
          loading={health.loading}
          error={health.error}
          emptyMessage="Belum ada riwayat health check."
        />
      </Reveal>

      {/* Prediksi Yield */}
      <Reveal delay={90} className="card">
        <div className="card-hd flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-[16px] font-semibold">Prediksi Yield</h3>
            <span className="inline-flex items-center gap-[6px] text-[11px] font-bold tracking-[.05em] uppercase text-olive bg-olive-lembut border border-[#D2DCCC] rounded-full px-[10px] py-1">
              <svg viewBox="0 0 24 24" className="w-[13px] h-[13px]" {...svg} strokeWidth="2">
                <path d="M12 2a4 4 0 0 0-4 4 4 4 0 0 0-1 7.9V18a3 3 0 0 0 6 0M12 2a4 4 0 0 1 4 4 4 4 0 0 1 1 7.9V18a3 3 0 0 1-6 0" />
              </svg>
              Model AI · ONNX
            </span>
          </div>
          <span className="text-[13px] text-tinta-60">Prediksi (%) vs aktual (%) per sesi</span>
        </div>

        {/* DISCLAIMER WAJIB */}
        <div role="note" className="flex gap-3 items-start mx-[22px] mt-5 mb-5 px-4 py-[14px] bg-warning-bg border border-[#ECD7A6] rounded-md">
          <svg viewBox="0 0 24 24" className="w-[19px] h-[19px] flex-none text-warning-teks mt-px" {...svg} strokeWidth="1.9">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01" />
            <path d="M11 12h1v4h1" />
          </svg>
          <p className="text-[13px] leading-[1.55] text-warning-teks">
            <b>Catatan penting.</b> Hasil prediksi bersifat <b>preliminary</b> karena model dilatih dari
            data simulasi; akurasi meningkat seiring terkumpulnya data produksi nyata.
          </p>
        </div>

        <div className="px-[22px] pb-5">
          <div className="grid grid-cols-[1fr_230px] gap-6 items-center max-[1080px]:grid-cols-1">
            <div>
              {prediksi.loading ? (
                <div className="h-[250px] grid place-items-center text-tinta-40">Memuat prediksi…</div>
              ) : prediksi.error ? (
                <div className="h-[250px] grid place-items-center text-critical-teks">Gagal memuat prediksi.</div>
              ) : (
                <Suspense fallback={<ChartFallback height={250} />}>
                  <LineChart
                    data={predData}
                    xKey="label"
                    height={250}
                    leftAxis={{ domain: [35, 75] }}
                    lines={[
                      { dataKey: 'aktual', name: 'Yield aktual', color: '#D9641E', unit: '%', dot: true },
                      { dataKey: 'prediksi', name: 'Prediksi model', color: '#3A4D39', unit: '%', dash: true, dot: true },
                    ]}
                  />
                </Suspense>
              )}
              <div className="flex gap-[18px] text-[12.5px] text-tinta-60 mt-[14px]">
                <span className="inline-flex items-center"><i className="w-[18px] border-t-[2.5px] border-amber inline-block mr-[7px]" />Yield aktual (%)</span>
                <span className="inline-flex items-center"><i className="w-[18px] border-t-[2.5px] border-dashed border-olive inline-block mr-[7px]" />Prediksi model (%)</span>
              </div>
              <p className="text-[12px] text-tinta-40 mt-[10px] leading-[1.5]">
                Sesi <b className="text-tinta-60">#125</b> dihentikan di tengah proses (suhu melewati batas
                aman), sehingga yield-nya jauh di bawah perkiraan dan dikecualikan dari hitungan akurasi.
              </p>
            </div>
            <div className="flex flex-col gap-[14px]">
              <PredStat
                label={`Prediksi sesi ${sesiLabel(predTerbaru?.session_id)}`}
                value={formatAngka(predTerbaru?.predicted_yield)}
                unit="%"
              />
              <PredStat label="Aktual" value={formatAngka(predTerbaru?.actual_yield)} unit="%" />
              <PredStat label="Rata-rata selisih · sesi normal" value={`±${formatAngka(selisihRata)}`} unit="poin" accent />
            </div>
          </div>
        </div>
      </Reveal>
    </>
  );
}

function PredStat({ label, value, unit, accent }) {
  return (
    <div className={`rounded-md border px-4 py-[14px] ${accent ? 'bg-olive-lembut border-[#D2DCCC]' : 'bg-permukaan border-border'}`}>
      <div className="text-[12.5px] text-tinta-60">{label}</div>
      <div className="font-body font-bold text-[24px] tnum mt-[6px] leading-none">
        {value}
        {unit && <small className="text-[13px] text-tinta-60 font-semibold"> {unit}</small>}
      </div>
    </div>
  );
}
