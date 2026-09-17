import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Topbar from '../../components/layout/Topbar';
import SensorCard from '../../components/SensorCard';
import DataTable from '../../components/DataTable';
import ChartFallback from '../../components/ChartFallback';
import Reveal from '../../components/Reveal';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { statusSuhu } from '../../lib/thresholds';
import { formatAngka, formatJam, formatTanggal, formatDurasiMs, menitDariMs, formatMmSs } from '../../lib/format';

const LineChart = lazy(() => import('../../components/LineChart'));

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
const MAX_POINTS = 30; // titik log suhu (rata-rata per menit)

const sesiLabel = (id) => (id ? id.replace('SES-', '#') : '—');

function yieldTone(v) {
  if (v >= 67) return 'text-normal-teks';
  if (v >= 60) return 'text-tinta';
  return 'text-warning-teks';
}

export default function MonitoringLog() {
  const sensor = useApi(() => api.get('/sensor-data/latest'), []);
  const produksi = useApi(() => api.get('/production-logs'), []);
  const kontrol = useApi(() => api.get('/control'), []);
  const feederLog = useApi(() => api.get('/feeder-logs?limit=50'), []);

  const [current, setCurrent] = useState(null);
  const [serie, setSerie] = useState([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [feederRows, setFeederRows] = useState([]);
  const startRef = useRef(null);

  const toPoint = (p) => ({ t: formatJam(p.timestamp), pirolisis: p.suhu_pirolisis, tungku: p.suhu_tungku, berat: p.berat_sampah });

  useEffect(() => {
    if (!sensor.data) return;
    setCurrent(sensor.data.latest);
    setSerie((sensor.data.series || []).map(toPoint)); // titik rata-rata menit
  }, [sensor.data]);

  useEffect(() => {
    if (feederLog.data) setFeederRows(feederLog.data);
  }, [feederLog.data]);

  useEffect(() => {
    const socket = getSocket();
    // Kartu = telemetri instan; grafik = titik rata-rata per menit.
    const onSensor = (p) => setCurrent(p);
    const onTempLog = (p) => setSerie((prev) => [...prev, toPoint(p)].slice(-MAX_POINTS));
    const onFeeder = (p) => setFeederRows((prev) => [p, ...prev].slice(0, 50));
    socket.on('sensor-update', onSensor);
    socket.on('temp-log', onTempLog);
    socket.on('feeder-movement', onFeeder);
    return () => {
      socket.off('sensor-update', onSensor);
      socket.off('temp-log', onTempLog);
      socket.off('feeder-movement', onFeeder);
    };
  }, []);

  const sesi = produksi.data?.[0];
  const proses = current?.status_sistem || 'idle';

  // Timer proses. Titik awal diambil dari waktu mulai sesi yang dicatat server
  // (session_started_at), sehingga timer tidak kembali ke 00:00 saat halaman di-refresh.
  // Fallback ke jam browser hanya bila server belum mengirim waktu mulai.
  const sessionStartedAt = current?.session_started_at ? new Date(current.session_started_at).getTime() : null;
  useEffect(() => {
    if (proses !== 'running') {
      startRef.current = null;
      setElapsedMs(0);
      return;
    }
    if (Number.isFinite(sessionStartedAt)) startRef.current = sessionStartedAt;
    else if (startRef.current == null) startRef.current = Date.now();
    const tick = () => setElapsedMs(Math.max(0, Date.now() - startRef.current));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [proses, sessionStartedAt]);
  const sp = kontrol.data;

  const gasTerdeteksi = current?.status_gas === true;
  const suhuPirTone = sp ? statusSuhu(current?.suhu_pirolisis, sp.pirolisis) : 'aman';
  const suhuTunTone = sp ? statusSuhu(current?.suhu_tungku, sp.tungku) : 'aman';

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
    { key: 'sampah', header: 'Sampah (kg)', align: 'right', cellClass: 'tnum font-medium', render: (r) => formatAngka(r.berat_sampah_total) },
    { key: 'minyak', header: 'Minyak (kg)', align: 'right', cellClass: 'tnum font-medium', render: (r) => formatAngka(r.berat_minyak_total) },
    { key: 'yield', header: 'Yield (%)', align: 'right', render: (r) => <span className={`font-semibold tnum ${yieldTone(r.yield_percent)}`}>{formatAngka(r.yield_percent)}</span> },
    { key: 'pir', header: 'Pirolisis (°C)', align: 'right', cellClass: 'tnum font-medium', render: (r) => formatAngka(r.suhu_pirolisis_avg) },
    { key: 'tun', header: 'Tungku (°C)', align: 'right', cellClass: 'tnum font-medium', render: (r) => formatAngka(r.suhu_tungku_avg) },
    { key: 'durasi', header: 'Durasi (mnt)', align: 'right', cellClass: 'tnum font-medium', render: (r) => menitDariMs(r.waktu_proses_ms) },
  ];

  const feederColumns = [
    {
      key: 'waktu',
      header: 'Waktu',
      render: (r) => <span className="text-tinta-40 text-[12.5px] whitespace-nowrap">{formatTanggal(r.created_at)} · {formatJam(r.created_at)}</span>,
    },
    {
      key: 'gerak',
      header: 'Feeder',
      render: (r) => <span className={`badge ${r.action === 'on' ? 'b-normal' : 'b-warning'}`}><span className="pip" />{String(r.action || '').toUpperCase()}</span>,
    },
    { key: 'sumber', header: 'Sumber', render: (r) => <span className="font-medium capitalize">{r.source}</span> },
    { key: 'pirlog', header: 'Pirolisis (°C)', align: 'right', cellClass: 'tnum', render: (r) => formatAngka(r.suhu_pirolisis) },
    { key: 'tunlog', header: 'Tungku (°C)', align: 'right', cellClass: 'tnum', render: (r) => formatAngka(r.suhu_tungku) },
    { key: 'sampahlog', header: 'Sampah (kg)', align: 'right', cellClass: 'tnum', render: (r) => formatAngka(r.berat_sampah) },
    { key: 'score', header: 'AI score', align: 'right', cellClass: 'tnum', render: (r) => r.ai_score == null ? '—' : `${Math.round(Number(r.ai_score) * 100)}%` },
    { key: 'alasan', header: 'Alasan', render: (r) => <span className="text-tinta-60 text-[13px]">{r.reason}</span> },
  ];

  const rows = produksi.data || [];
  const avg = (sel) => (rows.length ? rows.reduce((a, r) => a + Number(r[sel]), 0) / rows.length : 0);
  const footer = rows.length
    ? [
        { content: `Rata-rata ${rows.length} sesi` },
        { content: <b>{formatAngka(avg('berat_sampah_total'))}</b>, align: 'right', className: 'tnum' },
        { content: <b>{formatAngka(avg('berat_minyak_total'))}</b>, align: 'right', className: 'tnum' },
        { content: <b>{formatAngka(avg('yield_percent'))}</b>, align: 'right', className: 'tnum' },
        { content: <b>{formatAngka(avg('suhu_pirolisis_avg'))}</b>, align: 'right', className: 'tnum' },
        { content: <b>{formatAngka(avg('suhu_tungku_avg'))}</b>, align: 'right', className: 'tnum' },
        { content: <b>{menitDariMs(avg('waktu_proses_ms'))}</b>, align: 'right', className: 'tnum' },
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
          Sesi terakhir <b className="text-tinta font-semibold">{sesiLabel(sesi?.session_id)}</b>
        </span>
        <span className="w-px h-[26px] bg-border" />
        <span className="text-[13px] text-tinta-60">
          {proses === 'running' ? (
            <>Berjalan <b className="text-tinta font-semibold tnum">{formatMmSs(elapsedMs)}</b></>
          ) : (
            <>Durasi terakhir <b className="text-tinta font-semibold tnum">{sesi ? formatDurasiMs(sesi.waktu_proses_ms) : '—'}</b></>
          )}
        </span>
        <span className={`ml-auto inline-flex items-center gap-2 text-[12.5px] font-semibold rounded-full px-[13px] py-[6px] border ${proses === 'running' ? 'text-normal-teks bg-normal-bg border-[#CFE0C8]' : 'text-tinta-60 bg-permukaan-2 border-border'}`}>
          {proses === 'running' && <span className="live-dot" />}
          {proses === 'running' ? 'Sedang berproduksi' : proses === 'finished' ? 'Sesi selesai' : 'Idle'}
        </span>
      </Reveal>

      {/* Sensor cards */}
      <Reveal delay={60} className="grid grid-cols-3 gap-[18px] mb-6 max-[1080px]:grid-cols-2 max-[680px]:grid-cols-1">
        <SensorCard
          tone="olive"
          live
          label="Berat sampah"
          value={current ? formatAngka(current.berat_sampah) : '—'}
          unit="kg"
          sub={current ? `Total masuk: ${formatAngka(current.berat_sampah_total)} kg` : '—'}
          icon={<><path d="M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" /><path d="M6.5 7h11l2.5 11a2 2 0 0 1-2 2.4H6a2 2 0 0 1-2-2.4z" /></>}
        />
        <SensorCard
          live
          label="Berat minyak"
          value={current ? formatAngka(current.berat_minyak) : '—'}
          unit="kg"
          sub="Terkumpul sesi ini"
          icon={<path d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5z" />}
        />
        <SensorCard
          live
          label="Status gas (MQ-2)"
          sub={gasTerdeteksi ? 'Periksa sekitar reaktor' : 'Tidak ada indikasi kebocoran'}
          icon={<><path d="M3 17a9 9 0 0 1 18 0" /><path d="M12 17a3 3 0 0 0 3-3c0-2-3-6-3-6s-3 4-3 6a3 3 0 0 0 3 3z" /></>}
        >
          <span className={`badge ${gasTerdeteksi ? 'b-critical' : 'b-normal'} mt-1 self-start`}>
            <span className="pip" />
            {gasTerdeteksi ? 'Terdeteksi' : 'Aman'}
          </span>
        </SensorCard>
        <SensorCard
          live
          label="Suhu pirolisis"
          value={current ? formatAngka(current.suhu_pirolisis) : '—'}
          unit="°C"
          sub={sp ? `Target ${sp.pirolisis.bawah}–${sp.pirolisis.atas} °C${suhuPirTone !== 'aman' ? ` · ${suhuPirTone === 'rendah' ? 'di bawah target' : 'di atas batas'}` : ''}` : 'Reaktor'}
          icon={<path d="M14 14.76V4.5a2.5 2.5 0 0 0-5 0v10.26a4.5 4.5 0 1 0 5 0z" />}
        />
        <SensorCard
          live
          label="Suhu tungku"
          value={current ? formatAngka(current.suhu_tungku) : '—'}
          unit="°C"
          sub={sp ? `Target ${sp.tungku.bawah}–${sp.tungku.atas} °C${suhuTunTone !== 'aman' ? ` · ${suhuTunTone === 'rendah' ? 'di bawah target' : 'di atas batas'}` : ''}` : 'Pembakaran'}
          icon={<path d="M14 14.76V4.5a2.5 2.5 0 0 0-5 0v10.26a4.5 4.5 0 1 0 5 0z" />}
        />
        <SensorCard
          tone="olive"
          label="Status sistem"
          sub="Kondisi mesin"
          icon={<polygon points="6 4 20 12 6 20 6 4" />}
        >
          <div className="font-body font-semibold text-[24px] leading-none capitalize mt-1">{proses}</div>
        </SensorCard>
      </Reveal>

      {/* Chart */}
      <Reveal delay={90} className="card mb-6">
        <div className="card-hd flex-wrap gap-[14px]">
          <div>
            <h3 className="text-[16px] font-semibold">Tren suhu & berat selama proses</h3>
            <div className="text-[13px] text-tinta-60">Sesi {sesiLabel(sesi?.session_id)} · diperbarui langsung</div>
          </div>
          <div className="flex gap-[18px] text-[12.5px] text-tinta-60 flex-wrap">
            <span className="inline-flex items-center"><i className="w-[18px] border-t-[2.5px] border-amber inline-block mr-[7px]" />Suhu pirolisis (°C)</span>
            <span className="inline-flex items-center"><i className="w-[18px] border-t-[2.5px] border-critical inline-block mr-[7px]" />Suhu tungku (°C)</span>
            <span className="inline-flex items-center"><i className="w-[18px] border-t-[2.5px] border-olive inline-block mr-[7px]" />Berat sampah (kg)</span>
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
                  { dataKey: 'pirolisis', name: 'Pirolisis', color: '#D9641E', area: true, yAxisId: 'left', unit: '°C' },
                  { dataKey: 'tungku', name: 'Tungku', color: '#B23A30', yAxisId: 'left', unit: '°C' },
                  { dataKey: 'berat', name: 'Berat', color: '#3A4D39', yAxisId: 'right', unit: 'kg' },
                ]}
                leftAxis={{ domain: [0, 900], color: '#BC5618' }}
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

      {/* Log feeder: satu baris untuk setiap perubahan ON/OFF, manual maupun AI. */}
      <Reveal delay={150} className="card mt-6">
        <div className="card-hd">
          <div>
            <h3 className="text-[16px] font-semibold">Log pergerakan feeder</h3>
            <div className="text-[13px] text-tinta-60">Terhubung ke perintah IoT · update real-time</div>
          </div>
        </div>
        <DataTable
          columns={feederColumns}
          rows={feederRows}
          loading={feederLog.loading}
          error={feederLog.error}
          emptyMessage="Belum ada pergerakan feeder."
        />
      </Reveal>
    </>
  );
}
