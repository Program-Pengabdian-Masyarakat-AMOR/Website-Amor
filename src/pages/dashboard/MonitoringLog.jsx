import { lazy, Suspense, useEffect, useState } from 'react';
import Topbar from '../../components/layout/Topbar';
import SensorCard from '../../components/SensorCard';
import DataTable from '../../components/DataTable';
import ChartFallback from '../../components/ChartFallback';
import Reveal from '../../components/Reveal';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { THRESHOLDS } from '../../lib/thresholds';
import { formatAngka, formatJam, formatTanggal } from '../../lib/format';

const LineChart = lazy(() => import('../../components/LineChart'));

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
const STATUS_PROSES = ['idle', 'running', 'finished'];
const MAX_POINTS = 14;

function sesiLabel(id) {
  return id ? id.replace('SES-', '#') : '—';
}

function yieldTone(v) {
  if (v >= 67) return 'text-normal-teks';
  if (v >= 60) return 'text-tinta';
  return 'text-warning-teks';
}

export default function MonitoringLog() {
  const sensor = useApi(() => api.get('/sensor-data/latest'), []);
  const produksi = useApi(() => api.get('/production-logs'), []);

  const [current, setCurrent] = useState(null);
  const [serie, setSerie] = useState([]);

  // Seed dari sensor-data/latest sekali saat data tiba.
  useEffect(() => {
    if (!sensor.data) return;
    setCurrent(sensor.data.latest);
    setSerie(
      (sensor.data.series || []).map((p) => ({
        t: formatJam(p.timestamp),
        suhu: p.suhu_reaktor,
        berat: p.berat_input,
      }))
    );
  }, [sensor.data]);

  // Langganan fake-socket: update kartu + dorong titik baru ke grafik.
  useEffect(() => {
    const socket = getSocket();
    function onSensor(payload) {
      setCurrent(payload);
      setSerie((prev) =>
        [...prev, { t: formatJam(payload.timestamp), suhu: payload.suhu_reaktor, berat: payload.berat_input }].slice(
          -MAX_POINTS
        )
      );
    }
    socket.on('sensor-update', onSensor);
    return () => socket.off('sensor-update', onSensor);
  }, []);

  const sesi = produksi.data?.[0];
  const proses = current?.status_proses || 'running';

  const columns = [
    {
      key: 'sesi',
      header: 'Sesi · Tanggal',
      render: (r) => (
        <div>
          <span className="font-semibold">{sesiLabel(r.session_id)}</span>
          <br />
          <span className="text-tinta-40 text-[12.5px]">{formatTanggal(r.created_at)}</span>
        </div>
      ),
    },
    { key: 'in', header: 'Input (kg)', align: 'right', cellClass: 'tnum font-medium', render: (r) => formatAngka(r.berat_input_total) },
    { key: 'out', header: 'Output (kg)', align: 'right', cellClass: 'tnum font-medium', render: (r) => formatAngka(r.berat_output_minyak) },
    {
      key: 'yield',
      header: 'Yield (%)',
      align: 'right',
      render: (r) => <span className={`font-semibold tnum ${yieldTone(r.yield_percent)}`}>{formatAngka(r.yield_percent)}</span>,
    },
    { key: 'suhu', header: 'Suhu rata² (°C)', align: 'right', cellClass: 'tnum font-medium', render: (r) => formatAngka(r.suhu_avg) },
    { key: 'durasi', header: 'Durasi (mnt)', align: 'right', cellClass: 'tnum font-medium', render: (r) => formatAngka(r.durasi_menit) },
  ];

  const rows = produksi.data || [];
  const avg = (sel) => (rows.length ? rows.reduce((a, r) => a + Number(r[sel]), 0) / rows.length : 0);
  const footer = rows.length
    ? [
        { content: `Rata-rata ${rows.length} sesi` },
        { content: <b>{formatAngka(avg('berat_input_total'))}</b>, align: 'right', className: 'tnum' },
        { content: <b>{formatAngka(avg('berat_output_minyak'))}</b>, align: 'right', className: 'tnum' },
        { content: <b>{formatAngka(avg('yield_percent'))}</b>, align: 'right', className: 'tnum' },
        { content: <b>{formatAngka(avg('suhu_avg'))}</b>, align: 'right', className: 'tnum' },
        { content: <b>{formatAngka(avg('durasi_menit'))}</b>, align: 'right', className: 'tnum' },
      ]
    : undefined;

  return (
    <>
      <Topbar crumb="Beranda · Monitoring & Log" title="Monitoring & Log Produksi" live />

      {/* Process banner */}
      <Reveal className="flex items-center gap-4 bg-permukaan border border-border rounded-lg px-[22px] py-4 shadow-1 mb-5 flex-wrap">
        <span className="font-heading font-semibold text-[18px] flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-tinta-40" {...svg} strokeWidth="1.7">
            <path d="M7 8h10l-1.5 11.5a2 2 0 0 1-2 1.5h-3a2 2 0 0 1-2-1.5z" />
            <path d="M9 8V5a3 3 0 0 1 6 0v3" />
          </svg>
          Reaktor AMOR
        </span>
        <span className="w-px h-[26px] bg-border" />
        <span className="text-[13px] text-tinta-60">
          Sesi berjalan <b className="text-tinta font-semibold">{sesiLabel(sesi?.session_id)}</b>
        </span>
        <span className="w-px h-[26px] bg-border" />
        <span className="text-[13px] text-tinta-60">
          Durasi <b className="text-tinta font-semibold tnum">{sesi ? `${formatAngka(sesi.durasi_menit)} mnt` : '—'}</b>
        </span>
        <span className="ml-auto inline-flex items-center gap-2 text-[12.5px] font-semibold text-normal-teks bg-normal-bg border border-[#CFE0C8] rounded-full px-[13px] py-[6px]">
          <span className="live-dot" />
          Sedang berproduksi
        </span>
      </Reveal>

      {/* Sensor cards */}
      <Reveal delay={60} className="grid grid-cols-4 gap-[18px] mb-6 max-[1080px]:grid-cols-2 max-[760px]:grid-cols-1">
        <SensorCard
          tone="olive"
          live
          label="Berat bahan baku"
          value={current ? formatAngka(current.berat_input) : '—'}
          unit="kg"
          sub="Tersisa di reaktor"
          icon={<><path d="M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" /><path d="M6.5 7h11l2.5 11a2 2 0 0 1-2 2.4H6a2 2 0 0 1-2-2.4z" /></>}
        />
        <SensorCard
          live
          label="Suhu reaktor"
          value={current ? formatAngka(current.suhu_reaktor) : '—'}
          unit="°C"
          sub={`Ambang aman ≤ ${THRESHOLDS.suhuMaxAman} °C`}
          icon={<path d="M14 14.76V4.5a2.5 2.5 0 0 0-5 0v10.26a4.5 4.5 0 1 0 5 0z" />}
        />
        <SensorCard
          live
          label="Level gas (MQ-2)"
          value={current ? formatAngka(current.gas_level) : '—'}
          unit="ppm"
          sub={`Aman ≤ ${THRESHOLDS.gasLevelAman} ppm`}
          icon={<><path d="M3 17a9 9 0 0 1 18 0" /><path d="M12 17a3 3 0 0 0 3-3c0-2-3-6-3-6s-3 4-3 6a3 3 0 0 0 3 3z" /></>}
        />
        <SensorCard
          tone="olive"
          label="Status proses"
          icon={<polygon points="6 4 20 12 6 20 6 4" />}
        >
          <div className="font-body font-semibold text-[24px] leading-none capitalize">{proses}</div>
          <div className="inline-flex gap-0 border border-border rounded-full p-[2px] mt-1 self-start">
            {STATUS_PROSES.map((s) => (
              <span
                key={s}
                className={`text-[11.5px] font-semibold px-[10px] py-[3px] rounded-full capitalize ${
                  s === proses ? 'bg-olive text-white' : 'text-tinta-40'
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </SensorCard>
      </Reveal>

      {/* Chart */}
      <Reveal delay={90} className="card mb-6">
        <div className="card-hd flex-wrap gap-[14px]">
          <div>
            <h3 className="text-[16px] font-semibold">Tren suhu & berat selama proses</h3>
            <div className="text-[13px] text-tinta-60">Sesi {sesiLabel(sesi?.session_id)} · diperbarui langsung</div>
          </div>
          <div className="flex gap-[18px] text-[12.5px] text-tinta-60">
            <span className="inline-flex items-center"><i className="w-[18px] border-t-[2.5px] border-amber inline-block mr-[7px]" />Suhu reaktor (°C)</span>
            <span className="inline-flex items-center"><i className="w-[18px] border-t-[2.5px] border-olive inline-block mr-[7px]" />Berat bahan (kg)</span>
          </div>
        </div>
        <div className="px-5 pt-[18px] pb-[14px]">
          {sensor.loading ? (
            <ChartFallback height={280} />
          ) : sensor.error ? (
            <div className="h-[280px] grid place-items-center text-critical-teks">Gagal memuat grafik.</div>
          ) : (
            <Suspense fallback={<ChartFallback height={280} />}>
              <LineChart
                data={serie}
                xKey="t"
                height={280}
                lines={[
                  { dataKey: 'suhu', name: 'Suhu', color: '#D9641E', area: true, yAxisId: 'left', unit: '°C' },
                  { dataKey: 'berat', name: 'Berat', color: '#3A4D39', yAxisId: 'right', unit: 'kg' },
                ]}
                leftAxis={{ domain: [0, 450], color: '#BC5618' }}
                rightAxis={{ domain: [0, 16], color: '#3A4D39' }}
              />
            </Suspense>
          )}
        </div>
      </Reveal>

      {/* Table */}
      <Reveal delay={120} className="card">
        <div className="card-hd">
          <div>
            <h3 className="text-[16px] font-semibold">Riwayat sesi produksi</h3>
            <div className="text-[13px] text-tinta-60">Reaktor AMOR · {rows.length} sesi terakhir</div>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          footer={footer}
          loading={produksi.loading}
          error={produksi.error}
          emptyMessage="Belum ada sesi produksi."
        />
      </Reveal>
    </>
  );
}
